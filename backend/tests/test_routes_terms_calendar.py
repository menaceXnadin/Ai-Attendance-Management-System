"""Integration tests for terms, calendar events -> sessions, retired calendar endpoints, policy &
thresholds, the auto-absent admin endpoints and student cohort fields (Phase 4, owner R5).

Dates are in 2027 so they are after the policy's ``tracking_start_date`` (the migration date) and
after the factory students' ``created_at``. 2027-01-11 is a Monday, 2027-01-13 a Wednesday.
Fixtures are committed (savepoint) before calling routes that may roll back on validation errors.
"""
from __future__ import annotations

from datetime import date, datetime

import pytest
from sqlalchemy import func, select, update

from app.models import AttendanceRecord, ClassSession, JobRun, SemesterConfiguration, Student
from app.models.calendar import AcademicEvent
from app.models.system_settings import AttendanceThreshold, SystemSetting

pytestmark = pytest.mark.integration

TERMS = "/api/admin/semester-config/"
GONE = "Academic periods are managed in Semester Setup"
MONDAY = date(2027, 1, 11)
WEDNESDAY = date(2027, 1, 13)


def _term(**kw):
    body = {"semester_name": "Spring 2027", "start_date": "2027-01-04", "end_date": "2027-05-28"}
    body.update(kw)
    return body


async def _admin(factory, db):
    admin = await factory.admin()
    await db.commit()
    return admin


async def _cohort(factory, db, days=("MONDAY", "WEDNESDAY"), n_students=3):
    cohort = await factory.cohort(
        n_students=n_students, term_start=date(2027, 1, 4), term_end=date(2027, 5, 28),
        days=days, start_time="09:00", end_time="10:00", academic_year=2027,
    )
    await db.execute(update(Student).where(Student.id.in_([s.id for s in cohort.students]))
                     .values(enrolled_on=date(2027, 1, 1)))
    return cohort


async def _session(db, subject_id, d):
    return (await db.execute(
        select(ClassSession).where(ClassSession.subject_id == subject_id, ClassSession.session_date == d)
        .execution_options(populate_existing=True)
    )).scalars().one()


# ------------------------------------------------------------------------------- terms
async def test_term_create_validation_and_overlap(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 2, 1, 9, 0))
    admin = await _admin(factory, db)
    h = auth_headers(admin)

    resp = await client.post(TERMS, headers=h, json=_term())
    assert resp.status_code == 201, resp.text
    a = resp.json()
    assert a["state"] == "current" and a["is_current"] is True
    assert a["semester_number"] == 1 and a["academic_year"] == 2027 and a["is_active"] is True

    resp = await client.post(TERMS, headers=h, json=_term(semester_name="Overlap", start_date="2027-05-01", end_date="2027-08-30"))
    assert resp.status_code == 409, resp.text
    assert "Spring 2027" in resp.json()["detail"]

    resp = await client.post(TERMS, headers=h, json=_term(semester_name="Fall 2027", start_date="2027-08-01", end_date="2027-12-15",
                                                          exam_week_start="2027-12-10", exam_week_end="2027-12-20"))
    assert resp.status_code == 400 and "exam window" in resp.json()["detail"].lower()

    for bad in (_term(semester_name="Backwards", start_date="2027-12-15", end_date="2027-08-01"),
                _term(semester_name="Old", start_date="1990-01-01", end_date="1990-05-01", academic_year=1990)):
        resp = await client.post(TERMS, headers=h, json=bad)
        assert resp.status_code == 400, resp.text
        assert isinstance(resp.json()["detail"], str)

    # Update is re-validated against the merged row.
    resp = await client.put(f"{TERMS}{a['id']}", headers=h, json={"end_date": "2027-01-01"})
    assert resp.status_code == 400, resp.text
    resp = await client.put(f"{TERMS}{a['id']}", headers=h, json={"exam_week_start": "2027-05-17", "exam_week_end": "2027-05-28",
                                                                  "is_current": False})
    assert resp.status_code == 200, resp.text
    assert resp.json()["exam_week_start"] == "2027-05-17" and resp.json()["is_current"] is True  # is_current is computed

    # An inactive term may overlap; activating it re-runs the overlap check.
    resp = await client.post(TERMS, headers=h, json=_term(semester_name="Draft", start_date="2027-03-01", end_date="2027-06-30",
                                                          is_active=False))
    assert resp.status_code == 201, resp.text
    draft = resp.json()
    assert draft["state"] == "inactive"
    resp = await client.put(f"{TERMS}{draft['id']}", headers=h, json={"is_active": True})
    assert resp.status_code == 409, resp.text


async def test_term_list_computes_current_and_state(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 2, 1, 9, 0))
    past = await factory.term(start_date="2026-08-01", end_date="2026-12-15", is_current=True)  # stale stored flag
    current = await factory.term(start_date="2027-01-04", end_date="2027-05-28", semester_number=2)
    upcoming = await factory.term(start_date="2027-08-01", end_date="2027-12-15")
    inactive = await factory.term(start_date="2025-01-01", end_date="2025-05-01", is_active=False)
    admin = await _admin(factory, db)
    h = auth_headers(admin)

    resp = await client.get(TERMS, headers=h)
    assert resp.status_code == 200, resp.text
    by_id = {t["id"]: t for t in resp.json()}
    assert {i: by_id[i]["state"] for i in (past.id, current.id, upcoming.id, inactive.id)} == {
        past.id: "past", current.id: "current", upcoming.id: "upcoming", inactive.id: "inactive"}
    assert by_id[past.id]["is_current"] is False and by_id[current.id]["is_current"] is True

    resp = await client.get(f"{TERMS}current", headers=h)
    assert resp.status_code == 200 and resp.json()["id"] == current.id and resp.json()["term_state"] == "active"

    resp = await client.delete(f"{TERMS}{upcoming.id}", headers=h)
    assert resp.status_code == 204, resp.text
    row = (await db.execute(select(SemesterConfiguration).where(SemesterConfiguration.id == upcoming.id)
                            .execution_options(populate_existing=True))).scalars().one()
    assert row.is_active is False  # deactivated, never hard-deleted
    resp = await client.get(f"{TERMS}{upcoming.id}", headers=h)
    assert resp.json()["state"] == "inactive"

    resp = await client.post(f"{TERMS}{current.id}/set-current", headers=h)
    assert resp.status_code == 410

    teacher = await factory.teacher()
    assert (await client.get(TERMS, headers=auth_headers(teacher))).status_code == 403


async def test_between_terms_state(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 6, 15, 9, 0))
    spring = await factory.term(start_date="2027-01-04", end_date="2027-05-28")
    await factory.term(start_date="2027-08-01", end_date="2027-12-15")
    admin = await _admin(factory, db)
    student = await factory.student()

    resp = await client.get(f"{TERMS}current", headers=auth_headers(admin))
    assert resp.status_code == 404
    assert resp.json()["term_state"] == "between_terms" and isinstance(resp.json()["detail"], str)

    resp = await client.get("/api/system-settings/attendance-policy", headers=auth_headers(student))
    assert resp.status_code == 200, resp.text
    policy = resp.json()
    assert policy["term_state"] == "between_terms" and policy["current_term"] is None
    assert policy["reporting_term"]["id"] == spring.id
    assert policy["minimum_percentage"] == 75.0 and policy["weekly_off_days"] == ["saturday"]
    bands = policy["bands"]
    assert bands[0]["max"] is None and bands[-1]["min"] == 0
    assert all(bands[i]["max"] == bands[i - 1]["min"] for i in range(1, len(bands)))
    assert bands[-2]["min"] == policy["minimum_percentage"]

    from app.services.automatic_semester import AutomaticSemesterService

    await AutomaticSemesterService.load_override_from_db(db)
    assert AutomaticSemesterService.get_current_period() is None
    assert AutomaticSemesterService.get_term_state() == "between_terms"
    assert AutomaticSemesterService.get_period_by_date(date(2027, 3, 1)).term_id == spring.id
    assert await AutomaticSemesterService.get_current_period_async(db) is None


# ---------------------------------------------------------------------- calendar events
async def test_holiday_event_reconciles_and_deactivation_restores(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 1, 20, 12, 0))
    c = await _cohort(factory, db)
    from app.services.class_sessions import materialize_sessions

    await materialize_sessions(db, MONDAY, WEDNESDAY)
    s_mon = await _session(db, c.subject.id, MONDAY)
    s_wed = await _session(db, c.subject.id, WEDNESDAY)
    await factory.attendance_record(student=c.students[0], subject=c.subject, date=MONDAY, status="present",
                                    marked_by=c.teacher, session_id=s_mon.id, source="teacher")
    s_mon.status = "held"
    admin = await _admin(factory, db)
    h = auth_headers(admin)

    body = {"title": "Snow days", "event_type": "holiday", "start_date": MONDAY.isoformat(),
            "end_date": WEDNESDAY.isoformat(), "is_all_day": True, "color_code": "#ef4444"}
    assert (await client.post("/api/calendar/events", headers=auth_headers(c.teacher), json=body)).status_code == 403
    resp = await client.post("/api/calendar/events", headers=h, json=body)
    assert resp.status_code == 200, resp.text
    event = resp.json()
    assert event["session_impact"]["cancelled"] == 1 and event["session_impact"]["review_required"] == 1

    s_mon, s_wed = await _session(db, c.subject.id, MONDAY), await _session(db, c.subject.id, WEDNESDAY)
    assert s_wed.status == "cancelled" and s_wed.cancelled_by_event_id == event["id"]
    assert s_mon.status == "held" and s_mon.review_required is True  # real records -> admin review

    # Admin can keep the session as held and clear the review flag (reason required, audited).
    from app.models import AttendanceAuditLog
    mon_id = s_mon.id  # error responses roll back the shared test session and expire ORM objects
    resp = await client.post(f"/api/attendance/sessions/{mon_id}/clear-review", headers=auth_headers(c.teacher),
                             json={"reason": "Class did happen"})
    assert resp.status_code == 403
    resp = await client.post(f"/api/attendance/sessions/{mon_id}/clear-review", headers=h, json={})
    assert resp.status_code == 422, resp.text
    resp = await client.post(f"/api/attendance/sessions/{mon_id}/clear-review", headers=h,
                             json={"reason": "Class happened before the closure was announced"})
    assert resp.status_code == 200, resp.text
    s_mon = await _session(db, c.subject.id, MONDAY)
    assert s_mon.status == "held" and s_mon.review_required is False
    audit = (await db.execute(select(AttendanceAuditLog).where(
        AttendanceAuditLog.session_id == mon_id, AttendanceAuditLog.action == "review_cleared"))).scalars().all()
    assert len(audit) == 1 and audit[0].context["previous_review_reason"]
    resp = await client.post(f"/api/attendance/sessions/{mon_id}/clear-review", headers=h, json={"reason": "again"})
    assert resp.status_code == 409

    # Range coverage: a window on the middle day still returns the multi-day event.
    resp = await client.get("/api/calendar/events?start_date=2027-01-12&end_date=2027-01-12", headers=h)
    assert resp.status_code == 200 and event["id"] in [e["id"] for e in resp.json()]

    resp = await client.delete(f"/api/calendar/events/{event['id']}", headers=h)
    assert resp.status_code == 200, resp.text
    assert resp.json()["deactivated"] is True and resp.json()["session_impact"]["restored"] == 1
    row = (await db.execute(select(AcademicEvent).where(AcademicEvent.id == event["id"])
                            .execution_options(populate_existing=True))).scalars().one()
    assert row.is_active is False  # soft delete
    s_mon, s_wed = await _session(db, c.subject.id, MONDAY), await _session(db, c.subject.id, WEDNESDAY)
    assert s_wed.status == "scheduled" and s_wed.cancelled_by_event_id is None
    assert s_mon.status == "held" and s_mon.review_required is False


async def test_event_update_moves_coverage(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 1, 20, 12, 0))
    c = await _cohort(factory, db)
    from app.services.class_sessions import materialize_sessions

    await materialize_sessions(db, MONDAY, WEDNESDAY)
    admin = await _admin(factory, db)
    h = auth_headers(admin)
    resp = await client.post("/api/calendar/events", headers=h, json={
        "title": "Cancelled", "event_type": "cancelled_class", "start_date": MONDAY.isoformat(),
        "subject_id": c.subject.id, "color_code": "#6b7280"})
    assert resp.status_code == 200, resp.text
    eid = resp.json()["id"]
    assert (await _session(db, c.subject.id, MONDAY)).status == "cancelled"

    resp = await client.put(f"/api/calendar/events/{eid}", headers=h, json={"start_date": WEDNESDAY.isoformat()})
    assert resp.status_code == 200, resp.text
    assert resp.json()["session_impact"]["restored"] == 1 and resp.json()["session_impact"]["cancelled"] == 1
    assert (await _session(db, c.subject.id, MONDAY)).status == "scheduled"
    assert (await _session(db, c.subject.id, WEDNESDAY)).status == "cancelled"

    resp = await client.put(f"/api/calendar/events/{eid}", headers=h, json={"end_date": "2027-01-01"})
    assert resp.status_code == 400


# --------------------------------------------------------------------- retired endpoints
async def test_calendar_config_writes_and_generator_are_gone(client, factory, db, auth_headers):
    admin = await _admin(factory, db)
    h = auth_headers(admin)
    resp = await client.post("/api/admin/academic-calendar/override", headers=h, json={"anything": 1})
    assert resp.status_code == 410 and resp.json()["detail"] == GONE
    resp = await client.delete("/api/admin/academic-calendar/override/1", headers=h)
    assert resp.status_code == 410 and resp.json()["detail"] == GONE
    resp = await client.get("/api/admin/academic-calendar/current", headers=h)
    assert resp.status_code == 200 and resp.json()["deprecated"] is True

    for path in ("/api/calendar-generator/auto-generate", "/api/calendar-generator/generate-semester",
                 "/api/calendar-generator/cleanup-old-events",
                 "/api/calendar-generator/regenerate-date-range?start_date=2027-01-01&end_date=2027-01-31"):
        resp = await client.post(path, headers=h)
        assert resp.status_code == 410, path
        assert "no longer needed" in resp.json()["detail"]
    resp = await client.get("/api/calendar-generator/status", headers=h)
    assert resp.status_code == 200 and resp.json()["status"] == "disabled"

    teacher = await factory.teacher()
    assert (await client.post("/api/admin/academic-calendar/override", headers=auth_headers(teacher))).status_code == 403
    assert (await client.post("/api/calendar-generator/auto-generate", headers=auth_headers(teacher))).status_code == 403


def test_calendar_boundary_validation_rejects_impossible_dates():
    from pydantic import ValidationError

    from app.api.routes.admin_calendar_config import DateBoundary, is_valid_boundary

    assert is_valid_boundary(2, 29) and is_valid_boundary(12, 31)
    assert not any(is_valid_boundary(m, d) for m, d in ((2, 30), (4, 31), (13, 1), (0, 5)))
    with pytest.raises(ValidationError):
        DateBoundary(month=2, day=30)


# ------------------------------------------------------------------------- thresholds
async def test_threshold_bands_validated(client, factory, db, auth_headers):
    admin = await _admin(factory, db)
    h = auth_headers(admin)
    ids = {n: i for n, i in (await db.execute(select(AttendanceThreshold.name, AttendanceThreshold.id))).all()}
    base = "/api/system-settings/attendance-thresholds"

    resp = await client.put(f"{base}/{ids['warning']}", headers=h, json={"min_percentage": 70})
    assert resp.status_code == 400 and "attendance minimum" in resp.json()["detail"]
    resp = await client.put(f"{base}/{ids['critical']}", headers=h, json={"min_percentage": 5})
    assert resp.status_code == 400 and "0%" in resp.json()["detail"]
    resp = await client.put(f"{base}/{ids['good']}", headers=h, json={"max_percentage": 50})
    assert resp.status_code == 400
    new = {"name": "solid", "color": "teal", "badge_style": "x", "label": "Solid", "order": 3}
    resp = await client.post(base, headers=h, json={**new, "min_percentage": 85})
    assert resp.status_code == 400  # same start as 'good'

    resp = await client.post(base, headers=h, json={**new, "min_percentage": 80})
    assert resp.status_code == 201, resp.text
    assert resp.json()["max_percentage"] == 84.99
    maxes = {n: m for n, m in (await db.execute(
        select(AttendanceThreshold.name, AttendanceThreshold.max_percentage)
        .execution_options(populate_existing=True))).all()}
    assert maxes["warning"] == 79.99 and maxes["excellent"] is None

    settings_url = "/api/system-settings/settings/attendance_minimum"
    for bad in (150, 0, "x"):
        resp = await client.put(settings_url, headers=h, json={"value": {"percentage": bad}})
        assert resp.status_code == 400, bad
    resp = await client.put(settings_url, headers=h, json={"value": {"percentage": 82}})
    assert resp.status_code == 400 and "solid" in resp.json()["detail"]
    resp = await client.put(settings_url, headers=h, json={"value": {"percentage": 70}})
    assert resp.status_code == 200, resp.text
    policy = (await client.get("/api/system-settings/attendance-policy", headers=h)).json()
    assert policy["minimum_percentage"] == 70.0 and policy["bands"][-2]["min"] == 70.0

    resp = await client.delete(f"{base}/{ids['critical']}", headers=h)
    assert resp.status_code == 400
    teacher = await factory.teacher()
    assert (await client.put(settings_url, headers=auth_headers(teacher), json={"value": {"percentage": 60}})).status_code == 403


# ------------------------------------------------------------------------- auto-absent
async def test_auto_absent_trigger_validates_date_and_is_idempotent(client, factory, db, auth_headers, frozen_now):
    frozen_now(datetime(2027, 1, 11, 12, 0))
    c = await _cohort(factory, db, days=("MONDAY",))
    from app.services.class_sessions import materialize_sessions

    await materialize_sessions(db, MONDAY, MONDAY)
    session = await _session(db, c.subject.id, MONDAY)
    await factory.attendance_record(student=c.students[0], subject=c.subject, date=MONDAY, status="present",
                                    marked_by=c.teacher, session_id=session.id, source="teacher")
    session.status = "held"
    session.attendance_taken_at = datetime(2027, 1, 11, 9, 5)
    admin = await _admin(factory, db)
    h = auth_headers(admin)

    for bad in ("2026-11-01", "2027-01-12", "2027-01-02"):  # >30 days back, future, before the term
        resp = await client.post("/api/auto-absent/trigger", headers=h, json={"date": bad})
        assert resp.status_code == 400, (bad, resp.text)
        assert isinstance(resp.json()["detail"], str)

    resp = await client.post("/api/auto-absent/trigger", headers=h)
    assert resp.status_code == 200, resp.text
    first = resp.json()
    assert first["success"] is True and first["records_created"] == 2 and first["sessions_finalized"] == 1
    assert first["job_run_id"] and first["triggered_by"] == admin.user_id

    resp = await client.post("/api/auto-absent/trigger", headers=h, json={"date": MONDAY.isoformat()})
    assert resp.status_code == 200, resp.text
    assert resp.json()["records_created"] == 0 and resp.json()["job_run_id"] != first["job_run_id"]

    absents = (await db.execute(select(func.count(AttendanceRecord.id)).where(
        AttendanceRecord.session_id == session.id, AttendanceRecord.source == "system_auto"))).scalar()
    assert absents == 2
    runs = (await db.execute(select(JobRun).where(JobRun.job_name == "auto_absent")
                             .execution_options(populate_existing=True))).scalars().all()
    assert len(runs) == 2 and {r.triggered_by for r in runs} == {admin.user_id}
    assert {r.status for r in runs} == {"success"}

    resp = await client.get("/api/auto-absent/runs?limit=5", headers=h)
    assert resp.status_code == 200 and [r["id"] for r in resp.json()] == sorted((r.id for r in runs), reverse=True)
    status_body = (await client.get("/api/auto-absent/status", headers=h)).json()
    for key in ("auto_absent_enabled", "current_time", "in_schedule_window", "schedule_window",
                "expired_classes_ready_to_process", "next_scheduled_run", "notes", "unrecorded_sessions", "last_run"):
        assert key in status_body
    assert status_body["expired_classes_ready_to_process"] == 0
    assert status_body["last_run"]["id"] == max(r.id for r in runs)

    assert (await client.post("/api/auto-absent/trigger", headers=auth_headers(c.teacher))).status_code == 403


# ------------------------------------------------------------------------ student fields
async def test_cohort_since_set_on_cohort_change(client, factory, db, auth_headers, frozen_now):
    clock = frozen_now(datetime(2027, 2, 3, 9, 0))
    faculty_b = await factory.faculty()
    student = await factory.student(semester=1)
    admin = await _admin(factory, db)
    h = auth_headers(admin)
    url = f"/api/students/{student.id}"

    resp = await client.put(url, headers=h, json={"semester": 2, "enrolled_on": "2026-12-01"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["cohort_since"] == "2027-02-03" and resp.json()["enrolled_on"] == "2026-12-01"

    clock.set(datetime(2027, 2, 10, 9, 0))
    resp = await client.put(url, headers=h, json={"semester": 2, "year": 1})
    assert resp.json()["cohort_since"] == "2027-02-03"  # no cohort change
    resp = await client.put(url, headers=h, json={"faculty_id": faculty_b.id})
    assert resp.status_code == 200 and resp.json()["cohort_since"] == "2027-02-10"

    resp = await client.put(url, headers=h, json={"enrolled_on": "not-a-date"})
    assert resp.status_code == 400
    resp = await client.put(url, headers=auth_headers(student), json={"enrolled_on": "2027-01-01"})
    assert resp.status_code == 403
    row = (await db.execute(select(Student).where(Student.id == student.id)
                            .execution_options(populate_existing=True))).scalars().one()
    assert row.enrolled_on == date(2026, 12, 1) and row.cohort_since == date(2027, 2, 10)


async def test_attendance_policy_update_merges_and_locks_tracking_start(client, factory, db, auth_headers):
    """Regression: a partial PUT must not wipe other policy keys, and tracking_start_date
    (start of the session regime, §13.1) can never be cleared or moved."""
    admin = await _admin(factory, db)
    h = auth_headers(admin)
    before = (await db.execute(select(SystemSetting).where(SystemSetting.key == "attendance_policy"))).scalars().one()
    locked = before.value["tracking_start_date"]

    resp = await client.put("/api/system-settings/settings/attendance_policy", headers=h,
                            json={"value": {"finalize_grace_minutes": 20}})
    assert resp.status_code == 200, resp.text
    value = resp.json()["value"]
    assert value["finalize_grace_minutes"] == 20
    assert value["tracking_start_date"] == locked
    assert value["late_after_minutes"] == before.value["late_after_minutes"]  # untouched key kept

    for bad in ({"tracking_start_date": None}, {"tracking_start_date": "2020-01-01"}):
        resp = await client.put("/api/system-settings/settings/attendance_policy", headers=h, json={"value": bad})
        assert resp.status_code == 400, resp.text
