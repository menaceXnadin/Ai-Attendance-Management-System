# Known issues and technical debt

Last updated 2026-10-18, after the attendance redesign (migration `o20261018_class_sessions`).

## Operational state
- **No current term.** No `semester_configurations` row covers today, so the app reports `between_terms`: no classes, check-in closed, auto-absent idle. Create a term in Semester Setup (`/app/admin/semester-configuration`) to get classes.
- **Most timetable rows have no teacher.** Only 30 of 2,160 `class_schedules` rows have a `teacher_id`, so most sessions can only be recorded or resolved by an admin. The unrecorded endpoint reports `schedules_without_teacher`.
- **Dummy data.** All data in the local `attendancedb` is dummy data, and the owner doesn't mind losing it.

## Data model and schema
- **Model drift.** Models outside the redesigned tables don't match the live DB exactly; `compare_metadata` reported 94 differences on 2026-10-18, none in the redesigned tables. The reconciled tables are `attendance_records`, `students`, `class_schedules`, `semester_configurations` and the new tables. Never run `alembic revision --autogenerate` without reviewing every operation, because it would propose destructive changes.
- **Alembic can't build an empty database.** The chain has 4 root migrations that assume pre-existing tables, so `alembic upgrade head` fails on an empty DB. Tests work around this with `backend/tests/schema/baseline.sql`. A proper fix is to squash to a baseline revision and stamp the live DB.
- **No promotion workflow and no per-term enrollment history.** `students.semester` is the current cohort and `cohort_since` marks the last change. Moving a cohort between semesters is a manual admin edit.
- **Legacy tables kept.** `classes`, `academic_years`, `class_schedule_templates`, `academic_calendar_config` (deprecated; writes return 410), `students_backup_*`, `event_attendance`/`session_attendance` (dormant, never written), and the view `student_attendance_summary`.
- **Duplicate constraints and indexes** from layered migrations (notification receipts, password resets, `students.user_id`). They are harmless.

## Backend
- **`GET /students` returns `face_encoding`** to admins and teachers. It was kept for response compatibility; drop it from the payload when the frontend no longer needs it.
- **Public read endpoints.** `/schedules/today` now requires login; the remaining unauthenticated reads are listed below.
- **Old calculators.** `accurate_attendance_calculator.py`, `academic_calculator.py`, `session_metrics_service.py` and `streak_badge_system.py` are now thin delegates to `attendance_metrics`; new code should call `attendance_metrics` directly. `subject_tallies` in `accurate_attendance_calculator.py` is a batch helper still used by analytics.
- **`services/system_monitor.py`** imports models that don't exist. Its call from `get_current_user` was removed; don't wire it back in.
- **Untested concurrency.** Truly simultaneous writes are protected by row locks and unique constraints, but they aren't load-tested.
- **Unauthenticated reads:** `/faculties/`, `/face-recognition/service-status` and the two academic-calendar GETs.
- **`RecordResult` has no per-student outcome.** Routes derive created/updated/unchanged from a snapshot. Adding `outcomes` to the service would simplify the routes.

## Face verification
- **Thresholds are uncalibrated defaults.** `match_threshold` 0.45 and `antispoof_threshold` 0.70 have not been tuned on real webcam captures. Anti-spoof scores move a lot with framing (a real crop scored 0.38 at `det_size` 320). Run `backend/scripts/calibrate_face_threshold.py` on labelled photos and adjust the `face_verification` setting before relying on it.
- **`buffalo_l` is non-commercial.** InsightFace's pretrained models are licensed for non-commercial research only. A commercial deployment needs a licence or another recognition model (and re-enrolment of everyone).
- **ONNX Runtime spinning.** Two ONNX sessions run back to back were ~2.5× slower with intra-op thread spinning on; the engine re-creates the detection and recognition sessions with spinning off because `FaceAnalysis` doesn't pass session options through. Keep this if you touch the engine.
- **JSON `null` vs SQL NULL.** `students.face_encoding` is `JSON(none_as_null=True)` so assigning `None` writes SQL NULL. Without it, `face_encoding IS NOT NULL` (gallery, live recognition, the partial index) would count reset or deleted students as enrolled.
- **`.env` keys must match a setting.** pydantic-settings rejects unknown keys in `backend/.env`, so `development_mode` stays as a deprecated, ignored field until the `.env` line is removed.
- **Presence codes need staff on screen.** Most sessions have no teacher, so an admin must display the code (or switch `require_presence_code` off) for those classes.

## Frontend
- **TypeScript errors.** 13 pre-existing errors remain in `pages/ClassesPage.tsx` (not routed), `StudentsPage.tsx` and `TeachersPage.tsx`.
- **`frontend/tsconfig.app.json` keeps gaining `"ignoreDeprecations": "6.0"`**, probably added by an editor running a newer TypeScript. TypeScript 5.6.3 rejects it (TS5103) and `tsc` then checks nothing. Remove the line if it reappears.
- **No browser testing** of the redesigned attendance flows (session registers, unrecorded panel, check-in window UX) against the migrated database. They are covered only by the type check, lint, build and backend contract tests.
- **Stale lockfile.** `bun.lockb` is out of date; the project uses npm.
- **Mixed icon libraries.** Some screens still use lucide or Carbon icons alongside Fluent icons.
