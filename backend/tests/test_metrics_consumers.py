"""Metrics consumers agree with the metrics service (DOMAIN_RULES §8, §13.5, §13.7, §13.12).

One cohort, one term (2025-01-06 .. 2025-05-26), clock frozen at Fri 2025-02-14 12:00.
Student A (enrolled 2025-01-10) has:

  S0 01-08 held       absent   -> before enrollment: never counts
  S1 01-13 held       present
  S2 01-15 held       late     -> attended (late_counts_as_attended)
  S3 01-20 held       absent
  S4 01-22 held       excused  -> not considered, reported as excused
  S5 01-27 cancelled  present  -> cancelled session: never counts
  S6 01-29 scheduled  (none)   -> unrecorded
  S7 02-03 scheduled  absent system_auto, excluded (legacy_unheld_session) -> unrecorded
  S8 02-05 held       present
  S9 02-10 held       absent, excluded (recorded_before_class) -> never counts
  S10 02-17 scheduled (future) -> neither unrecorded nor counted
  holiday 01-31 (faculty-wide)

=> considered 4, attended 3, 75.00 % (exactly the 75 % minimum -> eligible, "warning" band),
   excused 1, cancelled 1, unrecorded 2, streak current 1 / longest 2.
Student B (enrolled 2025-01-06) has no records: percentage null, legacy numbers 0.
"""
from __future__ import annotations

import json
from datetime import date, datetime, time

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration

NOW = datetime(2025, 2, 14, 12, 0)
EXPECTED_A = {
    "percentage": 75.0,
    "has_data": True,
    "considered": 4,
    "attended": 3,
    "present": 2,
    "late": 1,
    "absent": 1,
    "excused": 1,
    "cancelled_sessions": 1,
    "unrecorded": 2,
    "eligible": True,
    "eligibility_provisional": True,
    "band": "warning",
}
EMPTY_B = {
    "percentage": None,
    "has_data": False,
    "considered": 0,
    "attended": 0,
    "excused": 0,
    "unrecorded": 2,
    "cancelled_sessions": 1,
    "eligible": None,
    "band": None,
}


def assert_block(block: dict, expected: dict, where: str = "") -> None:
    for key, value in expected.items():
        assert key in block, f"{where}: missing {key!r} in {sorted(block)}"
        assert block[key] == value, f"{where}: {key}={block[key]!r}, expected {value!r}"


async def _session(factory, cohort, d: date, status: str):
    return await factory.insert("class_sessions", {
        "subject_id": cohort.subject.id,
        "faculty_id": cohort.faculty.id,
        "semester": cohort.semester,
        "term_id": cohort.term.id,
        "session_date": d,
        "start_time": time(9, 0),
        "end_time": time(10, 0),
        "teacher_id": cohort.teacher.id,
        "status": status,
        "kind": "regular",
    })


async def _record(factory, cohort, student, session, status, *, source="teacher", excluded=False, reason=None):
    return await factory.attendance_record(
        student=student, subject=cohort.subject, date=session.session_date, status=status,
        method="other" if source == "system_auto" else "manual",
        location="AUTO_ABSENT_SYSTEM" if source == "system_auto" else None,
        session_id=session.id, source=source, excluded_from_metrics=excluded, exclusion_reason=reason,
    )


async def _pin_tracking_start(db, value: str) -> None:
    """The migration writes the real migration date as ``tracking_start_date``; sessions before it
    are legacy and never "unrecorded" (amended §5.2/§13.4). Pin it before this 2025 scenario."""
    exists = (await db.execute(text("SELECT 1 FROM system_settings WHERE key = 'attendance_policy'"))).first()
    patch = json.dumps({"tracking_start_date": value})
    if exists is None:
        await db.execute(text("INSERT INTO system_settings (key, value, category, data_type, is_active) "
                              "VALUES ('attendance_policy', CAST(:v AS jsonb), 'attendance', 'json', true)"), {"v": patch})
    else:
        await db.execute(text("UPDATE system_settings SET value = value || CAST(:v AS jsonb) "
                              "WHERE key = 'attendance_policy'"), {"v": patch})


@pytest.fixture
async def scenario(db, factory, frozen_now):
    frozen_now(NOW)
    await _pin_tracking_start(db, "2024-12-01")
    cohort = await factory.cohort(n_students=0, term_start=date(2025, 1, 6))
    a = await factory.student(faculty=cohort.faculty, semester=cohort.semester, enrolled_on=date(2025, 1, 10))
    b = await factory.student(faculty=cohort.faculty, semester=cohort.semester, enrolled_on=date(2025, 1, 6))
    admin = await factory.admin()
    s = {}
    for key, d, status in [
        ("S0", date(2025, 1, 8), "held"), ("S1", date(2025, 1, 13), "held"), ("S2", date(2025, 1, 15), "held"),
        ("S3", date(2025, 1, 20), "held"), ("S4", date(2025, 1, 22), "held"), ("S5", date(2025, 1, 27), "cancelled"),
        ("S6", date(2025, 1, 29), "scheduled"), ("S7", date(2025, 2, 3), "scheduled"), ("S8", date(2025, 2, 5), "held"),
        ("S9", date(2025, 2, 10), "held"), ("S10", date(2025, 2, 17), "scheduled"),
    ]:
        s[key] = await _session(factory, cohort, d, status)
    await _record(factory, cohort, a, s["S0"], "absent")
    await _record(factory, cohort, a, s["S1"], "present")
    await _record(factory, cohort, a, s["S2"], "late", source="student_face")
    await _record(factory, cohort, a, s["S3"], "absent")
    await _record(factory, cohort, a, s["S4"], "excused", source="admin")
    await _record(factory, cohort, a, s["S5"], "present")
    await _record(factory, cohort, a, s["S7"], "absent", source="system_auto", excluded=True, reason="legacy_unheld_session")
    await _record(factory, cohort, a, s["S8"], "present")
    await _record(factory, cohort, a, s["S9"], "absent", source="legacy", excluded=True, reason="recorded_before_class")
    await factory.holiday(start_date=date(2025, 1, 31), faculty=cohort.faculty)
    return type("Scenario", (), {"cohort": cohort, "a": a, "b": b, "admin": admin, "sessions": s})


async def _get(client, url, headers):
    resp = await client.get(url, headers=headers)
    assert resp.status_code == 200, f"{url}: {resp.status_code} {resp.text[:500]}"
    return resp.json()


async def test_service_baseline(scenario, db):
    from app.services.attendance_metrics import compute_student_metrics

    m = await compute_student_metrics(db, scenario.a.id)
    assert_block(m.overall, EXPECTED_A, "service")
    assert m.overall["total_classes"] == 5 and m.overall["attendance_percentage"] == 75.0
    assert m.streak == {"current": 1, "longest": 2}
    assert m.term_state == "active" and m.term_context.term.id == scenario.cohort.term.id


async def test_student_endpoints_report_the_same_numbers(scenario, client, auth_headers):
    h = auth_headers(scenario.a)
    sid = scenario.a.id
    term_id = scenario.cohort.term.id

    ins = await _get(client, f"/api/analytics/student-insights/{sid}", h)
    assert_block(ins, EXPECTED_A, "insights(top)")
    assert ins["term"]["id"] == term_id and ins["term_state"] == "active"
    att = ins["attendance"]
    assert (att["percentage"], att["totalClasses"], att["attendedClasses"], att["absentClasses"],
            att["lateClasses"], att["excusedClasses"]) == (75.0, 5, 3, 1, 1, 1)
    assert ins["riskLevel"] == "high"  # at-risk band (floor = minimum)
    assert ins["subjects"][0]["attendance_percentage"] == 75.0

    summ = await _get(client, f"/api/student-calendar/{sid}/summary", h)
    assert_block(summ, EXPECTED_A, "calendar summary(top)")
    st = summ["statistics"]
    assert (st["attendance_rate"], st["total_classes"], st["present"], st["late"], st["absent"]) == (75.0, 5, 2, 1, 1)
    assert (st["days_present"], st["days_absent"], st["days_partial"], st["days_with_classes"]) == (3, 1, 0, 4)
    assert summ["period"]["start_date"] == "2025-01-10" and summ["period"]["end_date"] == "2025-02-14"

    streaks = await _get(client, "/api/streaks-badges/my-streaks", h)
    assert_block(streaks, EXPECTED_A, "streaks")
    assert (streaks["current_streak"], streaks["longest_streak"], streaks["is_streak_active"]) == (1, 2, True)
    assert (streaks["total_class_days"], streaks["total_present_days"], streaks["attendance_rate"]) == (4, 3, 75.0)
    assert [d["streak_at_day"] for d in streaks["streak_history"]] == [1, 2, 0, 1]

    badges = await _get(client, "/api/streaks-badges/my-badges", h)
    assert [b["id"] for b in badges["badges"]] == ["passing_attendance"]
    assert badges["percentage"] == 75.0 and badges["streak_summary"]["current_streak"] == 1

    acad = await _get(client, "/api/academic-metrics/current-semester", h)
    assert acad["semester_info"]["id"] == term_id
    assert acad["semester_info"]["name"] == scenario.cohort.term.semester_name
    assert (acad["semester_info"]["start_date"], acad["semester_info"]["end_date"]) == ("2025-01-06", "2025-05-26")
    assert_block(acad["data"], EXPECTED_A, "academic-metrics data")
    assert acad["data"]["attendance"]["percentage"] == 75.0 and acad["term_state"] == "active"
    assert acad["data"]["total_periods"] > 0  # timetable Mon/Wed in the term

    spec = await _get(client, "/api/session-metrics/student-specific?start_date=2025-01-06&end_date=2025-05-26", h)
    assert spec["attendance_percentage"] == 75.0 and spec["attended_classes"] == 3
    assert_block(spec, EXPECTED_A, "session-metrics")


async def test_calendar_month_days_and_statistics(scenario, client, auth_headers):
    cal = await _get(client, "/api/student-calendar/me?year=2025&month=1", auth_headers(scenario.a))
    days = {d["date"]: d for d in cal["calendar_days"]}
    assert len(days) == 31
    expected = {
        "2025-01-02": "between_terms", "2025-01-11": "weekly_off", "2025-01-13": "present",
        "2025-01-14": "no_class", "2025-01-15": "present", "2025-01-20": "absent", "2025-01-22": "excused",
        "2025-01-27": "cancelled", "2025-01-29": "unrecorded", "2025-01-31": "holiday",
    }
    assert {k: days[k]["status"] for k in expected} == expected
    assert days["2025-01-15"]["late"] == 1 and days["2025-01-22"]["excused"] == 1
    assert [r["countable"] for r in days["2025-01-27"]["records"]] == [False]  # record kept, session cancelled

    st = cal["statistics"]  # month window 01-10..01-31: S1 present, S2 late, S3 absent
    assert (st["considered"], st["attended"], st["percentage"], st["attendance_rate"]) == (3, 2, 66.67, 66.67)
    assert (st["excused"], st["cancelled_sessions"], st["unrecorded"], st["total_classes"]) == (1, 1, 1, 4)
    assert (st["days_present"], st["days_absent"], st["days_partial"]) == (2, 1, 0)
    assert (st["current_streak"], st["longest_streak"]) == (1, 2)  # term streak, month-invariant
    assert_block(cal["term_statistics"], EXPECTED_A, "calendar term_statistics")
    assert cal["subject_breakdown"][0]["attendance_rate"] == 66.67

    feb = await _get(client, "/api/student-calendar/me?year=2025&month=2", auth_headers(scenario.a))
    fdays = {d["date"]: d["status"] for d in feb["calendar_days"]}
    assert fdays["2025-02-05"] == "present" and fdays["2025-02-17"] == "future" and fdays["2025-02-15"] == "weekly_off"


async def test_admin_aggregates_match(scenario, client, auth_headers):
    h = auth_headers(scenario.admin)
    top = await _get(client, "/api/analytics/top-performers?min_classes=1", h)
    row = next(p for p in top["top_performers"] if p["id"] == scenario.a.id)
    assert (row["attendance_rate"], row["present_count"], row["late_count"], row["absent_count"]) == (75.0, 2, 1, 1)
    assert row["eligible"] is True and row["risk_level"] == "high"
    assert all(p["id"] != scenario.b.id for p in top["top_performers"])  # no data -> below min_classes

    avg = await _get(client, "/api/analytics/class-averages", h)
    assert (avg["averageAttendance"], avg["considered"], avg["attended"]) == (75.0, 4, 3)

    subj = await _get(client, "/api/analytics/subject-wise", h)
    srow = next(s for s in subj["subjects"] if s["subject_id"] == scenario.cohort.subject.id)
    assert (srow["attendance_rate"], srow["considered"], srow["unique_students"], srow["held_sessions"]) == (75.0, 4, 1, 7)

    board = await _get(client, "/api/streaks-badges/leaderboard", h)
    entry = next(e for e in board["leaderboard"] if e["student_id"] == scenario.a.id)
    assert (entry["current_streak"], entry["longest_streak"]) == (1, 2)

    streak_a = await _get(client, f"/api/streaks-badges/{scenario.a.id}/streaks", h)
    assert streak_a["percentage"] == 75.0

    weekly = await _get(client, "/api/analytics/weekly-breakdown?days=14", h)
    feb5 = next(d for d in weekly["breakdown"] if d["date"] == "2025-02-05")
    feb10 = next(d for d in weekly["breakdown"] if d["date"] == "2025-02-10")
    assert (feb5["present"], feb5["total"], feb5["percentage"]) == (1, 1, 100.0)
    assert (feb10["total"], feb10["percentage"], feb10["has_data"]) == (0, 0, False)  # excluded record

    sidebar = await _get(client, "/api/sidebar/stats", h)
    assert sidebar["attendance_rate"] == 0 and sidebar["has_data"] is False  # nothing recorded today

    details = await _get(client, "/api/attendance-with-details/", h)
    assert details["total_records"] == 9


async def test_no_data_student_is_null_safe_and_unknown_risk(scenario, client, auth_headers):
    h = auth_headers(scenario.b)
    sid = scenario.b.id
    ins = await _get(client, f"/api/analytics/student-insights/{sid}", h)
    assert_block(ins, EMPTY_B, "insights B")
    assert ins["attendance"]["percentage"] == 0 and ins["attendance"]["totalClasses"] == 0
    assert ins["riskLevel"] == "unknown"  # never "critical" for no data

    summ = await _get(client, f"/api/student-calendar/{sid}/summary", h)
    assert summ["statistics"]["attendance_rate"] == 0 and summ["percentage"] is None

    streaks = await _get(client, "/api/streaks-badges/my-streaks", h)
    assert (streaks["current_streak"], streaks["longest_streak"], streaks["streak_history"]) == (0, 0, [])
    assert streaks["percentage"] is None and streaks["attendance_rate"] == 0
    badges = await _get(client, "/api/streaks-badges/my-badges", h)
    assert badges["badges"] == []

    acad = await _get(client, "/api/academic-metrics/current-semester", h)
    assert acad["data"]["percentage"] is None and acad["data"]["eligible"] is None


async def test_band_and_eligibility_follow_policy(scenario, client, auth_headers, db):
    await db.execute(text(
        "UPDATE system_settings SET value = '{\"percentage\": 80.0}'::jsonb WHERE key = 'attendance_minimum'"
    ))
    h = auth_headers(scenario.a)
    ins = await _get(client, f"/api/analytics/student-insights/{scenario.a.id}", h)
    assert (ins["percentage"], ins["eligible"], ins["band"], ins["riskLevel"]) == (75.0, False, "critical", "critical")
    assert ins["minimum_percentage"] == 80.0
    summ = await _get(client, f"/api/student-calendar/{scenario.a.id}/summary", h)
    assert (summ["eligible"], summ["band"]) == (False, "critical")
    badges = await _get(client, "/api/streaks-badges/my-badges", h)
    assert badges["badges"] == []  # below the policy minimum: no attendance badge


async def test_between_terms_reports_previous_term(scenario, client, auth_headers, frozen_now):
    frozen_now(datetime(2025, 6, 10, 9, 0))
    h = auth_headers(scenario.a)
    ins = await _get(client, f"/api/analytics/student-insights/{scenario.a.id}", h)
    assert ins["term_state"] == "between_terms" and ins["term"]["id"] == scenario.cohort.term.id
    assert ins["percentage"] == 75.0
    acad = await _get(client, "/api/academic-metrics/current-semester", h)
    assert acad["term_state"] == "between_terms" and acad["semester_info"]["is_current"] is False
    assert acad["semester_info"]["name"] == scenario.cohort.term.semester_name


async def test_no_terms_never_errors(scenario, client, auth_headers, db):
    await db.execute(text("UPDATE semester_configurations SET is_active = false"))
    h = auth_headers(scenario.a)
    ins = await _get(client, f"/api/analytics/student-insights/{scenario.a.id}", h)
    assert (ins["term_state"], ins["term"], ins["percentage"], ins["riskLevel"]) == ("no_terms", None, None, "unknown")
    acad = await _get(client, "/api/academic-metrics/current-semester", h)
    assert acad["term"] is None and acad["data"]["total_periods"] == 0
    summ = await _get(client, f"/api/student-calendar/{scenario.a.id}/summary", h)
    assert summ["statistics"]["attendance_rate"] == 0 and summ["has_data"] is False
    streaks = await _get(client, "/api/streaks-badges/my-streaks", h)
    assert streaks["current_streak"] == 0 and streaks["start_date"] is None
    cal = await _get(client, "/api/student-calendar/me?year=2025&month=1", h)
    assert {d["status"] for d in cal["calendar_days"]} <= {"between_terms", "present", "absent", "partial", "excused", "cancelled", "unrecorded"}


async def test_other_touched_endpoints_respond(scenario, client, auth_headers):
    admin, student = auth_headers(scenario.admin), auth_headers(scenario.a)
    rng = "start_date=2025-01-06&end_date=2025-05-26"
    for url, h in [
        ("/api/analytics/insights", admin),
        ("/api/analytics/dashboard-summary", admin),
        ("/api/analytics/attendance-trends?days=60", student),
        (f"/api/session-metrics/comprehensive?{rng}&student_id={scenario.a.id}", student),
        (f"/api/session-metrics/deviation-summary?{rng}", admin),
        (f"/api/session-metrics/attendance-with-deviation?{rng}", student),
        (f"/api/academic-metrics/calculate?{rng}&faculty_id={scenario.cohort.faculty.id}&semester=1", admin),
        (f"/api/academic-metrics/detailed-breakdown?{rng}", admin),
        (f"/api/academic-metrics/summary?{rng}", admin),
        (f"/api/academic-metrics/validate-data?{rng}", admin),
        ("/api/academic-metrics/current-semester", admin),
        ("/api/streaks-badges/leaderboard", student),
        ("/api/dashboard/stats", admin),
        ("/api/realtime/metrics", admin),
        ("/api/student-performance/", student),
    ]:
        await _get(client, url, h)

    summary = await _get(client, "/api/analytics/dashboard-summary", admin)
    for key in ("today", "this_week", "this_month"):
        block = summary[key]
        assert {"band", "band_label", "eligible", "eligibility_provisional", "considered"} <= block.keys()
        assert block["considered"] == block["total_records"]
        if not block["has_data"]:
            # No countable records: no percentage, no band and no eligibility, never a fake 0%.
            assert block["percentage"] is None and block["band"] is None and block["eligible"] is None

    trends = await _get(client, "/api/analytics/attendance-trends?days=60", student)
    assert [t["date"] for t in trends] == ["2025-01-13", "2025-01-15", "2025-01-20", "2025-02-05"]
    dev = await _get(client, f"/api/session-metrics/attendance-with-deviation?{rng}", student)
    assert (dev["percentage"], dev["present_days"], dev["total_days_used"]) == (75.0, 3, 4)
    comp = await _get(client, f"/api/session-metrics/comprehensive?{rng}&student_id={scenario.a.id}", student)
    assert comp["actual"]["sessions"] == {"held": 7, "cancelled": 1, "unrecorded": 2, "upcoming": 1}
    assert comp["student_metrics"]["percentage"] == 75.0 and comp["recommended"]["method"] == "actual"
    calc = await _get(client, f"/api/academic-metrics/calculate?{rng}&faculty_id={scenario.cohort.faculty.id}&semester=1", admin)
    # Mon/Wed timetable, Jan 06..May 26 (the 01-31 holiday is a Friday): 21 Mondays + 20 Wednesdays
    assert calc["data"]["total_periods"] == 41 and calc["data"]["total_academic_days"] == 41


async def test_other_students_calendar_is_forbidden(scenario, client, auth_headers):
    resp = await client.get(f"/api/student-calendar/{scenario.a.id}/summary", headers=auth_headers(scenario.b))
    assert resp.status_code == 403
    resp = await client.get(f"/api/student-calendar/{scenario.a.id}?year=2025&month=1", headers=auth_headers(scenario.b))
    assert resp.status_code == 403
