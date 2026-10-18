"""Smoke tests for the pytest harness itself (DB guard, schema, factories, client, auth, scheduler)."""
from __future__ import annotations

import os
import sys
from datetime import date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError

from tests.support import testenv
from tests.support.database import install_connection_guard
from tests.support.factories import WEEKDAY_ENUM, day_of_week_label


# ----------------------------------------------------------------- guard / environment
@pytest.mark.parametrize(
    "name",
    ["attendancedb", "attendancedb_prod", "attendancedb_test2", "attendancedb_testx", "postgres",
     "attendancedb_test_gw", "xattendancedb_test", "", None],
)
def test_db_name_guard_rejects_non_test_names(name):
    with pytest.raises(testenv.UnsafeDatabaseError):
        testenv.assert_safe_db_name(name)


@pytest.mark.parametrize("name", ["attendancedb_test", "attendancedb_migtest", "attendancedb_test_gw3"])
def test_db_name_guard_accepts_test_names(name):
    assert testenv.assert_safe_db_name(name) == name


def test_settings_point_at_test_db_and_no_dotenv_leak(app):
    from sqlalchemy.engine import make_url

    from app.core.config import Settings, settings

    assert make_url(settings.database_url).database == testenv.get_config().name
    assert make_url(settings.database_url_sync).database == testenv.get_config().name
    assert settings.secret_key == testenv.TEST_SECRET_KEY
    assert (settings.smtp_host, settings.smtp_user, settings.smtp_password) == ("", "", "")
    assert settings.enable_auto_absent_scheduler is False
    explicit = {k.upper() for k in testenv.EXPLICIT_ENV}
    missing_fields = sorted(f.upper() for f in Settings.model_fields if f.upper() not in explicit)
    missing_dotenv = sorted(testenv.dotenv_keys() - explicit)
    assert not missing_fields, f"Settings fields without an explicit test value (add to tests/support/testenv.py): {missing_fields}"
    assert not missing_dotenv, f"backend/.env keys that could leak into tests (add to tests/support/testenv.py): {missing_dotenv}"


def test_insightface_is_stubbed(app):
    module = sys.modules["app.services.insightface_service"]
    assert getattr(module, "__attendai_fake__", False)
    assert "insightface" not in sys.modules, "the real InsightFace library must not be imported"
    from app.api.routes import face_recognition

    assert face_recognition.insightface_service is module.insightface_service


def test_scheduler_not_started(app):
    from app.services.scheduler_service import scheduler_service

    assert scheduler_service.running is False
    assert scheduler_service.task is None


def test_app_import_is_fast(app):
    assert app.state.attendai_import_seconds < 15, app.state.attendai_import_seconds


# ------------------------------------------------------------------------ database


@pytest.mark.integration
async def test_connected_to_guarded_test_db(db):
    name = (await db.execute(text("SELECT current_database()"))).scalar_one()
    assert name == testenv.get_config().name
    assert testenv.TEST_DB_NAME_RE.fullmatch(name)
    tz = (await db.execute(text("SHOW TimeZone"))).scalar_one()
    assert tz in ("Asia/Katmandu", "Asia/Kathmandu")


@pytest.mark.integration
async def test_connection_guard_blocks_live_db(test_db):
    """Any SQLAlchemy engine pointed at a non-test DB is refused before a statement runs."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    install_connection_guard()
    live_url = test_db.sync_url.set(database="postgres")  # maintenance DB stands in for "not a test DB"
    engine = create_engine(live_url, poolclass=NullPool)
    try:
        with pytest.raises(testenv.UnsafeDatabaseError):
            with engine.connect():
                pass
    finally:
        engine.dispose()


@pytest.mark.integration
async def test_alembic_at_head_and_reference_rows_seeded(db):
    from alembic.script import ScriptDirectory
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(testenv.BACKEND_DIR / "alembic"))
    heads = set(ScriptDirectory.from_config(cfg).get_heads())
    current = set((await db.execute(text("SELECT version_num FROM alembic_version"))).scalars())
    assert current == heads
    keys = set((await db.execute(text("SELECT key FROM system_settings"))).scalars())
    assert {"attendance_minimum", "academic_calendar_type"} <= keys
    bands = (await db.execute(text('SELECT name FROM attendance_thresholds ORDER BY "order"'))).scalars().all()
    assert bands == ["excellent", "good", "warning", "critical"]


@pytest.mark.integration
async def test_schema_has_key_enums_constraints_triggers_and_view(db):
    enums = dict(
        (await db.execute(text(
            "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_type t "
            "JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname"
        ))).all()
    )
    assert {"present", "absent", "late", "cancelled"} <= set(enums["attendance_status"])
    assert set(enums["day_of_week"]) == set(WEEKDAY_ENUM)
    assert set(enums["user_role"]) == {"student", "admin", "faculty"}
    assert {"HOLIDAY", "EXAM", "CANCELLED_CLASS", "CLASS", "SPECIAL_EVENT"} <= set(enums["eventtype"])

    attendance_uniques = set(
        (await db.execute(text(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'public.attendance_records'::regclass AND contype = 'u' "
            "UNION SELECT indexname FROM pg_indexes WHERE tablename = 'attendance_records' AND indexdef ILIKE 'CREATE UNIQUE%'"
        ))).scalars()
    )
    # baseline: UNIQUE(student_id, subject_id, date); after the session migration (§6.1) the
    # per-session key + partial legacy key replace it.
    assert attendance_uniques & {"unique_attendance_student_subject_date", "uq_attendance_student_session"}, attendance_uniques

    triggers = set((await db.execute(text("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal"))).scalars())
    assert {"trigger_sync_student_name", "update_attendance_records_updated_at"} <= triggers
    views = set((await db.execute(text("SELECT viewname FROM pg_views WHERE schemaname = 'public'"))).scalars())
    assert "student_attendance_summary" in views
    backups = (await db.execute(text("SELECT count(*) FROM pg_tables WHERE tablename LIKE 'students_backup_%'"))).scalar_one()
    assert backups == 0


@pytest.mark.integration
async def test_attendance_enum_rejects_uppercase(factory, db):
    cohort = await factory.cohort(n_students=1)
    with pytest.raises(DBAPIError):
        async with db.begin_nested():
            await factory.attendance_record(student=cohort.students[0], subject=cohort.subject,
                                            date=date(2025, 1, 6), status="PRESENT")


# ------------------------------------------------------------------------ factories
@pytest.mark.integration
async def test_factories_create_consistent_cohort(factory, db):
    cohort = await factory.cohort(n_students=3, semester=3, days=("MONDAY", 2))
    assert len(cohort.students) == 3
    for s in cohort.students:
        assert (s.faculty_id, s.semester, s.year) == (cohort.faculty.id, 3, 2)
        assert s.faculty == cohort.faculty.name and s.user.role == "student" and s.name == s.user.full_name
    assert cohort.subject.faculty_id == cohort.faculty.id
    assert cohort.teacher.user.role == "faculty" and cohort.teacher.faculty_id == cohort.faculty.id
    assert [s.day_of_week for s in cohort.schedules] == ["MONDAY", "WEDNESDAY"]
    assert all(s.teacher_id == cohort.teacher.id and s.semester == 3 for s in cohort.schedules)
    assert cohort.term.is_active and cohort.term.start_date < cohort.term.end_date

    # roster query through the real schema
    roster = (await db.execute(text(
        "SELECT count(*) FROM students st JOIN users u ON u.id = st.user_id "
        "WHERE st.faculty_id = :f AND st.semester = :sem AND u.is_active"
    ), {"f": cohort.faculty.id, "sem": 3})).scalar_one()
    assert roster == 3

    admin = await factory.admin()
    assert admin.user.role == "admin" and admin.admin_id
    holiday = await factory.holiday(start_date=date(2025, 1, 13), end_date=date(2025, 1, 14), faculty=cohort.faculty)
    exam = await factory.exam(start_date="2025-05-20", end_date="2025-05-30")
    cancelled = await factory.cancelled_class(start_date=date(2025, 1, 8), subject=cohort.subject, faculty=cohort.faculty)
    assert (holiday.event_type, exam.event_type, cancelled.event_type) == ("HOLIDAY", "EXAM", "CANCELLED_CLASS")
    assert holiday.is_all_day and exam.faculty_id is None and cancelled.subject_id == cohort.subject.id

    rec = await factory.attendance_record(student=cohort.students[0], subject=cohort.subject,
                                          date=date(2025, 1, 6), status="absent", method="other",
                                          location="AUTO_ABSENT_SYSTEM")
    assert (rec.status, rec.method, rec.marked_by) == ("absent", "other", None)
    with pytest.raises(IntegrityError):  # live unique key (student, subject, date)
        async with db.begin_nested():
            await factory.attendance_record(student=cohort.students[0], subject=cohort.subject, date=date(2025, 1, 6))


def test_day_of_week_label():
    assert day_of_week_label(date(2025, 1, 6)) == "MONDAY"
    assert day_of_week_label(5) == "SATURDAY"
    assert day_of_week_label("sunday") == "SUNDAY"


@pytest.mark.integration
async def test_rows_are_rolled_back_between_tests(db):
    # cohort() above created faculties; every test starts from baseline + seed only
    assert (await db.execute(text("SELECT count(*) FROM faculties"))).scalar_one() == 0
    assert (await db.execute(text("SELECT count(*) FROM users"))).scalar_one() == 0


# --------------------------------------------------------------------- HTTP + auth
@pytest.mark.integration
async def test_admin_token_gets_200_and_anonymous_is_rejected(client, factory, auth_headers):
    admin = await factory.admin()
    ok = await client.get("/api/auth/me", headers=auth_headers(admin))
    assert ok.status_code == 200, ok.text
    assert ok.json()["email"] == admin.user.email

    admin_only = await client.get("/api/auth/admin/reset-requests", headers=auth_headers(admin))
    assert admin_only.status_code == 200, admin_only.text

    anonymous = await client.get("/api/auth/me")
    # FastAPI 0.116 HTTPBearer answers a *missing* header with 403 "Not authenticated";
    # an invalid/expired token is a 401 (verify_token).
    assert anonymous.status_code in (401, 403), anonymous.text
    bad = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert bad.status_code == 401, bad.text


@pytest.mark.integration
async def test_role_is_enforced_with_real_tokens(client, factory, auth_headers, token_for):
    student = await factory.student()
    resp = await client.get("/api/auth/admin/reset-requests", headers=auth_headers(student))
    assert resp.status_code == 403, resp.text
    forged = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_for(student, role='admin')}"})
    assert forged.status_code == 401, forged.text  # role claim must match users.role
    inactive = await factory.admin(is_active=False)
    assert (await client.get("/api/auth/me", headers=auth_headers(inactive))).status_code == 401


@pytest.mark.integration
async def test_login_with_factory_user(client, factory, default_password):
    teacher = await factory.teacher()
    resp = await client.post("/api/auth/login", json={"email": teacher.user.email, "password": default_password})
    if resp.status_code == 422:  # form-encoded login variant
        resp = await client.post("/api/auth/login", data={"username": teacher.user.email, "password": default_password})
    assert resp.status_code == 200, resp.text
    assert resp.json().get("access_token")


@pytest.mark.integration
async def test_route_commit_only_releases_savepoint(client, factory, db, auth_headers):
    """Writes done by a request are visible to the test and rolled back afterwards."""
    admin = await factory.admin()
    await db.commit()  # releases the savepoint only
    name = (await db.execute(text("SELECT name FROM admins WHERE id = :id"), {"id": admin.id})).scalar_one()
    assert name == admin.name


# ---------------------------------------------------------------------- clock/fakes
def test_frozen_now(frozen_now):
    from app.core import clock

    frozen = frozen_now(datetime(2025, 3, 3, 9, 30))
    assert clock.app_now() == frozen.now
    assert clock.app_today() == date(2025, 3, 3)
    frozen.advance(hours=15)
    assert clock.app_today() == date(2025, 3, 4)


def test_fake_face_controls(fake_face):
    from tests.support.fake_face import unit_embedding

    fake_face.set_face(embedding=unit_embedding(7), confidence=0.95)
    img = fake_face.decode_base64_image("data:image/jpeg;base64,AAAA")
    face = fake_face.extract_face_features(img)
    assert face["confidence"] == 0.95
    assert fake_face.compare_embeddings([unit_embedding(7)], face["embedding"])[0] is True
    assert fake_face.compare_embeddings([unit_embedding(8)], face["embedding"])[0] is False
    fake_face.set_no_face()
    assert fake_face.detect_faces(img) == []
