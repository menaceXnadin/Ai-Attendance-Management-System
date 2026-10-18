"""Attendance streaks and badges (DOMAIN_RULES §8 streak rule, §2 policy bands).

Streaks are computed by :func:`app.services.attendance_metrics.compute_streaks` over *class
days* only: a class day is a date with at least one countable record (held session,
present/late/absent, not excluded, inside the student's metrics window); it is "attended" iff
every countable record that day is attended (late counts per ``late_counts_as_attended``).
Weekends, holidays, cancelled sessions, unrecorded sessions and days without classes are
neutral: they never break and never extend a streak. The window is the reporting term (or
``term_id``) clipped to enrollment and today — there is no fixed 180-day lookback.

Badge attendance tiers use the metrics percentage and the policy bands (the "meeting
requirements" badge is the at-risk band, whose floor is the policy minimum).

Read-only: never flushes or commits.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Iterable, Optional, Sequence

from app.core.clock import app_now
from app.services.accurate_attendance_calculator import countable_student_day_rows, metric_fields
from app.services.attendance_metrics import (
    compute_streaks,
    compute_student_metrics,
    day_flags_from_records,
)
from app.services.attendance_policy import AttendancePolicy, get_attendance_policy
from app.services.term_service import get_term_context


# ============================================================================ pure helpers


def _day_kind(statuses: Sequence[str], ok_statuses: frozenset) -> str:
    if all(s in ok_statuses for s in statuses):
        return "present"
    if all(s == "absent" for s in statuses):
        return "absent"
    return "partial"


def build_streak_payload(
    day_statuses: dict[date, list[str]],
    *,
    policy: AttendancePolicy,
    today: date,
) -> dict[str, Any]:
    """Streak fields from ``{class_day: [countable statuses]}`` (pure, never loops on empty data)."""
    from app.services.attendance_metrics import attended_statuses

    ok = attended_statuses(policy)
    flags = day_flags_from_records(((d, s) for d, ss in day_statuses.items() for s in ss), policy)
    streak = compute_streaks(flags)

    history = []
    run = 0
    monthly: dict[str, dict[str, int]] = defaultdict(lambda: {"streak": 0, "max_streak": 0, "present_days": 0, "class_days": 0})
    for d, attended in flags:  # sorted by date
        run = run + 1 if attended else 0
        history.append({"date": d.isoformat(), "status": _day_kind(day_statuses[d], ok), "streak_at_day": run})
        m = monthly[d.strftime("%Y-%m")]
        m["class_days"] += 1
        if attended:
            m["present_days"] += 1
            m["streak"] += 1
            m["max_streak"] = max(m["max_streak"], m["streak"])
        else:
            m["streak"] = 0

    week_start = today - timedelta(days=today.weekday())
    week_present = sum(1 for d, attended in flags if attended and week_start <= d <= today)
    return {
        "current_streak": streak["current"],
        "longest_streak": streak["longest"],
        "current_week_streak": week_present,
        "monthly_streaks": [{"month": k, **v} for k, v in sorted(monthly.items())],
        "streak_history": history,
        # Non-class days are neutral, so the streak is active iff the latest class day was attended.
        "is_streak_active": streak["current"] > 0,
        "total_class_days": len(flags),
        "total_present_days": sum(1 for _, attended in flags if attended),
        "last_class_day": flags[-1][0].isoformat() if flags else None,
    }


def group_day_rows(rows: Iterable[tuple[int, date, str]]) -> dict[int, dict[date, list[str]]]:
    out: dict[int, dict[date, list[str]]] = defaultdict(lambda: defaultdict(list))
    for sid, d, status in rows:
        out[sid][d].append(status)
    return out


# ============================================================================ streaks


class StreakCalculator:
    """Streak engine backed by the metrics service."""

    @staticmethod
    async def calculate_comprehensive_streaks(
        db,
        student_id: int,
        calculation_period_days: Optional[int] = None,
        *,
        term_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """Streaks + attendance summary for the student's reporting term (or ``term_id``).

        ``calculation_period_days`` is accepted for backward compatibility and ignored: the
        window is the term window clipped to enrollment and today (Rule §8). Raises
        ``DomainError(student_not_found)`` for an unknown student.
        """
        now = app_now()
        policy = await get_attendance_policy(db)
        metrics = await compute_student_metrics(db, student_id, term_id=term_id, policy=policy, now=now)
        window = metrics.window
        day_statuses: dict[date, list[str]] = {}
        if window is not None:
            rows = await countable_student_day_rows(db, window[0], window[1], student_ids=[student_id])
            day_statuses = group_day_rows(rows).get(student_id, {})
        payload = build_streak_payload(day_statuses, policy=policy, today=now.date())
        # The metrics service is the source of truth for the streak numbers (identical rule).
        payload["current_streak"] = metrics.streak["current"]
        payload["longest_streak"] = metrics.streak["longest"]
        payload["is_streak_active"] = metrics.streak["current"] > 0
        o = metrics.overall
        payload.update({
            "calculation_period_days": ((window[1] - window[0]).days + 1) if window else 0,
            "start_date": window[0].isoformat() if window else None,
            "end_date": window[1].isoformat() if window else None,
            "attendance_rate": o["attendance_rate"],
            **metric_fields(o, term=metrics.term_context.term, term_state=metrics.term_state),
        })
        return payload


# ============================================================================ badges


def _badge(id_: str, name: str, description: str, tier: str, icon: str, color: str) -> dict[str, str]:
    return {"id": id_, "name": name, "description": description, "tier": tier, "icon": icon, "color": color}


def _award_attendance_rate_badges(streak_data: dict[str, Any], policy: AttendancePolicy) -> list[dict]:
    """One attendance badge from the metrics percentage + policy bands (no badge without data)."""
    if not streak_data.get("has_data"):
        return []
    attended, considered = streak_data.get("attended") or 0, streak_data.get("considered") or 0
    if considered and attended == considered:
        return [_badge("perfect_attendance", "Perfect Attendance", "100% attendance rate", "legendary", "🏆", "gold")]
    band = streak_data.get("band")
    names = [b.name for b in policy.bands]
    if band not in names:
        return []
    idx = names.index(band)
    b = policy.bands[idx]
    if idx == len(names) - 1:  # critical: below the minimum -> no badge
        return []
    floor = f"{b.min_percentage:g}%+ attendance rate"
    if idx == len(names) - 2:  # at-risk band: floor == policy minimum
        return [_badge("passing_attendance", "Meeting Requirements", floor, "common", "✓", "gray")]
    if idx == 0:
        return [_badge("excellent_attendance", f"{b.label or 'Excellent'} Attendance", floor, "epic", "🥇", "purple")]
    return [_badge("good_attendance", f"{b.label or 'Good'} Attendance", floor, "uncommon", "⭐", "green")]


def _award_streak_badges(streak_data: dict[str, Any]) -> list[dict]:
    """Badges for consecutive attended class days."""
    badges = []
    current = streak_data.get("current_streak", 0)
    longest = streak_data.get("longest_streak", 0)
    if current >= 60:
        badges.append(_badge("legendary_streak", "Legendary Streak", "60+ consecutive class days", "legendary", "👑", "gold"))
    elif current >= 30:
        badges.append(_badge("super_streak", "Super Streak", "30+ consecutive class days", "epic", "🔥", "red"))
    elif current >= 14:
        badges.append(_badge("hot_streak", "Hot Streak", "14+ consecutive class days", "rare", "🔥", "orange"))
    elif current >= 7:
        badges.append(_badge("weekly_streak", "Weekly Streak", "7+ consecutive class days", "uncommon", "📅", "yellow"))
    if longest >= 90:
        badges.append(_badge("marathon_runner", "Marathon Runner", "Achieved a 90+ class-day streak", "legendary", "🏃", "gold"))
    return badges


def _award_consistency_badges(streak_data: dict[str, Any], policy: AttendancePolicy) -> list[dict]:
    """Top policy band with an active 14+ class-day streak."""
    top = policy.bands[0].name if policy.bands else None
    if streak_data.get("band") == top and streak_data.get("current_streak", 0) >= 14:
        return [_badge("consistent_performer", "Consistent Performer", "Top attendance band with an active streak", "rare", "📈", "blue")]
    return []


class BadgeSystem:
    """Badge awarding over metrics-backed streak data."""

    @staticmethod
    async def calculate_earned_badges(db, student_id: int, streak_data: dict[str, Any]) -> list[dict]:
        policy = await get_attendance_policy(db)
        badges: list[dict] = []
        badges.extend(_award_attendance_rate_badges(streak_data, policy))
        badges.extend(_award_streak_badges(streak_data))
        badges.extend(_award_consistency_badges(streak_data, policy))
        return badges


# ============================================================================ leaderboard (batch)


async def batch_streaks(db, students: Sequence[Any], *, term_id: Optional[int] = None) -> dict[int, dict[str, int]]:
    """``{student_id: {"current", "longest"}}`` for many students in ONE records query.

    ``students`` rows need ``id``, ``enrolled_on``, ``created_at`` (the enrollment clip is applied
    in SQL by the shared helper, identical to ``compute_student_metrics``).
    """
    now = app_now()
    policy = await get_attendance_policy(db)
    ctx = await get_term_context(db, as_of=now.date(), term_id=term_id)
    out = {s.id: {"current": 0, "longest": 0} for s in students}
    if ctx.term is None or not students:
        return out
    end = min(ctx.term.end_date, now.date())
    rows = await countable_student_day_rows(db, ctx.term.start_date, end, student_ids=[s.id for s in students])
    for sid, days in group_day_rows(rows).items():
        flags = day_flags_from_records(((d, st) for d, ss in days.items() for st in ss), policy)
        out[sid] = compute_streaks(flags)
    return out


def _empty_streak_data() -> dict[str, Any]:
    """Empty streak structure (kept for backward compatibility)."""
    return {
        "current_streak": 0,
        "longest_streak": 0,
        "current_week_streak": 0,
        "monthly_streaks": [],
        "streak_history": [],
        "is_streak_active": False,
        "total_class_days": 0,
        "total_present_days": 0,
        "calculation_period_days": 0,
        "start_date": None,
        "end_date": None,
    }


__all__ = [
    "StreakCalculator",
    "BadgeSystem",
    "build_streak_payload",
    "batch_streaks",
    "group_day_rows",
]
