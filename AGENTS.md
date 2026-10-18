# AGENTS.md: AttendAI

This is the orientation for AI coding agents and new developers. Read it first, then open the matching file in [`docs/system/`](docs/system/README.md) instead of re-exploring the codebase.

## What this is
AttendAI is a university attendance system built around face recognition. It began as a final-year project and is **not deployed**. The local PostgreSQL database holds **dummy data only**, and the owner doesn't mind losing it, so you don't need backups before migrations.

- **Roles:** admin, teacher (the DB role is `faculty`; the profile lives in `teachers`) and student.
- **Students** check in with their face during a time window around each class.
- **Teachers** take class registers.
- **Admins** manage students, teachers, faculties, timetables, terms, the calendar, attendance corrections and analytics.
- **A scheduler** creates class sessions and adds automatic absences after classes that were held.

## Repo map
| Path | What |
|---|---|
| `backend/app/` | FastAPI app: `main.py`, `core/` (config, db, security, **clock**), `api/routes/*.py` + `api/calendar.py`, `api/dependencies.py` (auth guards), `models/`, `services/` (domain logic) |
| `backend/alembic/` | Migrations (head `p20261018_face_verification`) |
| `backend/models/anti_spoof/` | MiniFASNet anti-spoofing ONNX models (Apache-2.0, committed) |
| `backend/tests/` | Real pytest suite: harness, domain-rule tests, route tests |
| `frontend/src/` | React app: `App.tsx` (routes), `components/layout/` (Teams-style shell), `components/ui/` (Fluent-styled primitives), `components/attendance-admin/`, `pages/`, `integrations/api/client.ts` (the `api` client), `index.css` + `tailwind.config.ts` (design tokens) |
| `docs/system/` | **Current documentation** (architecture, domain rules, face verification, database, API, frontend, testing, known issues) |
| `tests/backend/` (repo root) | Legacy ad-hoc scripts, not tests. Excluded from pytest |

## Commands
- **Backend dev server:** `cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`. On Linux or macOS use `venv/bin/python`.
- **Migrations:** `cd backend && venv/Scripts/python.exe -m alembic upgrade head`
- **Backend tests:** `cd backend && venv/Scripts/python.exe -m pytest -q`. They build a throwaway `attendancedb_test`. When running tests in parallel, give each run its own database with `ATTENDAI_TEST_DB_NAME=attendancedb_test_gw<N>` (the harness only accepts names matching `^attendancedb_(test|migtest)(_gw\d+)?$`).
- **Frontend:** `cd frontend && npm run dev` (:8080, proxies `/api` to :8000), `npm run build`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit` (13 pre-existing errors are the baseline). Use **npm**, not bun.

## Golden rules
1. **The attendance rules live in [`docs/system/domain-rules.md`](docs/system/domain-rules.md) and in `backend/app/services/`.** Routes call these services; never re-implement rules in routes or the frontend:
   - `attendance_recording.py` is the only writer of attendance;
   - `attendance_metrics.py` is the only place percentages are calculated;
   - `term_service.py` decides the term;
   - `instructional_calendar.py` decides which days have classes;
   - `class_sessions.py` manages class sessions;
   - `auto_absent_service.py` is the finalizer that adds automatic absences.
2. **The unit of attendance is a class session** (`class_sessions`: one timetable slot on one date). There are no per-student "cancelled" rows; cancellation lives on the session.
3. **No fabricated absences.** Automatic absences apply only to sessions that were held, after `end + grace`, and never before `tracking_start_date`. Sessions nobody recorded are surfaced as *unrecorded*.
4. **Never silently overwrite or delete attendance.** Changes go through the recording service, which writes `attendance_audit_log`. Deleting people deactivates `users.is_active`. Foreign keys to attendance use RESTRICT.
5. **Time:** use `app.core.clock` (`app_now()`, `app_today()`, Asia/Kathmandu) for every business decision. Never use `datetime.now()`, `date.today()` or `CURRENT_DATE` there.
6. **Terms come from `semester_configurations` by date.** `academic_year` is a label; never compare it with the calendar year.
7. **Auth:** every write endpoint needs a guard from `api/dependencies.py` (`tests/test_route_guards.py` enforces this). Compare roles with `has_role(user, "admin" | "teacher" | "student")`, never `user.role == "admin"` (the role is an Enum). Student-scoped reads go through `resolve_student_scope`.
8. **API compatibility:** keep endpoint paths and response field names; only add fields. Percentages may be `null` (no data), and the legacy numeric fields stay numbers.
9. **Frontend design system:** Microsoft Teams / Fluent 2 tokens. Use only the semantic Tailwind classes (`bg-surface-*`, `text-text-*`, `border-border-*`, `bg-brand`/`text-brand-foreground`, `status-*`, `chart-1..8`), never raw palette colours like `bg-blue-500`. Prefer `@fluentui/react-icons`. See [`docs/system/frontend.md`](docs/system/frontend.md).
10. **Server-authoritative UI:**
    - Check-in windows, `term_state`, eligibility and bands come from the API.
    - Registers send only changed rows and handle `400 invalid_entries`, `409 confirm_held` and `409 session_cancelled`.
    - Show "—" for null percentages and "Not marked" for null statuses.
11. **Face verification rules live in [`docs/system/face-verification.md`](docs/system/face-verification.md).** Model access only through the `insightface_service` singleton (`aprocess_frames`, never model calls on the event loop); thresholds only from `face_policy`; embeddings never leave the server (`face_encoding` is always `null` in payloads; use `face_registered`); students never see similarity scores.
12. **Tests encode the rules.** Never weaken an assertion to make code pass. If code contradicts the rules, fix the code; if a rule is genuinely wrong, change the docs and tests together.

## Gotchas
- **Enum storage:** the DB enum `day_of_week` stores names (`'SUNDAY'`), and attendance status values are lowercase (`'present'`). The `SessionStatus`, `AttendanceSource` and `AuditAction` StrEnums have lowercase members (`SessionStatus.cancelled`).
- **Several events per day are legal.** Don't use `scalar_one_or_none()` on events, schedules for a subject, or conflict queries; use `.first()` or `exists()`.
- **Today is between terms.** No term covers today, so the app shows no classes until a term is created in Semester Setup.
- **Few teacher assignments:** only 30 of 2,160 timetable rows have a teacher, so most sessions are admin-resolved.
- **Alembic quirks:** `alembic upgrade head` doesn't work on an *empty* DB (4 root migrations; tests use `backend/tests/schema/baseline.sql`). Never run `alembic revision --autogenerate` blindly; models drift from the DB outside the redesigned tables.
- **tsconfig:** if `frontend/tsconfig.app.json` gains `"ignoreDeprecations": "6.0"`, remove it. TypeScript 5.6 rejects it.
- **Frontend auth token:** read and write the JWT only through `frontend/src/lib/authToken.ts` (`getAuthToken`, `setAuthToken`, `clearAuthToken`). It may live in localStorage or sessionStorage.
- **Frontend API base:** call the backend through `api.*` or relative `/api/...` URLs, never `http://localhost:8000`.
- **App import is slow:** importing `app.main` loads the InsightFace models (about 6 s). Tests stub it.
- **Git ignores:** `.gitignore` ignores `*.md` except README, AGENTS, CLAUDE and `docs/system/`, and ignores root `tests/`. `backend/tests/` is re-included.

## Keeping docs current (part of every change)
The docs are only useful if they match the code, so **a change is not finished until the docs describe it**. Update them in the same change, not "later":

| If you change… | Update |
|---|---|
| Attendance rules (sessions, windows, statuses, terms, holidays, auto-absent, metrics, permissions) | `docs/system/domain-rules.md` |
| Face enrolment, check-in, liveness, presence codes, face policy or the engine | `docs/system/face-verification.md` |
| Tables, columns, constraints, settings keys, or a new migration (and the head revision) | `docs/system/database.md` (+ the head revision in the repo map above) |
| Endpoints: paths, guards, request or response fields, error codes | `docs/system/api-reference.md` |
| Screens, routes, components, the design system, `api` client methods, query keys | `docs/system/frontend.md` |
| Components, services, flows, config or env vars, how to run things | `docs/system/architecture.md` |
| Tests, fixtures, the harness | `docs/system/testing.md` |
| A pitfall, workaround, known bug, tech debt or operational state (e.g. "no current term") | `docs/system/known-issues.md` (remove entries you fix) |
| Repo layout, commands, golden rules, gotchas | this file (`AGENTS.md`); Claude-specific workflow notes go in `CLAUDE.md` |
| A new doc file | `docs/system/README.md` (the index) |

- When the code and a doc disagree, the code wins: fix the doc and mention the mismatch in your summary.
- Delete or rewrite outdated text; don't append contradictions next to it.
- In your final summary, list which docs you updated (or say why none needed it).
