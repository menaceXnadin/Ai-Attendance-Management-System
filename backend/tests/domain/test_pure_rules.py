"""Pure rule functions (no DB): check-in window (§13.9), reasons (§13.8), confirm_held (§13.3),
percentage / eligibility / bands (§8, §13.12), streaks and calendar day classification (§8),
policy defaults (§2)."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.services.attendance_metrics import (
    Counts,
    classify_day,
    compute_streaks,
    day_flags_from_records,
    metrics_window,
    summarize_counts,
)
from app.services.attendance_policy import (
    AttendancePolicy,
    band_for,
    band_for_fraction,
    build_policy,
    display_percentage,
    eligible,
    percentage,
)
from app.services.attendance_recording import (
    compute_checkin_status,
    plan_entry,
    reason_required,
    requires_confirm_held,
)
from app.services.class_sessions import is_enrolled_for, is_session_finalizable, is_unrecorded
from app.services.term_service import Term

NPT = timezone(timedelta(hours=5, minutes=45))
D = date(2026, 3, 2)
POLICY = AttendancePolicy()  # opens 10 before, late after 10, closes 20 after start, grace 15


def t(hh, mm=0, ss=0, d=D):
    return datetime(d.year, d.month, d.day, hh, mm, ss, tzinfo=NPT)


# =============================================================== §13.9 check-in window


class TestCheckinWindow:
    START, END = t(9), t(10)

    @pytest.mark.parametrize("now,expected", [
        (t(8, 49, 59), (None, "window_not_open")),
        (t(8, 50), ("present", None)),          # exactly at open (inclusive)
        (t(9, 0), ("present", None)),
        (t(9, 10), ("present", None)),          # exactly start + late_after => still present
        (t(9, 10, 1), ("late", None)),
        (t(9, 19, 59), ("late", None)),
        (t(9, 20), (None, "window_closed")),     # start + closes_after is exclusive
        (t(9, 45), (None, "window_closed")),     # no late credit until the end of class
        (t(10, 0), (None, "window_closed")),     # at end
    ])
    def test_boundaries(self, now, expected):
        assert compute_checkin_status(now, self.START, self.END, POLICY) == expected

    def test_class_shorter_than_closes_after_closes_at_end(self):
        start, end = t(9), t(9, 15)
        assert compute_checkin_status(t(9, 14, 59), start, end, POLICY) == ("late", None)
        assert compute_checkin_status(t(9, 15), start, end, POLICY) == (None, "window_closed")

    def test_class_shorter_than_late_after(self):
        start, end = t(9), t(9, 5)
        assert compute_checkin_status(t(9, 4, 59), start, end, POLICY) == ("present", None)
        assert compute_checkin_status(t(9, 5), start, end, POLICY) == (None, "window_closed")

    def test_custom_policy_values(self):
        p = AttendancePolicy(checkin_opens_minutes_before=0, late_after_minutes=0, checkin_closes_after_minutes=5)
        assert compute_checkin_status(t(8, 59, 59), self.START, self.END, p) == (None, "window_not_open")
        assert compute_checkin_status(t(9, 0), self.START, self.END, p) == ("present", None)
        assert compute_checkin_status(t(9, 0, 1), self.START, self.END, p) == ("late", None)
        assert compute_checkin_status(t(9, 5), self.START, self.END, p) == (None, "window_closed")


# =============================================================== §13.8 reasons


class TestReasonRequired:
    @pytest.mark.parametrize("role,existing,new,within,changes,expected", [
        # new records
        ("teacher", None, "present", True, True, False),
        ("teacher", None, "absent", True, True, False),
        ("admin", None, "present", True, True, False),
        ("admin", None, "excused", True, True, True),            # (b) excused always
        ("admin", None, "present", False, True, True),           # (d) after teacher window
        # teacher overrides
        ("teacher", "system_auto", "present", True, True, False),
        ("teacher", "legacy", "present", True, True, False),
        ("teacher", "admin", "present", True, True, False),
        ("teacher", "teacher", "late", True, True, False),       # own records
        ("teacher", "student_face", "absent", True, True, True), # (a)
        # admin overrides
        ("admin", "teacher", "absent", True, True, True),        # (c)
        ("admin", "student_face", "absent", True, True, True),   # (a)
        ("admin", "system_auto", "present", True, True, False),
        ("admin", "legacy", "present", True, True, False),
        ("admin", "admin", "late", True, True, False),
        ("admin", "system_auto", "present", False, True, True),  # (d)
        ("admin", "excused_source_irrelevant", "excused", True, True, True),
    ])
    def test_matrix(self, role, existing, new, within, changes, expected):
        assert reason_required(role, existing, new, within, status_changes=changes) is expected

    def test_unchanged_face_record_needs_no_reason(self):
        # (a) is about *changing the status* of a student_face record
        assert reason_required("admin", "student_face", "present", True, status_changes=False) is False
        assert reason_required("admin", "teacher", "present", True, status_changes=False) is False


class TestPlanEntry:
    def plan(self, **kw):
        base = dict(student_id=1, actor_role="teacher", status="present", enrolled=True, existing_status=None,
                    existing_source=None, existing_exclusion_reason=None, within_window=True, reason=None)
        base.update(kw)
        return plan_entry(**base)

    def test_create(self):
        p = self.plan()
        assert p.ok and p.action == "create"

    def test_excused_is_admin_only(self):
        p = self.plan(status="excused", reason="medical")
        assert not p.ok and p.error_code == "excused_admin_only"
        p = self.plan(actor_role="admin", status="excused")
        assert not p.ok and p.error_code == "reason_required"
        assert self.plan(actor_role="admin", status="excused", reason="medical").ok

    def test_not_enrolled(self):
        p = self.plan(enrolled=False)
        assert not p.ok and p.error_code == "not_enrolled"

    @pytest.mark.parametrize("status", ["cancelled", "PRESENTX", "", None])
    def test_invalid_status(self, status):
        assert not self.plan(status=status).ok

    def test_same_value_is_unchanged(self):
        p = self.plan(existing_status="present", existing_source="student_face")
        assert p.ok and p.action == "unchanged"

    def test_face_override_requires_reason(self):
        p = self.plan(status="absent", existing_status="present", existing_source="student_face")
        assert p.error_code == "reason_required"
        assert self.plan(status="absent", existing_status="present", existing_source="student_face", reason="proxy").ok

    def test_teacher_overrides_system_auto_without_reason(self):
        p = self.plan(status="present", existing_status="absent", existing_source="system_auto")
        assert p.ok and p.action == "update"


class TestRequiresConfirmHeld:
    @pytest.mark.parametrize("status,submit,writes_held,past,confirm,expected", [
        ("scheduled", False, True, True, False, True),
        ("scheduled", False, True, True, True, False),    # confirmed
        ("scheduled", True, True, True, False, True),     # late register submission needs it too (§13.3 amended)
        ("scheduled", True, False, True, False, True),    # ... even with no present/late/absent entry
        ("scheduled", True, True, True, True, False),     # confirmed submission
        ("scheduled", True, True, False, False, False),   # submission during / just after class
        ("scheduled", False, True, False, False, False),  # before end + grace
        ("scheduled", False, False, True, False, False),  # excused-only writes never make it held
        ("held", False, True, True, False, False),        # already held
    ])
    def test_matrix(self, status, submit, writes_held, past, confirm, expected):
        assert requires_confirm_held(session_status=status, submit=submit, writes_held_status=writes_held,
                                     past_finalize_point=past, confirm_held=confirm) is expected


# =============================================================== §8 percentage / eligibility / bands


class TestPercentageEligibility:
    def test_no_data_is_null_never_zero(self):
        assert percentage(0, 0) is None
        assert display_percentage(0, 0) is None
        assert eligible(0, 0, 75) is None
        assert band_for_fraction(0, 0) is None

    def test_zero_attended_is_zero(self):
        assert percentage(0, 4) == 0.0
        assert eligible(0, 4, 75) is False

    def test_three_of_four_is_eligible_at_75(self):
        assert percentage(3, 4) == 75.0
        assert eligible(3, 4, 75) is True
        assert eligible(3, 4, 75.0) is True

    def test_74_999_is_not_eligible(self):
        assert eligible(74999, 100000, 75) is False

    def test_display_rounding_never_grants_eligibility(self):
        # 74.996% displays as 75.0 but is below the minimum
        assert display_percentage(18749, 25000) == 75.0
        assert eligible(18749, 25000, 75) is False

    def test_fractional_minimum_exact(self):
        # 2/3 = 66.666...% < 66.67%
        assert eligible(2, 3, 66.67) is False
        assert eligible(2, 3, 66.66) is True

    def test_display_two_decimals(self):
        assert display_percentage(1, 3) == 33.33
        assert display_percentage(2, 3) == 66.67


class TestBands:
    @pytest.mark.parametrize("pct,name", [
        (100, "excellent"), (90, "excellent"), (89.999, "good"), (85, "good"), (84.99, "warning"),
        (75, "warning"), (74.999, "critical"), (0, "critical"),
    ])
    def test_default_half_open(self, pct, name):
        assert band_for(pct).name == name

    def test_none(self):
        assert band_for(None) is None

    def test_exact_fraction_at_minimum_is_at_risk_not_critical(self):
        assert band_for_fraction(3, 4).name == "warning"
        assert band_for_fraction(74999, 100000).name == "critical"

    @pytest.mark.parametrize("minimum", [70.0, 80.0, 75.0, 60.0])
    def test_critical_upper_bound_equals_minimum(self, minimum):
        policy = build_policy({"attendance_minimum": {"percentage": minimum}})
        assert policy.minimum_percentage == minimum
        assert band_for(minimum, policy.bands).name != "critical"
        assert band_for(minimum - 0.001, policy.bands).name == "critical"
        # every value at/above minimum is outside critical; below is critical
        for pct in (minimum, minimum + 0.5, 99.0):
            assert band_for(pct, policy.bands).name != "critical"

    def test_minimum_above_good_band(self):
        policy = build_policy({"attendance_minimum": {"percentage": 88}})
        assert band_for(87.99, policy.bands).name == "critical"
        assert band_for(88, policy.bands).name != "critical"
        assert band_for(95, policy.bands).name == "excellent"

    def test_bands_from_threshold_rows_are_contiguous(self):
        rows = [
            {"name": "excellent", "min_percentage": 90, "is_active": True},
            {"name": "good", "min_percentage": 85, "is_active": True},
            {"name": "warning", "min_percentage": 75, "is_active": True},
            {"name": "critical", "min_percentage": 0, "is_active": True},
        ]
        policy = build_policy({"attendance_minimum": {"percentage": 75}}, rows)
        # the seed rows use max_percentage=89.99 etc.; half-open bands leave no gap at 89.995
        assert band_for(89.995, policy.bands).name == "good"
        assert band_for(84.995, policy.bands).name == "warning"


# =============================================================== §2 policy defaults


class TestPolicyDefaults:
    def test_defaults(self):
        p = build_policy({})
        assert p.minimum_percentage == 75.0
        assert p.weekly_off_days == frozenset({5})
        assert (p.checkin_opens_minutes_before, p.late_after_minutes, p.checkin_closes_after_minutes) == (10, 10, 20)
        assert p.finalize_grace_minutes == 15 and p.teacher_edit_window_days == 7
        assert p.late_counts_as_attended is True and p.exam_days_suspend_classes is True
        assert p.auto_absent_lookback_days == 7

    def test_calendar_types(self):
        assert build_policy({"academic_calendar_type": {"type": "nepal"}}).weekly_off_days == frozenset({5})
        assert build_policy({"academic_calendar_type": {"type": "international"}}).weekly_off_days == frozenset({5, 6})
        explicit = {"type": "nepal", "weekly_off_days": ["friday", "saturday"]}
        assert build_policy({"academic_calendar_type": explicit}).weekly_off_days == frozenset({4, 5})

    def test_invalid_values_fall_back(self):
        p = build_policy({"attendance_minimum": {"percentage": "abc"},
                          "attendance_policy": {"late_after_minutes": -5, "late_counts_as_attended": "maybe"}})
        assert p.minimum_percentage == 75.0 and p.late_after_minutes == 10 and p.late_counts_as_attended is True


# =============================================================== §8 summary block


class TestSummarizeCounts:
    def test_no_data(self):
        s = summarize_counts(Counts(), POLICY)
        assert s["percentage"] is None and s["has_data"] is False and s["eligible"] is None and s["band"] is None
        # legacy numeric fields stay numbers (§13.12)
        assert s["percentage_present"] == 0 and s["attendance_rate"] == 0 and s["attendance_percentage"] == 0
        assert s["total_classes"] == 0

    def test_total_classes_is_considered_plus_excused(self):
        s = summarize_counts(Counts(present=2, late=1, absent=1, excused=2, cancelled_sessions=3, unrecorded=1), POLICY)
        assert s["considered"] == 4 and s["attended"] == 3 and s["total_classes"] == 6
        assert s["percentage"] == 75.0 and s["eligible"] is True and s["band"] == "warning"
        assert s["eligibility_provisional"] is True

    def test_late_policy_toggle(self):
        c = Counts(present=1, late=1, absent=2)
        assert summarize_counts(c, AttendancePolicy(late_counts_as_attended=True))["percentage"] == 50.0
        assert summarize_counts(c, AttendancePolicy(late_counts_as_attended=False))["percentage"] == 25.0

    def test_excused_only_is_no_data(self):
        s = summarize_counts(Counts(excused=3), POLICY)
        assert s["percentage"] is None and s["has_data"] is False and s["total_classes"] == 3


# =============================================================== §8 streaks


def d(n):
    return date(2026, 3, 1) + timedelta(days=n)


class TestStreaks:
    def test_non_class_days_are_neutral(self):
        # gaps (weekends, holidays, days without class) neither break nor extend the streak
        assert compute_streaks([(d(1), True), (d(3), True), (d(8), True)]) == {"current": 3, "longest": 3}

    def test_absence_breaks(self):
        flags = [(d(1), True), (d(2), True), (d(3), False), (d(4), True)]
        assert compute_streaks(flags) == {"current": 1, "longest": 2}

    def test_order_independent(self):
        flags = [(d(4), True), (d(1), True), (d(3), False), (d(2), True)]
        assert compute_streaks(flags) == {"current": 1, "longest": 2}

    def test_empty(self):
        assert compute_streaks([]) == {"current": 0, "longest": 0}

    def test_day_attended_only_if_every_countable_record_attended(self):
        rows = [(d(1), "present"), (d(2), "present"), (d(2), "absent"), (d(3), "present")]
        flags = day_flags_from_records(rows, POLICY)
        assert flags == [(d(1), True), (d(2), False), (d(3), True)]
        assert compute_streaks(flags) == {"current": 1, "longest": 1}

    def test_late_policy(self):
        rows = [(d(1), "present"), (d(2), "late"), (d(3), "present")]
        on = compute_streaks(day_flags_from_records(rows, AttendancePolicy(late_counts_as_attended=True)))
        off = compute_streaks(day_flags_from_records(rows, AttendancePolicy(late_counts_as_attended=False)))
        assert on == {"current": 3, "longest": 3}
        assert off == {"current": 1, "longest": 1}


# =============================================================== §8 calendar classification


INSTR = {"instructional": True, "reason": None}


class TestClassifyDay:
    TODAY = date(2026, 3, 10)

    def c(self, day=date(2026, 3, 9), info=INSTR, countable=(), excused=0, sessions=(), policy=POLICY):
        return classify_day(day, today=self.TODAY, day_info=info, countable_statuses=list(countable),
                            excused_count=excused, session_statuses=list(sessions), policy=policy)

    def test_present_absent_partial(self):
        assert self.c(countable=["present", "late"], sessions=["held", "held"]) == "present"
        assert self.c(countable=["absent", "absent"], sessions=["held", "held"]) == "absent"
        assert self.c(countable=["present", "absent"], sessions=["held", "held"]) == "partial"

    def test_late_when_late_does_not_count(self):
        p = AttendancePolicy(late_counts_as_attended=False)
        assert self.c(countable=["late"], sessions=["held"], policy=p) != "present"

    def test_excused(self):
        assert self.c(excused=1, sessions=["held"]) == "excused"

    def test_non_instructional_reasons(self):
        for reason in ("holiday", "weekly_off", "exam", "between_terms"):
            assert self.c(info={"instructional": False, "reason": reason}) == reason

    def test_future(self):
        assert self.c(day=date(2026, 3, 12), sessions=["scheduled"]) == "future"

    def test_cancelled(self):
        assert self.c(sessions=["cancelled", "cancelled"]) == "cancelled"

    def test_unrecorded(self):
        assert self.c(sessions=["scheduled"]) == "unrecorded"
        assert self.c(sessions=["cancelled", "scheduled"]) == "unrecorded"

    def test_no_class(self):
        assert self.c() == "no_class"


# =============================================================== small pure helpers


class TestSessionPredicates:
    NOW = t(10, 15)

    def test_unrecorded_requires_scheduled_and_past_grace(self):
        assert is_unrecorded("scheduled", D, time(10), t(10, 15, 1), 15) is True
        assert is_unrecorded("scheduled", D, time(10), t(10, 15), 15) is False  # strictly after end + grace
        assert is_unrecorded("held", D, time(10), t(12), 15) is False
        assert is_unrecorded("cancelled", D, time(10), t(12), 15) is False

    def test_finalizable(self):
        kw = dict(finalized_at=None, session_date=D, end_time=time(10), now=t(10, 15), grace_minutes=15, in_active_term=True)
        assert is_session_finalizable(status="held", **kw) is True  # end + grace <= now
        assert is_session_finalizable(status="scheduled", **kw) is False
        assert is_session_finalizable(status="cancelled", **kw) is False
        assert is_session_finalizable(status="held", **{**kw, "now": t(10, 14, 59)}) is False
        assert is_session_finalizable(status="held", **{**kw, "in_active_term": False}) is False
        assert is_session_finalizable(status="held", **{**kw, "finalized_at": t(11)}) is False
        assert is_session_finalizable(status="held", review_required=True, **kw) is False
        assert is_session_finalizable(status="held", blocked_by_event=True, **kw) is False

    def test_enrollment(self):
        base = dict(student_faculty_id=1, student_semester=1, user_active=True, enrollment_start=date(2026, 3, 2),
                    cohort_since=None, session_faculty_id=1, session_semester=1, session_date=date(2026, 3, 2))
        assert is_enrolled_for(**base) is True
        assert is_enrolled_for(**{**base, "session_date": date(2026, 3, 1)}) is False
        assert is_enrolled_for(**{**base, "cohort_since": date(2026, 3, 3)}) is False
        assert is_enrolled_for(**{**base, "cohort_since": date(2026, 1, 1)}) is True
        assert is_enrolled_for(**{**base, "user_active": False}) is False
        assert is_enrolled_for(**{**base, "student_semester": 2}) is False


class TestMetricsWindow:
    TERM = Term(id=1, name="T", start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))

    def test_clipped_to_enrollment_and_as_of(self):
        assert metrics_window(self.TERM, date(2026, 2, 1), date(2026, 3, 10)) == (date(2026, 2, 1), date(2026, 3, 10))
        assert metrics_window(self.TERM, date(2025, 1, 1), date(2026, 9, 1)) == (date(2026, 1, 5), date(2026, 5, 29))

    def test_empty(self):
        assert metrics_window(None, None, date(2026, 3, 1)) is None
        assert metrics_window(self.TERM, date(2026, 4, 1), date(2026, 3, 1)) is None
