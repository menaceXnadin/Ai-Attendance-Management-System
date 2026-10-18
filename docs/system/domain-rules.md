# Attendance domain rules (authoritative)

These are the business rules the backend implements. Code cites them by section, as in `Rule §13.3` inside docstrings; the section numbers come from the original design document and are kept so those references still resolve. If you change a rule, update this file in the same change and keep the code citations accurate.

Where the code implements each part:

| Area | Module |
|---|---|
| Clock | `backend/app/core/clock.py` |
| Policy settings | `backend/app/services/attendance_policy.py` |
| Terms | `backend/app/services/term_service.py` |
| Instructional days and expected sessions | `backend/app/services/instructional_calendar.py` |
| Class sessions | `backend/app/services/class_sessions.py` |
| Writing attendance | `backend/app/services/attendance_recording.py` |
| Percentages, eligibility, streaks, day statuses | `backend/app/services/attendance_metrics.py` |
| Automatic absences (the finalizer) | `backend/app/services/auto_absent_service.py`, scheduled by `scheduler_service.py` |
| Errors | `backend/app/services/domain_errors.py` (`DomainError`) |

Routes must call these services. They must not re-implement any of these rules.

---

## 0. Principles
1. **Attendance belongs to a class session**: one timetable slot on one date. It is never "subject per day" or "per day".
2. **No fabricated data.** An absence can only be recorded for a session that was held, meaning someone took attendance. A session nobody recorded is *unrecorded*: it appears for follow-up, is never turned into absences, and is never counted in percentages.
3. **Never silently overwrite.** Every change to an existing record writes an audit row recording the old and new values, who made the change, when, and why. Application code never deletes attendance history.
4. **One implementation per rule** (see the table above). The frontend never recomputes policy or percentages.
5. **One clock.** Every "today" or "now" decision uses `Asia/Kathmandu` through `app/core/clock.py` (`app_now()`, `app_today()`, `combine_local(d, t)`, `local_naive(dt)`). Tests freeze time with `set_now_provider(fn)` and `reset_now_provider()`. Never use `datetime.now()` or `date.today()` in business logic, and never use `CURRENT_DATE` in SQL.
6. **Backward-compatible APIs.** Endpoint paths and existing response fields stay; changes only add fields.

## 1. Policy settings (`get_attendance_policy(db)`)
Settings are read from `system_settings`, with a fallback default when a value is missing or invalid.

| Field | Source | Default |
|---|---|---|
| `minimum_percentage` | `attendance_minimum.percentage` | 75 |
| `weekly_off_days` | `academic_calendar_type` (`nepal` → Saturday; other → Saturday and Sunday) | Saturday |
| `checkin_opens_minutes_before` | `attendance_policy` JSON | 10 |
| `late_after_minutes` | `attendance_policy` | 10 |
| `checkin_closes_after_minutes` | `attendance_policy` | 20 |
| `finalize_grace_minutes` | `attendance_policy` | 15 |
| `teacher_edit_window_days` | `attendance_policy` | 7 |
| `late_counts_as_attended` | `attendance_policy` | true |
| `auto_absent_lookback_days` | `attendance_policy` | 7 |
| `exam_days_suspend_classes` | `attendance_policy` | true |
| `tracking_start_date` | `attendance_policy` (written by the migration) | migration date (2026-10-18) |
| bands | `attendance_thresholds` table, as contiguous half-open bands `[min, next_min)` | excellent ≥90, good ≥85, warning ≥75, critical <75 |

The boundary between "warning" and "critical" always equals `minimum_percentage`; the policy loader enforces this. `PUT /system-settings/settings/attendance_policy` merges the new values into the stored JSON. `tracking_start_date` can never be changed or cleared through it. The frontend reads all of this from `GET /system-settings/attendance-policy` and must not hard-code 75/85/90.

## 2. Terms (`term_service`)
- **The source of truth is `semester_configurations`.** It holds university-wide periods. A term is active when `is_active = true`.
- The current term is the active term whose `[start_date, end_date]` contains today. There are no month-based guesses. If no term contains today, the state is `between_terms` (or `no_terms` if none exist at all). In that state:
  - no sessions are created;
  - auto-absent does nothing;
  - "today's classes" is empty;
  - metrics report on the most recent past term (`get_reporting_term`).
- The stored `is_current` column is not authoritative. APIs compute it from dates.
- Validation on create and update:
  - end must be after start;
  - the exam window must lie inside the term, with start ≤ end;
  - active terms must not overlap (checked under an advisory transaction lock);
  - the academic year must be between 2000 and 2100.
  Deleting a term deactivates it; terms are never hard-deleted.
- **The academic year is a label only**, both on `class_schedules` and on `semester_configurations`. Never compare it with the calendar year. A timetable row applies to a date when the row is active and the date falls inside an active term's teaching window.
- The teaching window is the term minus the exam window `[exam_week_start, exam_week_end]`, when the exam window is set and `exam_days_suspend_classes` is on.
- The legacy `AutomaticSemesterService` and `academic_calendar_config` override no longer decide the term. The override's write endpoints return 410.

## 3. Instructional days (`instructional_calendar`)
A timetable row `S` produces an expected session on date `D` only when all of these hold:
1. `S.is_active`, and `D`'s weekday equals `S.day_of_week`. The DB enum stores names like `'SUNDAY'`; use `weekday_to_day_of_week(date)`.
2. `D` is inside an active term's teaching window.
3. `D`'s weekday is not in `weekly_off_days`.
4. No active HOLIDAY covers `D` for that cohort. "Covers" means `start_date ≤ D ≤ coalesce(end_date, start_date)`, the event's faculty is NULL or matches, and its subject is NULL or matches. A holiday with explicit start and end times suppresses only the slots that overlap those times. A half-day holiday without times counts as a full day.
5. If `exam_days_suspend_classes` is on, no active EXAM event covers `D`, unless that event has `attendance_required = true`. The same scope and time-overlap rules apply.
6. CLASS "marker" events are not required. SPECIAL_EVENT never suppresses classes.

`day_status(db, d, faculty_id)` explains a day as instructional, `weekly_off`, `holiday`, `exam` or `between_terms`. Several events on one day are legal, so never use `scalar_one_or_none()` to look up events.

## 4. Class sessions (`class_sessions` table and service)
- **Columns:** `schedule_id` (SET NULL on schedule delete), snapshot columns (`subject_id`, `faculty_id`, `semester`, `term_id`, `session_date`, `start_time`, `end_time`, `teacher_id`), `status`, `kind` (`regular` or `makeup`), `attendance_taken_at`, `submitted_at`/`submitted_by`, `finalized_at`, `cancelled_at`/`cancelled_by`/`cancellation_reason`, `cancelled_by_event_id`, `review_required`/`review_reason`.
- **Uniqueness:**
  - `uq_class_session_slot (subject_id, faculty_id, semester, session_date, start_time)`;
  - partial unique `(schedule_id, session_date)` for regular sessions, so editing a timetable time on the same day can't create a duplicate. Time edits take effect from the next day's sessions.
- **Creating sessions:**
  - The scheduler creates every expected session for dates in `[max(tracking_start_date, today − lookback_days), today]`. It skips cohorts with no enrolled active students.
  - Request paths call `ensure_sessions_for(...)` to create them on demand; this is idempotent. Today's classes, unrecorded lists and metrics read `class_sessions`, never the timetable multiplied by dates.
  - A regular or make-up session can never be created before `tracking_start_date` (error `before_tracking_start`).
- **Status transitions:**
  - `scheduled → held`: the first write from a teacher, admin or student face check-in with status present, late or absent, or an explicit register submission. Writing `excused` never changes the session's status.
  - `scheduled|held → cancelled`: by an admin, or the owning teacher within their edit window. A reason is required, and past or future sessions both qualify. Existing records are kept; they are simply left out of every metric while the session is cancelled. Audited.
  - `cancelled → previous state`: un-cancel, by the same people, with a reason. The session returns to `held` if it has real records or was submitted, otherwise to `scheduled`. Audited.
- **Unrecorded** is derived, not stored. A session is unrecorded when all of these are true:
  - `status = scheduled`;
  - `end + finalize_grace < now`;
  - `session_date ≥ tracking_start_date`;
  - its cohort has at least one enrolled active student.

  `GET /attendance/sessions/unrecorded` (paged) lists these together with sessions flagged `review_required`. Resolving one means either submitting the register as **held** (optionally with `mark_remaining_absent`) or cancelling it as **not held**.
- **Make-up sessions** are created by an admin, or by a teacher of that subject and cohort. They must fall inside an active term, not on a holiday, and not in a slot already taken (`slot_taken`, 409).
- **Calendar events drive sessions.** Creating, editing or deactivating a HOLIDAY, EXAM or CANCELLED_CLASS event updates the sessions it covers in the same transaction:
  - Sessions with no real records become `cancelled`, with `cancelled_by_event_id` set.
  - Sessions that already have real records get `review_required`.
  - Deactivating the event restores the sessions it cancelled and clears the review flags it set.
  - An admin can clear a review flag and keep the session as it is with `POST /attendance/sessions/{id}/clear-review`, which requires a reason.

## 5. Recording attendance (`attendance_recording`): the only writer apart from the finalizer
- **New fields on `attendance_records`:**
  - `session_id`;
  - `source` (`teacher`, `admin`, `student_face`, `system_auto` or `legacy`);
  - status `excused`;
  - `excluded_from_metrics` and `exclusion_reason`.

  New code never writes per-student `cancelled` rows; cancellation lives on the session. The legacy columns (`date`, `subject_id`, `time_slot`, `method`, `location`, `marked_by`, `time_in`) are still filled in for compatibility; `location = 'AUTO_ABSENT_SYSTEM'` is used only for `system_auto` rows.
- **Who may write:**

| Actor | Allowed |
|---|---|
| Student (face check-in) | Only their own record, for today's session in their cohort, while the session is not cancelled and they are enrolled. The check-in window is `[start − opens_before, min(end, start + closes_after))`. Status is `present` if `now ≤ start + late_after`, otherwise `late`. A student never overwrites an existing record (`already_recorded`). The endpoint returns HTTP 200 with `{success:false, code}` for rule rejections. |
| Teacher | Only sessions they own (`session.teacher_id`, or the schedule's `teacher_id`). The session must not be in the future and must not be cancelled; only enrolled students; within `teacher_edit_window_days` of the session date. Statuses: present, late or absent. |
| Admin | Any record. The session must not be in the future. `excused` is admin-only. |
| `system_auto` (finalizer) | Only `absent`, and only where no record exists. It never updates a record. |

- **When a reason is required:** changing the status of a `student_face` record; setting `excused`; an admin overriding a teacher's record; any edit after the teacher's edit window. Overriding `system_auto`, `legacy` or `admin` rows by a teacher needs no reason, though it is still audited, and it updates the row's provenance fields. Bulk endpoints accept a single batch-level `reason`. Writing the same value again does nothing and creates no audit row.
- **`confirm_held`:** any write that would turn a `scheduled` session that is already past `end + grace` into a held one requires `confirm_held = true`. That includes register submissions. Without it the server returns 409 `{code: "confirm_held", students_without_record}`. The reason: saving one correction on an unrecorded past class would otherwise mark the session held, and the finalizer would then mark the other N−1 students absent without warning.
- **Write flow:** run face matching outside the lock, then `SELECT … FOR UPDATE` the session row, load its records, validate every entry (a batch is all-or-nothing: `400 invalid_entries` with per-entry errors), do a plain insert or update, write the audit rows, and let the route commit.
- **Removed behaviours:** the admin "cascade/recovery" mode that wrote absences for every subject of the week; the inline auto-absent inside face marking; rosters that showed unmarked students as "absent". Unmarked now means `null`.

## 6. Automatic absences (the finalizer, `auto_absent_service.run()`)
- **Which sessions it finalizes:**
  - status `held`, not cancelled, not `review_required`, not covered by a suppressing event;
  - `finalized_at IS NULL`;
  - inside an active term;
  - `session_date ≥ tracking_start_date`, so legacy held sessions are left exactly as recorded and never get retroactive absences;
  - `end + finalize_grace ≤ now`.

  Lookback only limits how far back sessions are *created*. Every eligible held session gets finalized.
- **What it does to each session**, in one transaction per session: every enrolled student without a record gets an `absent` row with `source = system_auto`, `method = other`, `location = AUTO_ABSENT_SYSTEM`. It then writes one `finalize` audit row and sets `finalized_at`.
- **Who is enrolled:** active users in the cohort (same `faculty_id` and `semester`), with `session_date ≥ max(enrollment_start, cohort_since)`, where `enrollment_start = coalesce(enrolled_on, created_at at local time)`.
- **Sessions nobody took attendance for (`scheduled`) are never auto-absented.**
- **Concurrency:** the whole run holds `pg_try_advisory_lock` on a dedicated connection that is released in `finally`. A concurrent run returns `skipped`. A `job_runs` row is written only when the lock was acquired or the run failed.
- **Scheduler:** runs every 10 minutes, with the first run 30 seconds after startup. It starts only if both `RUN_SCHEDULER` and `ENABLE_AUTO_ABSENT_SCHEDULER` are true. Because each run catches up and is idempotent, it suits a server that isn't on all the time.
- **Manual trigger:** `POST /auto-absent/trigger {date?}` is admin-only, and the date must lie inside an active term, at most 30 days back.

## 7. Metrics (`attendance_metrics`): the only percentage implementation
- **Window:** `[max(term.start, enrollment_start), min(term.end, today)]`. The term is the reporting term unless the request passes `term_id`.
- **Countable record:** linked to a session that is `held` and inside the window, with `excluded_from_metrics = false` and status present, late or absent. Records marked `excused` or `cancelled` are never countable, and neither are records with no session.
- `attended` = present, plus late when `late_counts_as_attended`. `considered` = all countable records.
- **Per subject:** `attended / considered`. **Overall:** `Σattended / Σconsidered`, weighted by session, never an average of subject percentages. When `considered = 0`, `percentage` is `null` (shown as "—"), never 0 and never NaN.
- **Eligibility** is decided per subject, as `attended/considered ≥ minimum` on the exact fraction (no rounding up). Overall `eligible` = every subject that has data is eligible; it is `null` when there is no data. `eligibility_provisional = unrecorded > 0`.
- The band comes from policy bands applied to the exact percentage. Rounding (2 decimals) is for display only.
- **Streaks:** consecutive class days on which every countable record was attended. Days with no class are neutral.
- **Day statuses:** `present`, `absent`, `partial`, `excused`, `cancelled`, `unrecorded`, `holiday`, `weekly_off`, `exam`, `between_terms`, `no_class`, `future`. They use exactly the same countable definition as the percentages. A session that hasn't reached `end + grace` is neutral; a day containing only such sessions is `future`.
- **API shape:** the legacy numeric fields (`percentage_present`, `attendance_rate`, `total_classes`, …) stay numbers, set to 0 when there is no data. New fields sit alongside them: `percentage` (null-able), `has_data`, `considered`, `attended`, `excused`, `unrecorded`, `eligible`, `eligibility_provisional`, `band`, `term`, `term_state`.

## 8. Legacy data (migration `o20261018_class_sessions`)
- All 3,399 pre-redesign records were linked to sessions. No record was deleted and no status was changed.
- Records excluded from metrics, with their reasons:
  - `legacy_unheld_session` (3,070): fabricated auto-absences in sessions nobody held;
  - `before_enrollment` (35);
  - `recorded_before_class` (22).

  An admin can toggle any exclusion with `PATCH /attendance/records/{id}/metrics-exclusion`, which requires a reason and is audited.
- Sessions before `tracking_start_date` are legacy. They are never finalized and never listed as unrecorded.

## 9. Integrity and permissions
- **Attendance is a protected record:**
  - the `student_id` and `subject_id` foreign keys use RESTRICT;
  - deleting a student, teacher or admin deactivates `users.is_active`;
  - deleting a faculty or subject returns 409 while anything references it;
  - deleting a schedule that has sessions deactivates it instead;
  - calendar events are soft-deleted (`is_active = false`).
- **Timetable integrity:**
  - end time must be after start time (DB CHECK);
  - no overlapping active slots for the same cohort, classroom or teacher on the same weekday, checked by `find_schedule_conflicts` in `routes/schedules.py`.
- **Students** can edit only their contact fields. Faculty, semester, year, batch, student ID and `enrolled_on` are admin-only, and changing faculty or semester sets `cohort_since` to today.
- **Guards** come from `app/api/dependencies.py`: `role_of`, `has_role` ("teacher" also matches the `faculty` role), `require_roles`, `require_teacher_or_admin`, `require_debug_admin`, `resolve_student_scope`. Students read only their own data; teachers read only cohorts they teach; admins read everything. A test (`tests/test_route_guards.py`) fails if a write endpoint lacks auth. Debug and face-testing routes require admin and `DEBUG`.
- Never compare a `UserRole` enum with a string; use `has_role`.
