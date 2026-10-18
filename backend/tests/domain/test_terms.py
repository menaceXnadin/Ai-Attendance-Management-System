"""Terms (DOMAIN_RULES §3, §3.2, §3.3, §13.12 term_state)."""
from __future__ import annotations

from datetime import date

import pytest

from app.services.domain_errors import DomainError
from app.services.term_service import (
    assert_term_deletable,
    assert_term_valid,
    get_current_term,
    get_reporting_term,
    get_term_context,
    get_term_for_date,
    validate_term_fields,
)

from .conftest import MON, SAT, TERM_END, TERM_START, at, insert_session, sessions_on

pytestmark = pytest.mark.integration


# ----------------------------------------------------------------------------- validation


class TestTermValidation:
    def codes(self, **kw):
        return {e["code"] for e in validate_term_fields(**kw)}

    def test_end_must_be_after_start(self):
        assert "end_not_after_start" in self.codes(start_date=date(2026, 3, 1), end_date=date(2026, 3, 1))
        assert "end_not_after_start" in self.codes(start_date=date(2026, 3, 2), end_date=date(2026, 3, 1))
        assert not self.codes(start_date=date(2026, 3, 1), end_date=date(2026, 3, 2))

    def test_exam_window_inside_term(self):
        base = dict(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        assert "exam_window_outside_term" in self.codes(**base, exam_week_start=date(2026, 5, 25), exam_week_end=date(2026, 6, 2))
        assert "exam_end_before_start" in self.codes(**base, exam_week_start=date(2026, 5, 20), exam_week_end=date(2026, 5, 18))
        assert "exam_window_incomplete" in self.codes(**base, exam_week_start=date(2026, 5, 20))
        assert not self.codes(**base, exam_week_start=date(2026, 5, 18), exam_week_end=date(2026, 5, 29))

    def test_academic_year_sane(self):
        base = dict(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        assert "academic_year_out_of_range" in self.codes(**base, academic_year=1999)
        assert "academic_year_out_of_range" in self.codes(**base, academic_year=2101)
        assert not self.codes(**base, academic_year=2082)  # a Bikram Sambat label is legal


class TestTermOverlap:
    async def test_overlapping_active_term_rejected(self, db, factory):
        existing = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        with pytest.raises(DomainError) as exc:
            await assert_term_valid(db, start_date=date(2026, 5, 1), end_date=date(2026, 9, 30))
        assert exc.value.code == "term_invalid"
        overlap = [e for e in exc.value.details["errors"] if e["code"] == "overlaps_active_term"]
        assert overlap and overlap[0]["term_ids"] == [existing.id]

    async def test_shared_boundary_day_is_an_overlap(self, db, factory):
        await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        with pytest.raises(DomainError):
            await assert_term_valid(db, start_date=date(2026, 5, 29), end_date=date(2026, 9, 30))

    async def test_adjacent_term_allowed(self, db, factory):
        await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        await assert_term_valid(db, start_date=date(2026, 5, 30), end_date=date(2026, 9, 30))

    async def test_inactive_terms_do_not_block(self, db, factory):
        await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29), is_active=False)
        await assert_term_valid(db, start_date=date(2026, 2, 1), end_date=date(2026, 6, 30))

    async def test_update_excludes_itself(self, db, factory):
        term = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        await assert_term_valid(db, start_date=date(2026, 1, 5), end_date=date(2026, 6, 15), exclude_id=term.id)

    async def test_containing_term_rejected(self, db, factory):
        await factory.term(start_date=date(2026, 2, 1), end_date=date(2026, 3, 1))
        with pytest.raises(DomainError):
            await assert_term_valid(db, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))


# ----------------------------------------------------------------------------- resolution


class TestTermResolution:
    async def test_between_terms_is_none_no_month_guessing(self, db, factory, frozen_now):
        spring = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        await factory.term(start_date=date(2026, 9, 14), end_date=date(2026, 12, 31))
        frozen_now(at(date(2026, 7, 15), 10))  # a "fall-ish" month, but no term contains it
        assert await get_current_term(db) is None
        assert await get_term_for_date(db, date(2026, 7, 15)) is None
        reporting = await get_reporting_term(db)
        assert reporting is not None and reporting.id == spring.id
        ctx = await get_term_context(db)
        assert ctx.state == "between_terms" and ctx.term.id == spring.id and ctx.current_term is None

    async def test_no_terms_at_all(self, db, frozen_now):
        frozen_now(at(date(2026, 3, 2), 10))
        assert await get_current_term(db) is None
        ctx = await get_term_context(db)
        assert ctx.state == "no_terms" and ctx.term is None

    async def test_inactive_term_is_never_current(self, db, factory, frozen_now):
        await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29), is_active=False)
        frozen_now(at(date(2026, 3, 2), 10))
        assert await get_current_term(db) is None

    async def test_is_current_column_ignored(self, db, factory, frozen_now):
        stale = await factory.term(start_date=date(2025, 1, 6), end_date=date(2025, 5, 30), is_current=True)
        real = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29), is_current=False)
        frozen_now(at(date(2026, 3, 2), 10))
        current = await get_current_term(db)
        assert current.id == real.id and current.id != stale.id

    async def test_term_boundaries_inclusive(self, db, factory):
        term = await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        assert (await get_term_for_date(db, date(2026, 1, 5))).id == term.id
        assert (await get_term_for_date(db, date(2026, 5, 29))).id == term.id
        assert await get_term_for_date(db, date(2026, 1, 4)) is None
        assert await get_term_for_date(db, date(2026, 5, 30)) is None

    async def test_explicit_term_id(self, db, factory, frozen_now):
        old = await factory.term(start_date=date(2025, 1, 6), end_date=date(2025, 5, 30))
        await factory.term(start_date=date(2026, 1, 5), end_date=date(2026, 5, 29))
        frozen_now(at(date(2026, 3, 2), 10))
        ctx = await get_term_context(db, term_id=old.id)
        assert ctx.term.id == old.id and ctx.state == "active"
        with pytest.raises(DomainError) as exc:
            await get_term_context(db, term_id=987654)
        assert exc.value.code == "term_not_found"


class TestTermDelete:
    async def test_term_with_sessions_cannot_be_hard_deleted(self, db, env, factory):
        from app.services.term_service import get_term_by_id

        term = await get_term_by_id(db, env.term.id)
        await assert_term_deletable(db, term)  # empty term: deletable
        await insert_session(factory, subject=env.subject, faculty=env.faculty, session_date=MON)
        with pytest.raises(DomainError) as exc:
            await assert_term_deletable(db, term)
        assert exc.value.code == "term_in_use"


# ----------------------------------------------------------------------------- instruction window


class TestInstructionWindow:
    async def test_exam_window_suspends_sessions(self, db, factory, frozen_now):
        from app.services.class_sessions import materialize_sessions
        from app.services.instructional_calendar import day_status, expected_sessions

        from .conftest import patch_policy

        await patch_policy(db, tracking_start_date=date(2025, 1, 1))
        fac = await factory.faculty()
        subj = await factory.subject(faculty=fac)
        await factory.term(start_date=TERM_START, end_date=TERM_END, exam_week_start=date(2026, 5, 18),
                           exam_week_end=date(2026, 5, 29))
        await factory.class_schedule(subject=subj, faculty=fac, day_of_week="MONDAY")
        exam_monday, normal_monday = date(2026, 5, 18), date(2026, 5, 11)
        assert await expected_sessions(db, exam_monday, faculty_id=fac.id) == []
        assert len(await expected_sessions(db, normal_monday, faculty_id=fac.id)) == 1
        assert (await day_status(db, exam_monday, fac.id))["reason"] == "exam"
        await materialize_sessions(db, date(2026, 5, 11), date(2026, 5, 24))
        assert await sessions_on(db, exam_monday, faculty_id=fac.id) == []

    async def test_exam_window_ignored_when_policy_disables_suspension(self, db, factory):
        from app.services.instructional_calendar import expected_sessions

        from .conftest import patch_policy

        await patch_policy(db, exam_days_suspend_classes=False)
        fac = await factory.faculty()
        subj = await factory.subject(faculty=fac)
        await factory.term(start_date=TERM_START, end_date=TERM_END, exam_week_start=date(2026, 5, 18),
                           exam_week_end=date(2026, 5, 29))
        await factory.class_schedule(subject=subj, faculty=fac, day_of_week="MONDAY")
        assert len(await expected_sessions(db, date(2026, 5, 18), faculty_id=fac.id)) == 1

    async def test_academic_year_label_never_compared(self, db, factory):
        """Schedules labelled 2025 still produce sessions in a 2026 term; a BS-labelled term works."""
        from app.services.class_sessions import materialize_sessions
        from app.services.instructional_calendar import expected_sessions

        from .conftest import patch_policy

        await patch_policy(db, tracking_start_date=date(2025, 1, 1))
        fac = await factory.faculty()
        subj = await factory.subject(faculty=fac)
        await factory.term(start_date=TERM_START, end_date=TERM_END, academic_year=2082)
        sched = await factory.class_schedule(subject=subj, faculty=fac, day_of_week="MONDAY", academic_year=2025)
        got = await expected_sessions(db, MON, faculty_id=fac.id)
        assert [e.schedule_id for e in got] == [sched.id]
        res = await materialize_sessions(db, MON, MON, faculty_id=fac.id)
        assert res.created == 1

    async def test_no_sessions_between_terms(self, db, factory):
        from app.services.instructional_calendar import day_status, expected_sessions

        fac = await factory.faculty()
        subj = await factory.subject(faculty=fac)
        await factory.term(start_date=TERM_START, end_date=TERM_END)
        await factory.class_schedule(subject=subj, faculty=fac, day_of_week="MONDAY")
        summer_monday = date(2026, 7, 6)
        assert await expected_sessions(db, summer_monday, faculty_id=fac.id) == []
        assert (await day_status(db, summer_monday, fac.id))["reason"] == "between_terms"

    async def test_weekly_off_reported_for_saturday(self, db, factory):
        from app.services.instructional_calendar import day_status

        await factory.term(start_date=TERM_START, end_date=TERM_END)
        st = await day_status(db, SAT)
        assert st["instructional"] is False and st["reason"] == "weekly_off"
