"""Integration tests for ``app/api/routes/attendance.py`` (Phase 4, contract v1).

Dates are in 2027 so they are after the policy's ``tracking_start_date`` (the migration date)
and after the factory students' ``created_at``; students also get an explicit ``enrolled_on``.
2027-01-11 is a Monday; the cohort meets Mondays 09:00-10:00 (finalize grace 15 min).
"""
from __future__ import annotations

from datetime import date, datetime

import pytest
from sqlalchemy import func, select, update

from app.models import AttendanceAuditLog, AttendanceRecord, ClassSession, Student

pytestmark = pytest.mark.integration

MONDAY = date(2027, 1, 11)
DAY = MONDAY.isoformat()


async def _setup(factory, db, *, n_students: int = 3):
    cohort = await factory.cohort(
        n_students=n_students, term_start=date(2027, 1, 4), term_end=date(2027, 5, 28),
        days=("MONDAY",), start_time="09:00", end_time="10:00", academic_year=2027,
    )
    await db.execute(
        update(Student).where(Student.id.in_([s.id for s in cohort.students])).values(enrolled_on=date(2027, 1, 1))
    )
    admin = await factory.admin()
    await db.commit()  # route rollbacks (DomainError) must not wipe the fixtures
    return cohort, admin


async def _session_row(db, subject_id):
    return (await db.execute(
        select(ClassSession).where(ClassSession.subject_id == subject_id, ClassSession.session_date == MONDAY)
        .execution_options(populate_existing=True)
    )).scalars().one()


async def _materialize(client, auth_headers, admin, subject_id) -> int:
    resp = await client.get(f"/api/attendance/sessions?date={DAY}&subject_id={subject_id}", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    sessions = resp.json()["sessions"]
    assert len(sessions) == 1
    return sessions[0]["id"]


async def test_admin_mark_bulk_is_a_register_submission(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))  # past end + grace: a late submission must confirm "held" (§13.3 amended)
    s1, s2, s3 = c.students
    payload = {
        "subject_id": c.subject.id, "date": DAY,
        "students": [{"student_id": s1.id, "status": "present"}, {"student_id": s2.id, "status": "ABSENT"}],
    }
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json=payload)
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "confirm_held", resp.text
    assert resp.json()["detail"]["students_without_record"] == 1
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={**payload, "confirm_held": True})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created_records"] == 2 and body["updated_records"] == 0
    assert body["mode"] == "normal" and body["message"] and body["date"] == DAY and body["subject_id"] == c.subject.id
    assert body["submitted"] is True and body["session_status"] == "held"
    assert {(r["student_id"], r["status"], r["outcome"]) for r in body["results"]} == {
        (s1.id, "present", "created"), (s2.id, "absent", "created")}

    session = await _session_row(db, c.subject.id)
    assert body["session_id"] == session.id
    assert session.status == "held" and session.submitted_at is not None and session.submitted_by == admin.user_id
    records = (await db.execute(
        select(AttendanceRecord.student_id, AttendanceRecord.source, AttendanceRecord.session_id)
        .where(AttendanceRecord.subject_id == c.subject.id)
    )).all()
    assert {(r.student_id, r.source, r.session_id) for r in records} == {(s1.id, "admin", session.id), (s2.id, "admin", session.id)}
    actions = sorted(a for (a,) in (await db.execute(
        select(AttendanceAuditLog.action).where(AttendanceAuditLog.session_id == session.id))).all())
    assert actions == ["create", "create", "session_submitted"]

    # Re-submitting with one change: updated + unchanged outcomes, one more audit row.
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY,
        "students": [{"student_id": s1.id, "status": "present"}, {"student_id": s2.id, "status": "late"}],
    })
    assert resp.status_code == 200, resp.text
    assert {(r["student_id"], r["outcome"]) for r in resp.json()["results"]} == {(s1.id, "unchanged"), (s2.id, "updated")}
    assert s3.id not in {r.student_id for r in records}  # never fabricated


async def test_mark_bulk_never_cascades_to_other_subjects_or_students(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    other = await factory.subject(faculty=c.faculty)
    await factory.class_schedule(subject=other, faculty=c.faculty, day_of_week="MONDAY", start_time="11:00",
                                 end_time="12:00", semester=c.semester, academic_year=2027, teacher=c.teacher)
    await db.commit()
    frozen_now(datetime(2027, 1, 11, 10, 30))
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY, "students": [{"student_id": c.students[0].id, "status": "present"}],
        "confirm_held": True,
    })
    assert resp.status_code == 200, resp.text
    total = (await db.execute(select(func.count(AttendanceRecord.id)).where(AttendanceRecord.date == MONDAY))).scalar()
    assert total == 1  # the old cascade wrote absences for every student x every subject


async def test_non_admin_cannot_write(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))
    student = c.students[0]
    payload = {"subject_id": c.subject.id, "date": DAY, "students": [{"student_id": student.id, "status": "present"}]}
    assert (await client.post("/api/attendance/mark-bulk", headers=auth_headers(student), json=payload)).status_code == 403
    assert (await client.post("/api/attendance/mark-bulk", headers=auth_headers(c.teacher), json=payload)).status_code == 403
    single = {"student_id": student.id, "subject_id": c.subject.id, "date": DAY, "status": "present"}
    assert (await client.post("/api/attendance", headers=auth_headers(student), json=single)).status_code == 403
    assert (await client.get("/api/attendance/sessions/unrecorded", headers=auth_headers(student))).status_code == 403
    count = (await db.execute(select(func.count(AttendanceRecord.id)))).scalar()
    assert count == 0


async def test_unrecorded_list_shows_past_scheduled_session(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    stranger = await factory.teacher(faculty=c.faculty)
    await db.commit()
    frozen_now(datetime(2027, 1, 11, 12, 0))
    session_id = await _materialize(client, auth_headers, admin, c.subject.id)

    url = f"/api/attendance/sessions/unrecorded?from={DAY}&to={DAY}"
    resp = await client.get(url, headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1 and isinstance(body["schedules_without_teacher"], int)
    item = body["sessions"][0]
    assert item["id"] == session_id and item["status"] == "scheduled" and item["kind"] == "regular"
    assert item["roster_size"] == 3 and item["recorded_count"] == 0
    assert item["teacher_id"] == c.teacher.id and item["teacher_name"] == c.teacher.user.full_name
    assert item["subject_name"] == c.subject.name and item["age_days"] == 0

    assert (await client.get(url, headers=auth_headers(c.teacher))).json()["total"] == 1
    assert (await client.get(url, headers=auth_headers(stranger))).json()["total"] == 0


async def test_cancelled_session_rejects_register_until_uncancelled(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))
    session_id = await _materialize(client, auth_headers, admin, c.subject.id)
    teacher_h = auth_headers(c.teacher)

    resp = await client.post(f"/api/attendance/sessions/{session_id}/cancel", headers=teacher_h, json={})
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "reason_required"
    resp = await client.post(f"/api/attendance/sessions/{session_id}/cancel", headers=teacher_h, json={"reason": "Teacher ill"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["session"]["status"] == "cancelled" and resp.json()["session"]["cancelled"] is True

    entries = {"entries": [{"student_id": c.students[0].id, "status": "present"}], "confirm_held": True}
    resp = await client.post(f"/api/attendance/sessions/{session_id}/register", headers=auth_headers(admin), json=entries)
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "session_cancelled"
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY, "students": [{"student_id": c.students[0].id, "status": "present"}]})
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "session_cancelled"
    assert (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() == 0

    resp = await client.post(f"/api/attendance/sessions/{session_id}/uncancel", headers=teacher_h, json={"reason": "Back"})
    assert resp.status_code == 200 and resp.json()["session"]["status"] == "scheduled"
    resp = await client.post(f"/api/attendance/sessions/{session_id}/register", headers=teacher_h, json=entries)
    assert resp.status_code == 200, resp.text
    assert resp.json()["session_status"] == "held" and resp.json()["results"][0]["outcome"] == "created"


async def test_single_write_on_unrecorded_session_needs_confirm_held(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 12, 0))
    body = {"student_id": c.students[0].id, "subject_id": c.subject.id, "date": DAY, "status": "present"}
    resp = await client.post("/api/attendance", headers=auth_headers(admin), json=body)
    assert resp.status_code == 409, resp.text
    detail = resp.json()["detail"]
    assert detail["code"] == "confirm_held" and detail["students_without_record"] == 2
    assert (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() == 0

    resp = await client.post("/api/attendance", headers=auth_headers(admin), json={**body, "confirm_held": True})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "present" and data["outcome"] == "created" and data["session_status"] == "held"
    session = await _session_row(db, c.subject.id)
    assert session.status == "held" and session.submitted_at is None  # single write, not a submission


async def test_roster_and_register_show_unmarked_as_null(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))
    s1, s2, _ = c.students
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY, "students": [{"student_id": s1.id, "status": "present"}],
        "confirm_held": True})
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/attendance/students-by-subject?faculty_id={c.faculty.id}&semester={c.semester}"
        f"&subject_id={c.subject.id}&date={DAY}", headers=auth_headers(c.teacher))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    rows = {r["id"]: r for r in body["students"]}
    assert len(rows) == 3 and body["session"]["status"] == "held" and body["session_id"] == body["session"]["id"]
    assert rows[s1.id]["status"] == "present" and rows[s1.id]["attendance_status"] == "present" and rows[s1.id]["record_id"]
    assert rows[s2.id]["status"] == "no_data" and rows[s2.id]["attendance_status"] is None and rows[s2.id]["record_id"] is None

    resp = await client.get(f"/api/attendance/sessions/{body['session_id']}/register", headers=auth_headers(c.teacher))
    assert resp.status_code == 200, resp.text
    register = {r["student_id"]: r for r in resp.json()["students"]}
    assert register[s1.id]["status"] == "present" and register[s1.id]["source"] == "admin"
    assert register[s2.id]["status"] is None and register[s2.id]["source"] is None
    stranger = await factory.teacher(faculty=c.faculty)
    await db.commit()
    resp = await client.get(f"/api/attendance/sessions/{body['session_id']}/register", headers=auth_headers(stranger))
    assert resp.status_code == 403


async def test_register_rejects_invalid_entries_without_writing(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    outsider = await factory.student(faculty=c.faculty, semester=c.semester + 1)
    await db.commit()
    frozen_now(datetime(2027, 1, 11, 10, 30))
    session_id = await _materialize(client, auth_headers, admin, c.subject.id)
    resp = await client.post(f"/api/attendance/sessions/{session_id}/register", headers=auth_headers(admin), json={
        "entries": [{"student_id": c.students[0].id, "status": "present"}, {"student_id": outsider.id, "status": "present"}]})
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert detail["code"] == "invalid_entries"
    assert [(e["student_id"], e["code"]) for e in detail["errors"]] == [(outsider.id, "not_enrolled")]
    assert (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() == 0


async def test_metrics_exclusion_toggle_is_audited_and_drives_summary(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))
    s1 = c.students[0]
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY, "students": [{"student_id": s1.id, "status": "present"}],
        "confirm_held": True})
    record_id = resp.json()["results"][0]["record_id"]

    summary = (await client.get("/api/attendance/summary", headers=auth_headers(s1))).json()
    assert summary["percentage"] == 100.0 and summary["percentage_present"] == 100.0 and summary["has_data"] is True
    assert summary["present"] == 1 and summary["total"] == 1 and summary["term_state"] == "active"
    assert summary["term"]["id"] == c.term.id and summary["eligible"] is True
    other = c.students[1]
    assert (await client.get(f"/api/attendance/summary?student_id={other.id}", headers=auth_headers(s1))).status_code == 403

    url = f"/api/attendance/records/{record_id}/metrics-exclusion"
    assert (await client.patch(url, headers=auth_headers(c.teacher), json={"excluded": True, "reason": "x"})).status_code == 403
    resp = await client.patch(url, headers=auth_headers(admin), json={"excluded": True})
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "reason_required"
    resp = await client.patch(url, headers=auth_headers(admin), json={"excluded": True, "reason": "Duplicate scan"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["excluded_from_metrics"] is True and resp.json()["exclusion_reason"]

    audit = await client.get(f"/api/attendance/records/{record_id}/audit", headers=auth_headers(c.teacher))
    assert audit.status_code == 200, audit.text
    entries = audit.json()
    assert [e["action"] for e in entries] == ["create", "metrics_exclusion"]
    assert entries[1]["reason"] == "Duplicate scan" and entries[1]["changed_by"] == admin.user_id
    assert entries[1]["changed_by_name"] == admin.user.full_name

    summary = (await client.get(f"/api/attendance/summary?student_id={s1.id}", headers=auth_headers(admin))).json()
    assert summary["has_data"] is False and summary["percentage"] is None and summary["percentage_present"] == 0
    breakdown = await client.get(f"/api/attendance/student-subject-breakdown/{s1.id}", headers=auth_headers(admin))
    assert breakdown.status_code == 200, breakdown.text
    subj = breakdown.json()["subjects"][0]
    assert subj["subject_id"] == c.subject.id and subj["attendance_percentage"] == 0 and subj["percentage"] is None


async def test_reads_calendar_list_and_legacy_auto_absent(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 11, 10, 30))
    s1, s2, _ = c.students
    resp = await client.post("/api/attendance/mark-bulk", headers=auth_headers(admin), json={
        "subject_id": c.subject.id, "date": DAY, "students": [{"student_id": s1.id, "status": "present"}],
        "confirm_held": True})
    record_id = resp.json()["results"][0]["record_id"]

    cal = await client.get("/api/attendance/calendar?year=2027&month=1", headers=auth_headers(s2))
    assert cal.status_code == 200, cal.text
    days = {d["date"]: d for d in cal.json()["calendar_data"]}
    assert len(days) == 31 and days[DAY]["total_classes"] == 1
    assert days[DAY]["status"] == "unrecorded" and days[DAY]["absent_count"] == 0  # no record: never "absent"
    assert days["2027-01-16"]["status"] == "weekly_off"  # Saturday
    assert (await client.get("/api/attendance/calendar?year=2027&month=1", headers=auth_headers(admin))).status_code == 403

    listing = (await client.get(f"/api/attendance?subject_id={c.subject.id}", headers=auth_headers(admin))).json()
    assert listing["total"] == 1
    row = listing["records"][0]
    assert row["status"] == "present" and row["source"] == "admin" and row["session_status"] == "held"
    assert row["is_cancelled"] is False and row["excluded_from_metrics"] is False
    own = (await client.get("/api/attendance", headers=auth_headers(s2))).json()
    assert own["total"] == 0  # students only see their own rows
    single = await client.get(f"/api/attendance/{record_id}", headers=auth_headers(s1))
    assert single.status_code == 200 and single.json()["session_id"] == row["session_id"]
    assert (await client.get(f"/api/attendance/{record_id}", headers=auth_headers(s2))).status_code == 403

    # legacy /attendance/auto-absent*: admin only; target_date is validated (no longer ignored)
    assert (await client.post("/api/attendance/auto-absent?target_date=2027-01-12", headers=auth_headers(s1))).status_code == 403
    resp = await client.post("/api/attendance/auto-absent?target_date=2027-01-12", headers=auth_headers(admin))
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "invalid_target_date"
    assert (await client.get("/api/attendance/auto-absent/stats", headers=auth_headers(s1))).status_code == 403
    stats = await client.get(f"/api/attendance/auto-absent/stats?target_date={DAY}", headers=auth_headers(admin))
    assert stats.status_code == 200 and stats.json()["success"] is True


async def test_unrecorded_endpoint_paginates_with_true_total(client, factory, db, auth_headers, frozen_now):
    c, admin = await _setup(factory, db)
    frozen_now(datetime(2027, 1, 25, 12, 0))
    for day in ("2027-01-11", "2027-01-18", "2027-01-25"):
        resp = await client.get(f"/api/attendance/sessions?date={day}&subject_id={c.subject.id}", headers=auth_headers(admin))
        assert resp.status_code == 200, resp.text
    url = "/api/attendance/sessions/unrecorded"
    page = (await client.get(f"{url}?limit=2", headers=auth_headers(admin))).json()
    assert [s["session_date"] for s in page["sessions"]] == ["2027-01-25", "2027-01-18"]
    assert (page["total"], page["limit"], page["offset"], page["has_more"]) == (3, 2, 0, True)
    assert "schedules_without_teacher" in page
    rest = (await client.get(f"{url}?limit=2&offset=2", headers=auth_headers(admin))).json()
    assert [s["session_date"] for s in rest["sessions"]] == ["2027-01-11"]
    assert (rest["total"], rest["offset"], rest["has_more"]) == (3, 2, False)
    default = (await client.get(url, headers=auth_headers(admin))).json()
    assert default["limit"] == 200 and default["total"] == 3 and len(default["sessions"]) == 3
    assert (await client.get(f"{url}?limit=1001", headers=auth_headers(admin))).status_code == 422
    assert (await client.get(f"{url}?offset=-1", headers=auth_headers(admin))).status_code == 422


async def test_attendance_list_is_scoped_to_teacher_cohorts(client, factory, db, auth_headers, frozen_now):
    """§10: a teacher reading GET /attendance only sees records of cohorts they teach."""
    mine = await factory.cohort(n_students=2, term_start=date(2027, 1, 4), term_end=date(2027, 5, 28),
                                days=("MONDAY",), start_time="09:00", end_time="10:00", academic_year=2027)
    other = await factory.cohort(n_students=2, term_start=None, days=("TUESDAY",), start_time="09:00",
                                 end_time="10:00", academic_year=2027)
    for s in mine.students:
        await factory.attendance_record(student=s, subject=mine.subject, date=date(2027, 1, 4), status="present")
    for s in other.students:
        await factory.attendance_record(student=s, subject=other.subject, date=date(2027, 1, 5), status="absent")
    idle_teacher = await factory.teacher()
    await db.commit()

    resp = await client.get("/api/attendance", headers=auth_headers(mine.teacher))
    assert resp.status_code == 200, resp.text
    seen = {int(r["studentId"]) for r in resp.json()["records"]}
    assert seen == {s.id for s in mine.students}

    resp = await client.get("/api/attendance", params={"student_id": other.students[0].id},
                            headers=auth_headers(mine.teacher))
    assert resp.status_code == 200 and resp.json()["records"] == []

    resp = await client.get("/api/attendance", headers=auth_headers(idle_teacher))
    assert resp.status_code == 200 and resp.json()["total"] == 0
