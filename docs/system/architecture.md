# System architecture

AttendAI is a face-recognition attendance system for a university. It started as a final-year project and is not deployed. The local database holds dummy data only.

## Components

```
Browser (React SPA, Vite dev server :8080)
  │  /api/* → proxied to the backend; JWT in an Authorization header
  ▼
FastAPI backend (uvicorn :8000)  ──►  PostgreSQL 17 "attendancedb" (TZ Asia/Kathmandu)
  │  routes → domain services → SQLAlchemy async models
  ├─ face engine (insightface_service): InsightFace buffalo_l detection + recognition,
  │   MiniFASNet anti-spoofing (ONNX, CPU), run in worker threads
  └─ in-process scheduler: session materialization + auto-absent finalizer every 10 min
```

- **Frontend:** `frontend/`, built with React 18, TypeScript, Vite, Tailwind, shadcn/Radix and TanStack Query. The UI follows Microsoft Teams / Fluent 2 styling. MediaPipe detects and captures faces in the browser, and the backend does the matching. Details are in [frontend.md](frontend.md).
- **Backend:** `backend/app/`, running FastAPI with SQLAlchemy 2 async (asyncpg), Alembic, InsightFace + onnxruntime and bcrypt/JWT. Python 3.13 in `backend/venv`; `backend/requirements.txt` pins the versions installed there (only the packages the code imports). The face engine is described in [face-verification.md](face-verification.md) §2–§3; `backend/scripts/calibrate_face_threshold.py` calibrates the match threshold from labelled photos.
- **Database:** see [database.md](database.md). All endpoints are listed in [api-reference.md](api-reference.md).

## Backend layout (`backend/app`)

| Path | Role |
|---|---|
| `main.py` | App factory, CORS, router mounting (all under `/api`), and `lifespan` (starts and stops the scheduler) |
| `core/config.py` | `Settings` (pydantic-settings, reads `backend/.env`) |
| `core/database.py` | Async engine, `AsyncSessionLocal`, `get_db` dependency, `Base` |
| `core/security.py` | bcrypt hashing; `create_access_token` (HS256, `sub` = user id, `role`) |
| `core/clock.py` | **The only clock**: `app_now()`, `app_today()`, `combine_local`, `local_naive`, `set_now_provider` |
| `api/dependencies.py` | Auth: `get_current_user` (HTTPBearer → JWT → user, and checks that the role matches the DB), `get_current_student`/`get_current_teacher`/`get_current_admin`, `require_admin_role`, `require_roles(...)`, `require_teacher_or_admin`, `require_debug_admin`, `has_role`/`role_of`, `resolve_student_scope`, `get_teacher_cohorts` |
| `api/routes/*.py` | One router per area (attendance, teacher_dashboard, schedules, face_recognition, student_attendance, analytics, admin_semester_config, system_settings, auto_absent_trigger, …) |
| `api/calendar.py` | Calendar event CRUD (`/api/calendar/*`), which reconciles sessions when events change |
| `models/` | `__init__.py` (users, students, teachers, admins, faculties, subjects, attendance_records, marks, notifications, …), `attendance_sessions.py` (ClassSession, AttendanceAuditLog, JobRun + StrEnum constants), `calendar.py` (academic events, semester_configurations, …), `schedule.py` (class_schedules), `system_settings.py`, `notifications.py` |
| `services/` | Domain services (next section), plus `insightface_service.py`, `email_service.py`, `scheduler_service.py`, and older services kept as thin wrappers (`accurate_attendance_calculator.py`, `academic_calculator.py`, `session_metrics_service.py`, `streak_badge_system.py`, `automatic_semester.py`, `calendar_generator.py` (disabled)) |

### Domain services (the attendance core)
The rules live in [domain-rules.md](domain-rules.md).

| Service | Responsibility |
|---|---|
| `attendance_policy.py` | Loads `AttendancePolicy` from `system_settings` and thresholds. Pure helpers: `percentage`, `eligible`, `band_for` |
| `term_service.py` | Current and reporting term from `semester_configurations` (by date), term validation, `get_term_context` |
| `instructional_calendar.py` | Expected sessions for a date (term window, weekly off-day, holidays, exams), `day_status`, weekday↔enum mapper |
| `class_sessions.py` | Creating sessions (`ensure_sessions_for`, `materialize_sessions`), cancel/uncancel/make-up/clear-review, unrecorded queries, reconciling sessions with calendar events, roster rules |
| `attendance_recording.py` | **The single writer**: `record_attendance` (teacher/admin, register submissions), `student_self_checkin`, `find_checkin_session`, `set_metrics_exclusion`; permission, window, reason and `confirm_held` rules; audit rows |
| `attendance_metrics.py` | **The single percentage implementation**: `compute_student_metrics`, batch helpers, cohort/subject metrics, day statuses, streaks |
| `auto_absent_service.py` | `run()`: materializes sessions and finalizes held sessions. Uses an advisory lock and writes `job_runs` |
| `domain_errors.py` | `DomainError(code, message, http_status, details)` → `.to_http_exception()` / `.to_legacy_response()` |

Conventions:
- **Services flush and routes commit.** The finalizer is the exception: it commits once per session.
- Routes turn `DomainError` into HTTP errors. Business errors come back as `{"detail": {"code": ..., "message": ..., ...}}`. Legacy clients (face check-in) receive HTTP 200 with `{success: false, code, message}`.

## Key flows

**Student face check-in**
1. `TodayClassSchedule` loads `GET /api/schedules/student/today?envelope=true`. Today's sessions are created on demand, and each one carries `checkin_window` and `my_status`.
2. The student enters the classroom code (or scans the QR, which pre-fills it) and opens the camera. The page gets a single-use challenge from `POST /api/face-recognition/challenge` ("turn your head left/right"), MediaPipe guides the framing, and a burst of unmirrored frames is posted to `POST /api/face-recognition/mark-attendance` with the challenge id and code.
3. `services/face_verification.py` runs the checks in order (lock-out, session/window, presence code, challenge, frame quality, identity against the student's templates, head turn, passive anti-spoofing) using thresholds from the `face_verification` setting, and logs one `face_verification_attempts` row. See [face-verification.md](face-verification.md) §7.
4. `find_checkin_session` and `student_self_checkin` apply the server-side window and present/late rules.

**Teacher register**
1. `GET /api/teacher/subjects/{id}/students-with-attendance` returns the session register (unmarked = `null`) along with `can_edit`.
2. `POST /api/teacher/attendance/bulk-mark` submits only the changed rows. The session becomes held, and late submissions on unrecorded classes need `confirm_held`.

**Admin**
- Session registers and the unrecorded/review list are under `/api/attendance/sessions/*`.
- Single corrections go to `POST /api/attendance`.
- Exclusions and the audit trail are under `/api/attendance/records/{id}/*`.

**Automatic absences**
1. The scheduler calls `auto_absent_service.run()` every 10 minutes. It creates expected sessions for the last 7 days (never before `tracking_start_date`, skipping empty cohorts).
2. It finalizes held sessions after `end + 15 min`, adding `system_auto` absences for enrolled students who have no record.
3. Admins can trigger it manually with `POST /api/auto-absent/trigger` and see run history at `GET /api/auto-absent/runs`.

**Terms and calendar**
- Admins manage terms in Semester Setup (`/api/admin/semester-config`).
- Holidays, exams and cancellations are calendar events (`/api/calendar/events`). Saving an event reconciles the sessions it covers.

## Auth
- JWT HS256, signed with `SECRET_KEY`. The payload carries `sub` (the user id as a string), `role` and `exp`. Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30), and `/auth/refresh-token` issues a new one.
- `get_current_user` rejects a token whose role differs from the user's role in the database.
- Roles are `admin`, `faculty` (the teacher role; the profile lives in `teachers`) and `student`. Use `has_role(user, "teacher")`, which also matches faculty.
- A missing token returns 403 (FastAPI `HTTPBearer`); an invalid token returns 401.

## Configuration (`backend/.env`, `Settings`)
- `DATABASE_URL` (asyncpg), `DATABASE_URL_SYNC` (psycopg2, used by Alembic)
- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `ALLOWED_ORIGINS` (a JSON list)
- Face engine: `INSIGHTFACE_DET_SIZE` (default 640; 320–480 is faster for webcam selfies), `FACE_MAX_CONCURRENCY` (face-engine calls running at once, default 2), `ANTISPOOF_MODEL_DIR` (empty = `backend/models/anti_spoof`), `FACE_RECOGNITION_TOLERANCE` (legacy `compare_embeddings` only). `DEVELOPMENT_MODE` is ignored (the mock face mode was removed) and is kept only so existing `.env` files still load. Verification thresholds live in the `face_verification` system setting.
- `UPLOAD_DIR`, `MAX_FILE_SIZE`
- `SMTP_*` (password-reset email)
- `DEBUG`: gates the debug routes (`/api/__routes`, `/subjects/debug-*`), which also require admin
- `ENABLE_AUTO_ABSENT_SCHEDULER` and `RUN_SCHEDULER`: both must be true for the scheduler to start
- `APP_TIMEZONE` (default `Asia/Kathmandu`)

Business policy (minimum %, check-in window, grace, edit window, weekly off-day) lives in the database (`system_settings`), not in env vars.

## Running locally
- **Backend:** `cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`. On Linux or macOS use `venv/bin/python`. Importing the app loads the face engine (two InsightFace models + two anti-spoof models), which takes about 5–6 s; the first run downloads `buffalo_l` to `~/.insightface`.
- **Database migrations:** `cd backend && venv/Scripts/python.exe -m alembic upgrade head`.
- **Frontend:** `cd frontend && npm run dev`. It serves on :8080 and proxies `/api` to :8000.
- **Today's state:** the local DB has the term "Autumn 2026" (2026-09-13 to 2027-01-15), so classes are live. If no term covers the current date the app reports `between_terms`; create a term in Semester Setup to see classes. Local logins are in [testing.md](testing.md).
