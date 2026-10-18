# AttendAI API reference

Endpoint map for the FastAPI backend, written for developers and AI coding agents who need to find
or change an endpoint without reading the whole backend. The route inventory below was generated
by walking `app.routes` (2026-10-18; the face-verification redesign removed the `face-testing` router and added the enrolment, challenge, policy, presence-code and attempts routes). Where a table and the code disagree, the code
wins.

- App entry: `backend/app/main.py`. Routers: `backend/app/api/routes/*.py` plus `backend/app/api/calendar.py`.
- Auth dependencies: `backend/app/api/dependencies.py`. Business rules are in `backend/app/services/*`.
  Routes parse input, check guards, call services, commit, and translate `DomainError`.
- Frontend wrapper: `frontend/src/integrations/api/client.ts` (`export const api = { auth, students, ... }`,
  `API_BASE = '/api'`, Vite proxies `/api` to `http://127.0.0.1:8000`). Each section names the main namespace.
- Interactive schema: `/docs` (Swagger) and `/redoc` on the running backend.

---

## 1. Conventions

### 1.1 Base URL and paths
- Every router is mounted under `/api`. `admin_calendar_config` has `/api` in its own prefix; the
  others get it from `include_router(..., prefix="/api")`. Only `/` and `/health` are outside `/api`.
- Paths in the tables leave out the `/api` prefix. Some collection routes are defined with a
  trailing slash (`/students/`, `/faculties/`, `/subjects/`, `/admins/`, `/teachers/`, `/notifications/`,
  `/admin/semester-config/`). Others have none (`/attendance`, `/schedules`, `/classes`).
  FastAPI 307-redirects the other spelling, so call the exact path.
- Dates are `YYYY-MM-DD`, times `HH:MM`, in the app timezone (`Asia/Kathmandu`, via `app.core.clock`).
  Datetimes are ISO strings in local time.

### 1.2 Authentication
- `POST /api/auth/login` with `{email, password}` returns `{access_token, token_type: "bearer", user: {id, email, full_name, role, is_active, created_at, updated_at}}`.
- Send `Authorization: Bearer <token>`. The JWT claims are `sub` (users.id as a string) and `role`.
  Lifetime is `settings.access_token_expire_minutes` (default 30). `POST /auth/refresh-token` needs a
  token that is still valid. Logout does nothing on the server (tokens are stateless).
- `get_current_user` returns 401 when the token is invalid or expired, the user is missing or
  inactive, or the token's role differs from the DB role. Messages: "Could not validate credentials",
  "User not found", "Inactive user", "Role mismatch".
- **No `Authorization` header gives 403 `{"detail":"Not authenticated"}`** (FastAPI 0.116
  `HTTPBearer`). A non-Bearer scheme also gives 403. A wrong role gives 403
  ("Not enough permissions" / "Admin access required" / ...). The client wrapper calls refresh-token
  once on any 401/403, then throws.

### 1.3 Roles and guards
The stored roles are `admin`, `faculty` (the teacher role) and `student`. `has_role(user, "teacher")`
also matches `faculty`. Always use `has_role`/`role_of`: `user.role` is an enum, so `== "admin"` is always False.

| Guard (tables) | Dependency | Meaning |
|---|---|---|
| `public` | none | No token needed |
| `auth` | `get_current_user` | Any authenticated user. Many handlers restrict further in code (noted as `auth→...`) |
| `admin` | `require_admin_role` | role admin |
| `admin+` | `get_current_admin` | role admin **and** an `admins` profile row (404 "Admin profile not found" otherwise) |
| `staff` | `require_teacher_or_admin` (= `require_admin_or_teacher`) | admin or faculty. Session endpoints also check ownership (`not_session_teacher` 403) |
| `teacher` | `get_current_teacher` | faculty role + `teachers` row (404 otherwise). **Admins get 403** on `/teacher/*` |
| `student` | `get_current_student` | student role + `students` row |
| `debug` | `require_debug_admin` | 404 unless `settings.debug`, then admin only |
| `scope` | `resolve_student_scope()` in handler | student: self only; teacher: students in cohorts (faculty_id+semester) they have a schedule row for; admin: anyone; otherwise 403 |

`require_roles(*roles)` exists but no route uses it at the moment.

### 1.4 Error shapes
| Case | Status | Body |
|---|---|---|
| Missing token / non-Bearer | 403 | `{"detail": "Not authenticated"}` |
| Bad/expired token | 401 | `{"detail": "Could not validate credentials"}` (+ `WWW-Authenticate: Bearer`) |
| Pydantic validation | 422 | `{"detail": [{loc, msg, type, ...}]}` |
| Legacy `HTTPException` | 4xx | `{"detail": "<string>"}` |
| `DomainError` via `err.to_http_exception()` (analytics, calendar, streaks, metrics routes) | `err.http_status` | `{"detail": {"code", "message", "details": {...}}}` |
| `DomainError` in `attendance.py` / `teacher_dashboard.py` | `err.http_status` | `{"detail": {"code", "message", "details": {...}, ...details flattened}}`, e.g. `detail.session_id`, `detail.slots`, `detail.students_without_record` |
| Per-entry validation (`validation_failed` from the service) | **400** | `{"detail": {"code": "invalid_entries", "message", "errors": [{student_id, code, message}], "session_id", ...}}`. The teacher routes also add `invalid_students: [{student_id, reason}]` |
| Register conflicts | 409 | `detail.code` in `confirm_held` (+`students_without_record`), `session_cancelled`, `ambiguous_session` (+`slots`), `session_not_started`, `already_cancelled`, `not_cancelled`, `not_flagged`, `slot_taken`, `session_overlap`, `session_conflict` |
| Face check-in business rejection | **200** | `{"success": false, "message", "code", "attendance_marked": false, ...}` (`err.to_legacy_response()`) |
| Retired endpoint | 410 | `{"detail": "<message>"}` |

- `DomainError` (`backend/app/services/domain_errors.py`) has fields `code`, `message`,
  `http_status` (default 400) and `details`. Helpers: `not_found` (404), `forbidden` (403),
  `conflict` (409), `invalid` (422). Services raise 422 for `reason_required`, `invalid_time_range`,
  `not_expected` and similar codes, and routes pass that status through.
- **404 handling:** `@app.exception_handler(404)` in `main.py` returns a generic
  `{"detail": "The requested resource was not found"}` only for unknown routes (Starlette's default
  "Not Found"). An explicit `HTTPException(404, detail=...)` raised by an endpoint keeps its `detail`,
  so structured codes such as `session_not_found`, `record_not_found`, `term_not_found` and
  `before_tracking_start` reach the client (covered by `tests/test_app_wiring.py`).

### 1.5 Domain vocabulary
- Session `status`: `scheduled | held | cancelled`. `kind`: `regular | makeup`.
  `class_sessions` rows are materialized on demand from the timetable for dates up to today inside an active term.
- Record `status`: `present | late | absent | excused` (`excused` is admin-only). `null` means unmarked;
  unmarked is never read as absent.
- Record `source`: `teacher | admin | student_face | system_auto | legacy`. Records have
  `excluded_from_metrics` and `exclusion_reason`.
- `term_state`: `active | between_terms | no_terms`. Term row `state` (semester-config only):
  `current | upcoming | past | inactive`.
- `day_status` (student today): `instructional | holiday | weekly_off | exam | between_terms`, plus
  `no_cohort` for a student without a faculty.
- Calendar day status (`/attendance/calendar`, `/student-calendar/*`): `present, absent, partial,
  excused, cancelled, unrecorded, no_class, future, holiday, weekly_off, exam, between_terms`.

### 1.6 Other gotchas
- CORS allows GET/POST/PUT/PATCH/DELETE/OPTIONS. Allowed origins are the local dev ports plus
  anything listed in `ALLOWED_ORIGINS` (`backend/.env`).
- Routes own the transaction: services flush, routes `commit()`, and roll back on `DomainError`.
  Some GETs commit because they materialize sessions (`/attendance/sessions`, `/schedules/today`,
  registers, ...).

---

## 2. Endpoints by router

Purpose lines are condensed from handler docstrings and code. DEPRECATED = still served but
superseded; 410 = retired.

### 2.1 Auth — `routes/auth.py` — `api.auth`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | /auth/login | public | Email+password → token + user. 401 "Incorrect email or password" / "Account is inactive" |
| POST | /auth/register-student | admin+ | DEPRECATED legacy student creation (does not set faculty_id/semester/batch). The UI uses `POST /students/` |
| GET | /auth/me | auth | Current user |
| POST | /auth/logout | auth | No-op (stateless) |
| POST | /auth/refresh-token | auth | Re-issue a token (same `Token` shape) |
| POST | /auth/forgot-password | public | Records a reset request: issues a fresh token, invalidates older ones, never returns the token |
| POST | /auth/admin/generate-reset-link | admin+ | Issue a fresh reset token/link for a user |
| GET | /auth/admin/reset-requests | admin+ | Unused reset tokens with server-computed expiry flag |
| POST | /auth/reset-password | public | Set a new password with a valid reset token |

### 2.2 Students — `routes/students.py` — `api.students`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /students/ | auth | `skip`,`limit`. Admin and teacher: all students. Student: only self |
| GET | /students/{student_id} | auth | One student. Students can read only their own |
| POST | /students/ | admin | Create user + student. `faculty_id` required; `student_id` auto-generated when omitted; email and student_id must be unique |
| PUT | /students/{student_id} | auth→admin/self | Admin: any field, validated. Student: own contact fields only (phone_number, emergency_contact, profile_image_url). A changed protected field → 403 |
| DELETE | /students/{student_id} | admin | Default deactivates the login. `?hard=true` deletes only when there are no attendance records (409 otherwise) |
| GET | /students/{student_id}/face | admin | Face enrolment status, template poses and the last 50 enrolment events (face-verification.md §8) |
| POST | /students/{student_id}/face/reset | admin | `{reason}` (≥3 chars, else 400 `reason_required`). Deletes the templates; status `reset`, so the student can enrol again |

Student payloads never contain embeddings: `face_encoding` is always `null`. They carry `face_registered`, `face_registered_at` and `face_enrollment_status` (`none` / `enrolled` / `reset` / `deleted`).

### 2.3 Admins — `routes/admins.py`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /admins/ | admin+ | List admins (`skip`,`limit`) |
| GET | /admins/{admin_id} | admin+ | One admin |
| POST | /admins/ | admin+ | Create admin user |
| PUT | /admins/{admin_id} | admin+ | Update admin |
| DELETE | /admins/{admin_id} | admin+ | Delete admin |
| GET | /admins/me | admin+ | The caller's own admin profile (registered before `/{admin_id}`) |

### 2.4 Teachers (admin management) — `routes/teachers.py` — `api.teachers` (`/teachers/me` via `api.teacher`)
| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | /teachers/ | admin | Create teacher account (201) |
| GET | /teachers/ | auth | List teachers (`skip`,`limit`,`faculty_id`) |
| GET | /teachers/me | auth→faculty | Own teacher profile |
| PUT | /teachers/me | auth→faculty | Update own profile |
| GET | /teachers/{teacher_id} | auth | One teacher |
| PUT | /teachers/{teacher_id} | admin | Update teacher |
| DELETE | /teachers/{teacher_id} | admin | Delete teacher (204) |
| GET | /teachers/stats/count | admin | Count (optional `faculty_id`) |
| GET | /teachers/{teacher_id}/assignments | admin | Schedule rows assigned to the teacher |
| POST | /teachers/{teacher_id}/assignments | admin | Assign: sets `class_schedules.teacher_id` |
| DELETE | /teachers/{teacher_id}/assignments/{schedule_id} | admin | Unassign: sets `teacher_id = NULL` (204) |
| GET | /teachers/schedules/unassigned | admin | Schedule rows without a teacher (`faculty_id`,`semester`) |

### 2.5 Faculties — `routes/faculties.py` — `api.faculties`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /faculties/ | **public** | List faculties |
| POST | /faculties/ | admin | Create faculty |
| GET | /faculties/{faculty_id}/cascade-preview | admin | What a delete would remove or block |
| DELETE | /faculties/{faculty_id} | admin | 409 if students, attendance, events or targeted notifications reference it. `?force=true` also removes unused subjects and schedules |

### 2.6 Subjects and legacy classes — `routes/subjects.py`, `routes/classes.py` — `api.subjects`, `api.classes`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /subjects/ | auth | Subjects, optional `faculty_id`,`semester` |
| GET | /subjects/by-faculty-semester | auth | Required `faculty_id`, optional `semester` |
| GET | /subjects/by-faculty | auth | Required `faculty_id` |
| POST | /subjects/ | admin | Create subject |
| GET | /subjects/{subject_id} | auth | One subject |
| DELETE | /subjects/{subject_id} | admin | Delete subject |
| GET | /subjects/debug-auth, /subjects/debug-test | debug | Bearer-auth sanity checks |
| GET | /classes | auth | DEPRECATED: subjects shown as "classes" (`skip`,`limit`) |
| GET | /classes/{class_id} | auth | DEPRECATED: one subject as a class |
| POST/PUT/DELETE | /classes, /classes/{class_id} | admin+ | DEPRECATED: create/update/delete a subject through the classes view |

### 2.7 Schedules (timetable) — `routes/schedules.py` — `api.schedules`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | /schedules | admin+ | Create timetable row. Conflict checks: cohort, classroom, teacher overlap |
| GET | /schedules | auth | Filters `faculty_id, semester, academic_year, day_of_week, is_active, skip, limit` (paging only when `limit` is set) |
| GET | /schedules/today | auth | Today's sessions (optional cohort). `?envelope=true` → `{date, term_state, day_status, day_status_detail, items}` |
| GET | /schedules/student/today | student | Today's sessions for the student's cohort with `my_status` + check-in window (§3.2) |
| PUT | /schedules/{schedule_id} | admin+ | Update row (re-validated). Edits apply from the next materialized day |
| DELETE | /schedules/{schedule_id} | admin+ | Hard delete only without history, otherwise deactivates |
| POST | /schedules/{schedule_id}/toggle | admin+ | Toggle `is_active`. Re-activation that overlaps → 409 |

### 2.8 Attendance and sessions — `routes/attendance.py` — `api.attendance`, `api.attendanceAdmin`, `api.sessions`, `api.records`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /attendance | auth→scoped | Record list. Filters `student_id, subject_id, faculty_id, semester, status, date, start_date, end_date, search, skip, limit` → `{records, total, skip, limit, hasMore}`. Students: own only. Teachers: own cohorts |
| GET | /attendance/summary | auth+scope | Metrics summary (`student_id?, start_date?, end_date?` as of, `term_id?`). No `student_id` gives an aggregate (admin: everyone; teacher: own cohorts) |
| GET | /attendance/student-subject-breakdown/{student_id} | auth+scope | Per-subject term-to-date metrics. `month`/`year` only move the as-of date |
| GET | /attendance/calendar | auth→student | Own month calendar (`year`,`month` required) |
| GET | /attendance/students-by-subject | staff | Register-style roster for `faculty_id, semester, subject_id` (+`date, session_id, start_time`). Teacher must teach that class. `attendance_status: null` when unmarked; legacy `status: "no_data"` |
| GET | /attendance/sessions/unrecorded | staff | Unrecorded or review-flagged sessions, paginated (§3.4) |
| GET | /attendance/sessions | staff | Sessions on `date` (default today) + filters `faculty_id, semester, subject_id` → `{date, sessions, total}`. Teacher: own only |
| POST | /attendance/sessions/makeup | staff | Create a make-up session (§3.4) |
| GET | /attendance/sessions/{session_id}/register | staff (owner) | Session + roster with records |
| POST | /attendance/sessions/{session_id}/register | staff (owner) | Register submission (`submit=True`) |
| POST | /attendance/sessions/{session_id}/cancel | staff (owner) | Cancel (`{reason}` required). Records kept, excluded from metrics |
| POST | /attendance/sessions/{session_id}/uncancel | staff (owner) | Restore (`{reason}`) |
| POST | /attendance/sessions/{session_id}/clear-review | admin | Clear `review_required` (`{reason}`) |
| GET | /attendance/sessions/{session_id}/presence-code | staff (owner) | Current rotating check-in code + QR deep link (§3.11). 403 `not_session_teacher`, 404 `session_not_found`, 409 `not_today` / `session_cancelled` |
| GET | /attendance/sessions/{session_id}/face-attempts | staff (owner) | Face check-in attempts, newest first (max 200), with a summary over all attempts (§3.11) |
| PATCH | /attendance/records/{record_id}/metrics-exclusion | admin | `{excluded, reason}`, audited |
| GET | /attendance/records/{record_id}/audit | staff | Audit trail (teacher: own sessions only) |
| POST | /attendance | admin | Single-record write (not a submission). `confirm_held` (§3.6) |
| POST | /attendance/mark-bulk | admin | Register submission for one resolved session (§3.5) |
| POST | /attendance/auto-absent | admin | DEPRECATED alias of `POST /auto-absent/trigger` (`?target_date=`). Errors use the structured shape (422 `invalid_target_date`) |
| GET | /attendance/auto-absent/stats | admin | Auto vs manual absent counts for `target_date` (default today) |
| GET | /attendance/{attendance_id} | auth+scope | One record. Keep this route last: it is a catch-all path parameter |

### 2.9 Teacher portal — `routes/teacher_dashboard.py` (prefix `/teacher`) — `api.teacher`
All routes need a teacher profile (`teacher`). Admins cannot use them.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /teacher/dashboard | teacher | Profile, `stats` (incl. `unrecorded_sessions`), `subjects`, `today_schedule[]` (each item has `session_id, session_status, kind, recorded_count, roster_size, submitted_at, is_cancelled`), `term_state`, `term` |
| GET | /teacher/schedule | teacher | Own timetable (`day_of_week?`) |
| GET | /teacher/subjects/{subject_id}/students | teacher | Today's roster of each cohort the teacher teaches the subject to (`semester` required, `faculty_id?`) |
| GET | /teacher/subjects/{subject_id}/students-with-attendance | teacher | The register of one session (§3.3) |
| GET | /teacher/subjects/{subject_id}/attendance | teacher | Records for the subject in own cohorts (`start_date?, end_date?`) |
| GET | /teacher/subjects/{subject_id}/analytics | teacher | Cohort-subject metrics (`semester` required, `faculty_id?, term_id?`) |
| POST | /teacher/attendance/mark | teacher | Single student write (`confirm_held` supported) |
| POST | /teacher/attendance/bulk-mark | teacher | Register submission (§3.3) |
| GET | /teacher/attendance/my-classes | teacher | Subject+semester+faculty combinations taught |
| GET | /teacher/calendar | teacher | Events for own subjects (`start_date`,`end_date` required) |
| POST | /teacher/notifications/send | teacher | Notify the students of one of own subject/semester classes |
| POST | /teacher/classes/cancel | teacher | Cancel own session: `session_id`, or `schedule_id`+`date`; `reason`; `notify_students` (default true). Wrong weekday/holiday → 422 `not_expected` |
| POST | /teacher/classes/uncancel | teacher | Restore: `session_id`, or `subject_id`+`date` (+`schedule_id/faculty_id/semester/start_time`); `reason` required |
| GET | /teacher/notifications | teacher | Notifications sent by or relevant to the teacher (`skip`,`limit`) |
| GET | /teacher/notifications/inbox | teacher | Inbox (`only_unread, skip, limit`) |
| POST | /teacher/notifications/{notification_id}/read | teacher | Mark read (idempotent) |
| POST | /teacher/notifications/{notification_id}/clear | teacher | Dismiss one |
| POST | /teacher/notifications/clear | teacher | Dismiss all |

### 2.10 Student attendance — `routes/student_attendance.py`, `routes/student_calendar.py` — `api.studentAttendance`, `api.attendance` (calendar)
`/student-attendance/*` reads the caller's own `students` row and returns 404 "Student record not found" for non-students.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /student-attendance/summary | auth→own student | Term metrics block + planned/held session context (`term_id?`) |
| GET | /student-attendance/records | auth→own student | History incl. non-counted records (`start_date, end_date, subject_id, status, limit, offset`) |
| GET | /student-attendance/subject-breakdown | auth→own student | Per-subject metrics + cohort subjects without data. Bare list by default; `?envelope=true` → `{subjects, total_subjects, ...metric fields}` |
| GET | /student-attendance/analytics | auth→own student | Period analytics (`period`, `term_id?`), countable sessions only |
| GET | /student-attendance/goals | auth→own student | Sessions needed to reach each target by term end |
| GET | /student-calendar/me | auth→own student | Month calendar (`year`,`month` required, `term_id?`) |
| GET | /student-calendar/{student_id} | auth+scope | Daily statuses, month stats, subject breakdown, term streaks |
| GET | /student-calendar/{student_id}/summary | auth+scope | Term (default) or `start_date..end_date` summary |

### 2.11 Face recognition — `routes/face_recognition.py`, `routes/face_enrollment.py` — `api.faceRecognition`
The rules are in [face-verification.md](face-verification.md). Model work always runs in a worker thread (`aprocess_frames`).

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /face-recognition/policy | auth | Public face policy subset (what the UI must collect) |
| POST | /face-recognition/challenge | student | Single-use liveness challenge `{purpose: checkin|enrolment, session_id?, subject_id?, schedule_id?}` → §6 payload. 400 `invalid_purpose`, 409 `no_registered_face` (check-in), 404 `session_not_found` |
| POST | /face-recognition/mark-attendance | student | Self check-in with frames + challenge + presence code (§3.1) |
| POST | /face-recognition/verify-identity | student | Legacy identity check (1..frames_max frames, most frontal matched). `{matched, confidence_score (0.0 unless matched), message, code, quality_issues, retry_after_seconds}`; 400 `no_registered_face`. Logged and rate-limited like check-in |
| GET | /face-recognition/enrollment | student | Own enrolment state `{status, can_enroll, registered_at, model, template_count, consent_at, message}` |
| POST | /face-recognition/register-face-multi | student | Enrol `{images[], consent, challenge_id?}` (§3.12) |
| POST | /face-recognition/register-face | student | Same as `register-face-multi`; also accepts legacy `image_data` (string or list) |
| DELETE | /face-recognition/my-face | student | Delete own templates; status `deleted` (re-enrolling then needs an admin reset). Idempotent |
| GET | /face-recognition/my-attendance | student | Own records (legacy `AttendanceRecord` schema list) |
| POST | /face-recognition/verify-face | auth | Quality feedback for one image `{valid, faces_detected, message, feedback, face?, quality_issues}` |
| POST | /face-recognition/detect-faces | auth | Real-time detection feedback `{success, message, faces_detected, faces, feedback, ready_for_capture, quality_issues}` |
| POST | /face-recognition/live-recognition | staff | 1:N identify (active students only, threshold = `match_threshold`). Bands relative to the threshold: excellent ≥ +0.25, good ≥ +0.10, else fair |
| GET | /face-recognition/service-status | **public** | `{status, message, service, model_id, liveness_available, models, policy}` |

`/detect-glasses` was removed (the model never supported it); the debug `face-testing` router is gone.

### 2.12 Calendar and events — `api/calendar.py`, `routes/event_sessions.py` — used directly in `frontend/src/pages/AcademicCalendar.tsx`
Event types: `class, holiday, exam, special_event, cancelled_class`. `holiday`, `exam` (when exams
suspend classes) and `cancelled_class` events **reconcile class sessions in the same transaction**:
sessions they cover are cancelled, and sessions that already have records are flagged
`review_required`. Responses then include `session_impact: {cancelled, review_required, restored,
reassigned, review_cleared, cancelled_session_ids, review_session_ids}`.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /calendar/events | auth→role-filtered | Events overlapping `start_date..end_date` (both required), `event_type?` |
| GET | /calendar/month/{year}/{month} | auth | Month view |
| POST | /calendar/events | admin | Create (`title, event_type, start_date, end_date?, start_time?, end_time?, is_all_day, holiday_type?, subject_id?, faculty_id?, color_code "#RRGGBB", ...`) |
| PUT | /calendar/events/{event_id} | admin | Update. Changes to date, scope, type or active re-reconcile sessions |
| DELETE | /calendar/events/{event_id} | admin | Soft delete (`is_active=false`), restores sessions the event cancelled |
| GET | /calendar/events/{event_id}/attendance | admin | Event attendance (legacy event attendance, not class attendance) |
| POST | /calendar/events/{event_id}/attendance | auth→student self/admin | Mark event attendance |
| GET/PUT/POST | /calendar/settings | auth | Per-user calendar settings (POST = upsert alias) |
| GET | /calendar/stats/overview | auth | Calendar overview counts |
| POST | /event-sessions/events/{event_id}/sessions | staff | Add a sub-session to an event |
| GET | /event-sessions/events/{event_id}/sessions | auth | List an event's sub-sessions |
| GET | /event-sessions/events/{event_id}/with-sessions | auth | Event + sub-sessions |
| PUT | /event-sessions/sessions/{session_id} | staff | Update event sub-session |
| DELETE | /event-sessions/sessions/{session_id} | staff | Deactivate event sub-session |
| POST/GET | /event-sessions/sessions/{session_id}/attendance | staff | Mark / list event sub-session attendance |
| GET | /event-sessions/students/{student_id}/session-attendance | auth+scope | A student's event-session attendance (`event_id?`) |

Event sub-sessions (`event_sessions`) are not class sessions (`class_sessions`).

### 2.13 Semester config (terms) — `routes/admin_semester_config.py` — `api.semesterConfig` / `api.semesterConfiguration`
`semester_configurations` is the single source of truth for terms. See §3.8.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /admin/semester-config/ | admin | All terms, newest first (`active_only?`), with computed `is_current`, `state` |
| GET | /admin/semester-config/current | admin | Term containing today, else 404 `{detail, term_state}` |
| GET | /admin/semester-config/validate/dates | admin | Advisory check (`start_date, end_date, exclude_id?`) |
| GET | /admin/semester-config/{config_id} | admin | One term |
| POST | /admin/semester-config/ | admin | Create (201) |
| PUT | /admin/semester-config/{config_id} | admin | Partial update, re-validated |
| DELETE | /admin/semester-config/{config_id} | admin | Deactivate (204). Never a hard delete; `soft_delete` is ignored |
| POST | /admin/semester-config/{config_id}/set-current | admin | **410**: the current term is decided by its dates |

### 2.14 Academic calendar config — DEPRECATED — `routes/admin_calendar_config.py`
Month/day overrides no longer resolve terms. Writes return **410** `{"detail": "Academic periods are managed in Semester Setup"}`.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /admin/academic-calendar/current | **public** | Informational month/day boundaries |
| GET | /admin/academic-calendar/defaults | **public** | Legacy defaults (informational) |
| GET | /admin/academic-calendar/overrides | admin | Override history (`include_inactive?`) |
| POST | /admin/academic-calendar/override | admin | **410** |
| DELETE | /admin/academic-calendar/override/{override_id} | admin | **410** |

### 2.15 Calendar generator — RETIRED — `routes/calendar_generator.py`
Class sessions come from the timetable, so CLASS events are no longer generated.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | /calendar-generator/auto-generate | admin | **410** |
| POST | /calendar-generator/generate-semester | admin | **410** |
| POST | /calendar-generator/cleanup-old-events | admin | **410** (events are never hard-deleted) |
| POST | /calendar-generator/regenerate-date-range | admin | **410** |
| GET | /calendar-generator/status | auth | `{status: "disabled", message, term_state, semester}` |

### 2.16 Auto-absent — `routes/auto_absent_trigger.py` — `api.autoAbsent`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | /auto-absent/trigger | admin+ | Run materialization + finalization now (§3.10) |
| GET | /auto-absent/status | admin+ | `auto_absent_service.get_status()` verbatim |
| GET | /auto-absent/runs | admin+ | `job_runs` history (`limit` 1-200, default 20) |

### 2.17 System settings and policy — `routes/system_settings.py` (prefix `/system-settings`) — `api.attendancePolicy`, `api.systemSettings`
Thresholds are contiguous half-open bands over 0-100. The lowest starts at 0, and the
at-risk/critical boundary equals `attendance_minimum`. Writes that break this → 400 `{detail: message}`.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /system-settings/attendance-policy | auth | Effective policy + bands + term state (§3.9). The client caches it (`api.attendancePolicy.get`, `.invalidate()`) |
| GET | /system-settings/attendance-thresholds | auth | Bands (`active_only?`) |
| GET | /system-settings/attendance-thresholds/{threshold_id} | auth | One band |
| POST | /system-settings/attendance-thresholds | admin | Create band (201): `{name, min_percentage, max_percentage?, color, badge_style, label, description?, order}` |
| PUT | /system-settings/attendance-thresholds/{threshold_id} | admin | Update band (set must stay valid) |
| DELETE | /system-settings/attendance-thresholds/{threshold_id} | admin | Delete band (204) |
| POST | /system-settings/attendance-thresholds/reset | admin | Reset to defaults (at-risk starts at the current minimum) |
| GET | /system-settings/settings | auth | Settings (`category?`) |
| GET | /system-settings/settings/{key} | auth | One setting |
| PUT | /system-settings/settings/{key} | admin | `{value: {...}, description?, is_active?}`. Can create `attendance_minimum`, `attendance_policy`, `academic_calendar_type`, `face_verification`. `face_verification` merges partial values; unknown keys, wrong types, out-of-range numbers and inconsistent pairs (`frames_max < frames_min`, `frontal_max_yaw ≥ head_turn_min_yaw`, `max_brightness ≤ min_brightness`) → 400. `attendance_minimum.percentage` must be in (0,100] and moves the band boundary |

### 2.18 Analytics, metrics, dashboards — `analytics.py`, `academic_metrics.py`, `session_metrics.py`, `comprehensive.py` — `api.analytics`, `api.academicMetrics`, `api.dashboard`
Every percentage comes from `services/attendance_metrics.py` (§3.7). Endpoints without
`scope` do not filter by role.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /analytics/class-averages | auth | School-wide session-weighted average over the reporting term (`class_id?, term_id?`) |
| GET | /analytics/student-insights/{student_id} | auth+scope | Term metrics, policy-band risk, short-term trend |
| GET | /analytics/attendance-trends | auth+scope | Daily rate over the last `days` (`student_id?`) |
| GET | /analytics/weekly-breakdown | auth | Day-by-day for last `days` |
| GET | /analytics/top-performers | auth | Highest attendance (`limit, min_classes, term_id?`) |
| GET | /analytics/subject-wise | auth | Per-subject over the reporting term |
| GET | /analytics/insights | auth | Rule-based insights (policy thresholds) |
| GET | /analytics/dashboard-summary | auth | Today / 7 / 30-day summary. Each block has counts, `considered` (= `total_records`), `percentage` (null when no data), `has_data`, `band`, `band_label`, `eligible` and `eligibility_provisional` from `attendance_metrics`; the admin dashboard reads it |
| GET | /academic-metrics/calculate | auth | Planned instructional days/periods for a range (`start_date, end_date` required) |
| GET | /academic-metrics/current-semester | auth (+scope for `student_id`) | Planned days/periods for the reporting term + the student's metrics |
| GET | /academic-metrics/detailed-breakdown | auth | Instructional days with planned sessions |
| GET | /academic-metrics/summary | auth | `{total_academic_days, total_periods}` |
| GET | /academic-metrics/validate-data | auth | Instructional days without planned periods |
| GET | /session-metrics/comprehensive | auth+scope | Planned vs held sessions for a range |
| GET | /session-metrics/attendance-with-deviation | auth→own student | Own range attendance with planned/held context |
| GET | /session-metrics/deviation-summary | auth | Planned vs held days, unrecorded/cancelled counts |
| GET | /session-metrics/student-specific | auth→own student | Own range metrics |
| GET | /dashboard/stats | admin | Row counts of main tables |
| GET | /sidebar/stats | auth | Sidebar counters (`attendance_rate` = today attended/considered) |
| GET | /system/health | auth | Process/system health metrics |
| GET | /realtime/metrics | auth | System monitoring metrics |
| GET | /attendance-with-details/ | auth→role-scoped | DEPRECATED: records with student/subject relations |
| GET | /student-performance/ | auth | DEPRECATED: per-student performance data |

### 2.19 Notifications — `routes/notifications.py` — `frontend/src/services/notificationService.ts`
These handlers accept only **student or admin** callers. Teachers get 403 and use `/teacher/notifications/*`.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /notifications/faculties | auth→admin | Faculties (with students) for targeting |
| POST | /notifications/ | auth→admin | Create notification |
| GET | /notifications/ | auth→student/admin | Notifications for the caller |
| PUT | /notifications/{notification_id}/read | auth | Mark read |
| DELETE | /notifications/{notification_id} | auth→admin | Delete |
| GET | /notifications/inbox | auth→student/admin | Inbox (`only_unread, skip, limit`), excludes dismissed |
| POST | /notifications/{notification_id}/mark-read | auth→student/admin | Mark read (idempotent) |
| POST | /notifications/{notification_id}/dismiss | auth→student/admin | Dismiss one |
| POST | /notifications/dismiss-all | auth→student/admin | Dismiss all |

### 2.20 Streaks and badges — `routes/streaks_badges.py` — `api.streaks`
Streak = trailing run of class days on which every countable record was attended. Uses the reporting term.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /streaks-badges/my-streaks | auth→own student | Own streaks (`period_days?, term_id?`) |
| GET | /streaks-badges/{student_id}/streaks | auth→admin | A student's streaks |
| GET | /streaks-badges/my-badges | auth→own student | Own badges |
| GET | /streaks-badges/{student_id}/badges | auth→admin | A student's badges |
| GET | /streaks-badges/leaderboard | auth | Admin: everyone. Others: own faculty (needs a student row) → `{leaderboard, total_students}` |

### 2.21 Debug (admin + DEBUG only) — `main.py`, `routes/subjects.py`
All return 404 unless `settings.debug` is true. The old `face-testing` router was removed.

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | /api/__routes | debug | Route list |
| GET | /subjects/debug-auth, /subjects/debug-test | debug | See §2.6 |

### 2.22 Misc
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | / (no `/api`) | public | `{message, version, docs}` |
| GET | /health (no `/api`) | public | `{status: "healthy", version}` |

---

## 3. Key contracts

Shapes are taken from the handlers. `//` marks comments. Optional request fields are marked `?`.

### 3.1 Face check-in — `POST /face-recognition/mark-attendance` (student)
Full rules and check order: [face-verification.md §7](face-verification.md). Request:
```jsonc
{ "frames": ["<base64 jpeg>", "..."],     // burst, unmirrored; or legacy "image_data": "<base64>"
  "challenge_id?": "<hex>",               // from POST /face-recognition/challenge (purpose checkin)
  "presence_code?": "123456",             // shown in the classroom (§3.11)
  "subject_id?": 12, "session_id?": 345, "schedule_id?": 67 }
```
- With no ids, the server picks today's session of the student's cohort whose check-in window
  contains now (`find_checkin_session`). `session_id` takes precedence over `schedule_id`. A make-up
  session's id is also accepted in `schedule_id`.
- The server computes the status: `present` if now ≤ start + `late_after_minutes`, else `late`.
  The window is `[start - checkin_opens_minutes_before, min(end, start + checkin_closes_after_minutes))`.
  An existing record is never overwritten.
- **Business outcomes are always HTTP 200.** Response (`FaceCheckinResponse`):
```jsonc
// success
{ "success": true, "message": "Attendance marked successfully!" /* or "...as late." */,
  "attendance_marked": true, "status": "present"|"late", "current_status": "present"|"late",
  "student_id": 9, "confidence_score": 87.5, "session_id": 345, "subject_id": 12,
  "code": null, "window_state": null, "opens_at": null, "closes_at": null,
  "quality_issues": null, "retry_after_seconds": null }
// rejection (confidence_score is 0.0: scores are never revealed on failure)
{ "success": false, "attendance_marked": false, "code": "<code>", "message": "...",
  "confidence_score": 0.0, "student_id": 9?, "session_id": 345?,
  "current_status": "late"? /* already_recorded */, "window_state": "not_open"|"closed"?,
  "opens_at": "<iso>"?, "closes_at": "<iso>"?,
  "quality_issues": ["too_dark", "..."]? /* low_quality */, "retry_after_seconds": 240? /* too_many_attempts */ }
```
- Codes, in check order: `too_many_attempts`, `no_registered_face`, `subject_not_found`, `not_enrolled`,
  `between_terms`, `no_session_today`, `session_cancelled`, `window_closed`, `presence_code_required`,
  `presence_code_invalid`, `challenge_required`, `challenge_invalid`, `invalid_frames`, `no_face_detected`,
  `multiple_faces`, `low_quality`, `face_mismatch`, `liveness_failed`, `liveness_unavailable`,
  `spoof_suspected`, `already_recorded`.
- Failures that count towards the lock-out: `face_mismatch`, `liveness_failed`, `spoof_suspected`,
  `presence_code_invalid`, `challenge_invalid`. Every request writes one `face_verification_attempts` row.
- Unexpected exceptions give HTTP 500 `{detail: {code: "internal_error", message}}` (logged as an attempt).
  A missing student profile gives 404 (from the `get_current_student` guard).

### 3.2 Student today — `GET /schedules/student/today?envelope=true` (student)
Without `envelope` the response is a bare `TodayScheduleItem[]`. `term_state` and `day_status`
also come in the `X-Term-State` / `X-Day-Status` headers. The list is empty between terms and on
holidays. Today's sessions are materialized and committed.
```jsonc
{ "date": "2026-10-18", "term_state": "active", "day_status": "instructional",
  "day_status_detail": { "instructional": true, "reason": null, ... },
  "items": [{
    "id": 67,                 // schedule id (session id for make-ups without a schedule)
    "schedule_id": 67, "session_id": 345, "session_date": "2026-10-18",
    "session_status": "scheduled|held|cancelled", "session_kind": "regular|makeup",
    "subject_id": 12, "subject_name": "...", "subject_code": "...",
    "faculty_id": 1, "faculty_name": "...", "day_of_week": "sunday",
    "start_time": "09:00", "end_time": "10:30", "semester": 3, "academic_year": 2026,
    "classroom": "...", "instructor_name": "...", "teacher_id": 4, "is_active": true, "notes": null,
    "duration_minutes": 90, "time_slot_display": "09:00 - 10:30",
    "is_cancelled": false, "cancellation_reason": null,
    "my_status": "present|late|absent|excused|null",
    "checkin_window": { "opens_at": "<iso>", "late_after": "<iso>", "closes_at": "<iso>",
                        "state": "not_open|open|closed" },
    "checkin_allowed": true,  // window open && my_status null && not cancelled
    "term_state": "active", "day_status": "instructional"
  }] }
```
A student with no `faculty_id` gets `{..., "day_status": "no_cohort", "items": []}`.
`GET /schedules/today` returns the same items for any user, with `my_status: null` and `checkin_allowed: false`.

### 3.3 Teacher register
**`GET /teacher/subjects/{subject_id}/students-with-attendance?semester=&date=&session_id=&faculty_id=`**
`semester` is required. `date` defaults to today. Sessions are materialized only for dates up to today.
- 403 "You are not teaching this subject" when the teacher has no schedule row or session snapshot for the subject+semester(+faculty).
- If `session_id` is not one of the teacher's sessions that day → 404 with `detail.code`.
- Without `session_id`, the default is the session in progress, else the most recently started, else the next.
```jsonc
{ "students": [{ "id": 31 /* students.id */, "student_id": "BIT-2023-001", "name": "...", "email": "...",
                 "semester": 3, "faculty_id": 1,
                 "attendance_status": "present|late|absent|excused|null",
                 "source": "teacher|admin|student_face|system_auto|legacy|null",
                 "record_id": 901, "excluded_from_metrics": false,
                 "enrolled": true /* false = has a record but left the cohort */ }],
  "date": "2026-10-18", "semester": 3, "subject_id": 12, "faculty_id": 1,
  "total_students": 40, "present_count": 30, "absent_count": 2, "late_count": 3, "excused_count": 0,
  "unmarked_count": 5, "is_cancelled": false, "cancellation_reason": null,
  "session": { /* selected slot */ "id", "session_id", "schedule_id", "subject_id", "faculty_id", "semester",
               "session_date", "status", "kind", "start_time", "end_time", "teacher_id", "cancelled",
               "cancellation_reason", "attendance_taken_at", "submitted_at", "finalized_at",
               "review_required", "review_reason" } | null,
  "sessions": [ /* all of this teacher's slots that day, same shape */ ],
  "can_edit": true, "edit_block_reason": null | "no_session" | "session_cancelled" | "session_not_started" | "edit_window_closed",
  "term_state": "active" }
```
With no session that day the response shows the cohort roster with any legacy session-less records, read-only.

**`POST /teacher/attendance/bulk-mark`** (`BulkAttendanceMarkRequest`)
```jsonc
{ "subject_id": 12, "semester": 3, "faculty_id": 1, "date": "2026-10-18",
  "attendance_records": [{ "student_id": 31, "status": "present", "reason?": "..." }],  // send changed rows only
  "session_id?": 345, "start_time?": "09:00", "time_slot?": "09:00-10:30", "period?": 1,
  "reason?": "batch reason (fills entries that need one)",
  "confirm_held?": false, "mark_remaining_absent?": false }
```
Response:
```jsonc
{ "success": true, "message": "Bulk attendance marking completed", "total_processed": 5,
  "success_count": 5, "failed_count": 0, "errors": null,
  "session_id": 345, "session_status": "held", "submitted": true,
  "created": 3, "updated": 1, "unchanged": 1,
  "results": [{ "student_id": 31, "status": "present", "outcome": "created|updated|unchanged", "record_id": 901 }] }
```
- Session resolution: `session_id` must match the subject, cohort and date (400 `session_mismatch`).
  Otherwise `resolve_session_for`. If several slots exist and exactly one belongs to the teacher,
  that one is used. Otherwise 409 `ambiguous_session` with `detail.slots: [{session_id, schedule_id, kind, status, start_time, end_time}]`.
- Errors: 400 `invalid_entries` (nothing is written when any entry is invalid). 409
  `session_cancelled`, `session_not_started`, `confirm_held`. 403 `not_session_teacher`,
  `edit_window_closed` (older than `teacher_edit_window_days`).
- Per-entry codes: `invalid_student`, `duplicate_entry`, `invalid_status`, `not_enrolled`,
  `excused_admin_only`, `reason_required`.
- A reason is required only when: changing a `student_face` record's status; status `excused`;
  an admin overriding a `teacher` record; any edit after the teacher window (admins only).
  Writing the same status again changes nothing.
- `confirm_held`: a write or submission that would turn a `scheduled` session into `held` after
  `end + finalize_grace_minutes` fails with 409 `{code: "confirm_held", students_without_record}`
  unless `confirm_held: true`.

`POST /teacher/attendance/mark` (single): `{student_id, subject_id, date, status, session_id?, start_time?, time_slot?, reason?, notes?, confirm_held?}`
→ `{success, message, attendance_id, updated, outcome, status, session_id, session_status, results}`. It does not submit.

### 3.4 Admin and staff session endpoints (`routes/attendance.py`)
**Session payload** (`_serialize_sessions`, used by list, register, cancel, uncancel, clear-review, makeup):
```jsonc
{ "id", "session_id", "schedule_id", "kind", "status", "session_date", "start_time", "end_time",
  "subject_id", "subject_name", "subject_code", "faculty_id", "faculty_name", "semester", "term_id",
  "teacher_id", "teacher_name", "cancelled", "cancellation_reason", "cancelled_at", "cancelled_by_event_id",
  "attendance_taken_at", "submitted_at", "finalized_at", "review_required", "review_reason",
  "unrecorded": bool, "roster_size": 40, "recorded_count": 35,
  "status_counts": { "present", "late", "absent", "excused" } }
```
**`GET /attendance/sessions/unrecorded?from=&to=&faculty_id=&semester=&limit=200&offset=0`**.
The query keys are `from`/`to`. `limit` is 1-1000. Admin sees all sessions, a teacher only their own.
Only sessions on or after `tracking_start_date` with a non-empty roster are listed, plus review-flagged ones.
```jsonc
{ "sessions": [{ "id", "session_id", "session_date", "start_time", "end_time", "kind", "status",
                 "subject_id", "subject_name", "subject_code", "faculty_id", "faculty_name", "semester",
                 "teacher_id", "teacher_name", "has_teacher", "unrecorded", "review_required", "review_reason",
                 "age_days", "age_hours", "roster_size", "recorded_count" }],
  "schedules_without_teacher": 2,   // 0 for teachers
  "total": 57, "limit": 200, "offset": 0, "has_more": false }
```
**`GET /attendance/sessions/{id}/register`** → `{session: <session payload>, students: [...]}`. Each student:
`{student_id /* students.id */, student_number, name, email, semester, faculty_id, in_roster, status|null, source|null, record_id|null, excluded_from_metrics, exclusion_reason}`.

**`POST /attendance/sessions/{id}/register`**
```jsonc
// request
{ "entries": [{ "student_id": 31, "status": "absent", "reason?": "..." }],
  "reason?": "...", "mark_remaining_absent?": false, "confirm_held?": false }
// response = RecordResult.to_dict() + extras
{ "success": true, "session_id": 345, "created": 1, "updated": 0, "unchanged": 0,
  "statuses": { "31": "absent" }, "record_ids": { "31": 902 }, "session_status": "held",
  "submitted": true, "held_transition": true, "source": "admin|teacher",
  "results": [{ "student_id", "status", "outcome", "record_id" }], "session": { /* payload */ } }
```
Errors are the same as §3.3 (400 `invalid_entries`, 409 `session_cancelled`/`confirm_held`/`session_not_started`, 403 `not_session_teacher`/`edit_window_closed`).

**Cancel / uncancel / clear-review**: `POST /attendance/sessions/{id}/cancel|uncancel|clear-review` with `{reason}`
→ `{success: true, session}`. A missing reason → 422 `reason_required`. Other errors: 409 `already_cancelled` / `not_cancelled` / `not_flagged`, 403 for a non-owner.
clear-review is admin-only.

**Make-up**: `POST /attendance/sessions/makeup`
`{subject_id, faculty_id, semester, session_date, start_time, end_time, teacher_id?, reason}` → `{success: true, session}`.
Errors: 400 for a missing field. 422 `reason_required` / `invalid_time_range` / `between_terms`. 403 `not_subject_teacher` / `forbidden`.
409 `slot_taken` / `session_overlap` / `blocked_by_event`.

**Metrics exclusion**: `PATCH /attendance/records/{id}/metrics-exclusion` `{excluded: bool, reason}` (admin)
→ `{success, id, record_id, session_id, status, excluded_from_metrics, exclusion_reason}`. Excluding sets `exclusion_reason: "admin"`.
`excluded` missing → 400. Reason missing → 422 `reason_required`. The change is audited as `metrics_exclusion`.

**Audit**: `GET /attendance/records/{id}/audit` returns a list ordered by `changed_at`:
`[{id, action, old_status, new_status, old_source, new_source, changed_by, changed_by_name /* "System" when null */, changed_at, reason, session_id, context}]`.
Actions: `create, update, session_cancelled, session_uncancelled, session_submitted, finalize, legacy_backfill, metrics_exclusion`.

### 3.5 `POST /attendance/mark-bulk` (admin register submission)
```jsonc
{ "subject_id": 12, "date?": "2026-10-18" /* default today */,
  "students": [{ "student_id": 31, "status": "present", "reason?": "..." }],
  "session_id?": 345, "start_time?": "09:00", "faculty_id?": 1, "semester?": 3,
  "reason?": "...", "confirm_held?": false, "mark_remaining_absent?": false }
```
- Session resolution: `session_id` (400 `session_subject_mismatch` if it belongs to another
  subject). Otherwise `subject_id` + date + optional `start_time` + cohort. The cohort is explicit
  `faculty_id`+`semester`, or else the listed students' common cohort (400 `ambiguous_cohort` if
  they differ).
- Several slots match → 409 `ambiguous_session` (+`slots`). No session → 404 `session_not_found`.
- An empty `students` list is allowed only with an explicit session (`session_id` or
  faculty+semester) and `mark_remaining_absent: true`. Otherwise 400 "No students provided in request".
- Only the listed students are written, plus roster students without a record when `mark_remaining_absent` is set. The old cascade mode is gone.
```jsonc
{ "success": true, "message": "Bulk attendance marked successfully", "mode": "normal",
  "created_records": 3, "updated_records": 1, "unchanged_records": 0,
  "date": "2026-10-18", "subject_id": 12, "session_id": 345, "session_status": "held", "submitted": true,
  "results": [{ "student_id", "status", "outcome", "record_id" }] }
```

### 3.6 `POST /attendance` (admin single write, not a submission)
```jsonc
{ "student_id": 31, "status": "late", "subject_id": 12, "date?": "2026-10-18", "start_time?": "09:00",
  "session_id?": 345, "reason?": "...", "confirm_held?": false }
```
→ `{success, id, studentId, classId, subjectId, date, status, confidence_score: null, marked_by, session_id, session_status, outcome}`.
If the session is still `scheduled` after `end + grace`, the write needs `confirm_held: true`. Without it:
409 `{detail: {code: "confirm_held", message, details: {students_without_record, session_id}, students_without_record, session_id}}`.
The client should confirm with the user and resend with `confirm_held: true`.

### 3.7 Metrics block (Rule §8 / §13.12)
`services/attendance_metrics.py` is the only percentage implementation. The block comes from
`summarize_counts` and appears per subject, overall, and flattened on many legacy responses.
```jsonc
{ "percentage": 83.33 | null,      // null when considered == 0 (never 0 for "no data"); 2-dp display rounding
  "has_data": true,                  // considered > 0
  "attended": 25,                    // present (+ late when policy.late_counts_as_attended)
  "considered": 30,                  // countable: held session, present/late/absent, not excluded
  "present": 22, "late": 3, "absent": 5,
  "excused": 1,                      // never counted
  "cancelled_sessions": 2,
  "unrecorded": 1,                   // cohort sessions still scheduled after end+grace (on roster, >= tracking_start_date)
  "eligible": true | null,           // exact fraction >= minimum; null when no data. Overall = ALL subjects eligible
  "all_subjects_eligible": true|null,// overall blocks only (alias)
  "eligibility_provisional": true,   // unrecorded > 0
  "band": "good" | null, "band_label": "Good" | null,
  // legacy numeric fields: always numbers, 0.0 when no data
  "percentage_present": 83.33, "attendance_rate": 83.33, "attendance_percentage": 83.33,
  "total_classes": 31                // considered + excused
}
```
- Window: `[max(term.start, enrollment_start), min(term.end, as_of)]` over the reporting term
  (the current term, else the most recent ended active term). `term_id` overrides it.
- Responses add `term: {id, name, start_date, end_date} | null`, `term_state`, and often
  `window: {start, end}`.
- `StudentMetrics.to_dict()` also has `overall`, `per_subject[]` (`subject_id, subject_name,
  subject_code` + block), `counts`, `eligibility: {eligible, provisional, minimum_percentage,
  all_subjects_eligible}`, `band`, `streak: {current, longest}`, `policy`.
- Consumers: `/attendance/summary` (+ `scope: "student"|"aggregate"`), `/attendance/student-subject-breakdown/{id}`,
  `/student-attendance/*`, `/student-calendar/*`, `/analytics/*`, `/academic-metrics/current-semester`,
  `/teacher/subjects/{id}/analytics`, `/streaks-badges/*`, `/sidebar/stats`.

### 3.8 Terms — `/admin/semester-config` (admin)
Create body (`SemesterConfigRequest`). PUT takes the same fields, all optional, and the merged
result is re-validated:
```jsonc
{ "semester_name": "Fall 2026", "start_date": "2026-09-01", "end_date": "2027-01-15",
  "semester_number?": 1 /* 1-8, default next in year */, "academic_year?": 2026 /* default start year */,
  "total_weeks?": 20, "exam_week_start?": "2027-01-04", "exam_week_end?": "2027-01-10",
  "is_active?": true, "is_current?": "ignored (computed)" }
```
Item:
```jsonc
{ "id", "semester_number", "academic_year", "semester_name", "name", "start_date", "end_date", "total_weeks",
  "exam_week_start", "exam_week_end", "is_current", "is_active", "state": "current|upcoming|past|inactive",
  "created_by", "created_at", "updated_at" }
```
- Validation (end > start, exam window inside the term, academic year 2000-2100) → 400
  `{detail: "msg; msg"}`. Overlap with another active term → **409** `{detail: message}`. Both run
  under an advisory lock.
- `GET /validate/dates` → `{valid: true, message}`, 400 (string detail), or 409 `{detail: {message, conflicts: [{id, name, start_date, end_date}]}}`.
- `GET /current` → item + `term_state: "active"`, or 404 `{detail, term_state: "between_terms"|"no_terms"}`. (A direct `JSONResponse`, so `term_state` sits at the top level.)
- `DELETE /{id}` → 204 (deactivates). `POST /{id}/set-current` → 410.
- After any term change, call `api.attendancePolicy.invalidate()` in the frontend.

### 3.9 `GET /system-settings/attendance-policy` (any authenticated user)
```jsonc
{ "minimum_percentage": 75, "late_counts_as_attended": true,
  "checkin_opens_minutes_before": 10, "late_after_minutes": 10, "checkin_closes_after_minutes": 30,
  "finalize_grace_minutes": 30, "teacher_edit_window_days": 7,
  "weekly_off_days": ["saturday"],
  "bands": [{ "name": "excellent", "label": "Excellent", "min": 90, "max": null, "color": "..." }, ...],
          // highest band first; max is exclusive (= next higher band's min), null for the top band
  "term_state": "active|between_terms|no_terms",
  "current_term": { "id", "name", "start_date", "end_date", "exam_week_start", "exam_week_end" } | null,
  "reporting_term": { "id", "name", "start_date", "end_date" } | null,
  "auto_absent_lookback_days": 3, "exam_days_suspend_classes": true, "calendar_type": "...",
  "tracking_start_date": "2026-10-01" | null, "timezone": "Asia/Kathmandu", "today": "2026-10-18" }
```
The numbers above are only examples. Read the real values from this endpoint (or `services/attendance_policy.py`) and never hard-code 75/85/90.

### 3.10 Auto-absent
- `POST /auto-absent/trigger` (admin+) takes an optional body `{"date": "YYYY-MM-DD"}`. The date
  must not be in the future, must be at most 30 days back, and must fall inside an active term.
  Otherwise **400** `{detail: message}`. It runs the same code path as the scheduler. Only `held`
  sessions are finalized: roster students without a record get `absent` with source `system_auto`.
  Unrecorded sessions are never auto-absented. Re-running is idempotent.
```jsonc
{ "success": true /* false when skipped */, "message": "...", "records_created": 4,
  "expired_classes_processed": 2, "students_already_marked": 70, "timestamp": "<iso>",
  "processed_date": "2026-10-18", "target_date": null, "skipped": null | "<reason, e.g. lock held>",
  "job_run_id": 88, "sessions_materialized": 12, "sessions_finalized": 2, "sessions_skipped": 0,
  "unrecorded_sessions": 3, "triggered_by": 1 }
```
- `GET /auto-absent/status` (admin+) returns `{auto_absent_enabled, scheduler_enabled_in_process,
  scheduler_running, current_time, timezone, in_schedule_window, schedule_window,
  expired_classes_ready_to_process, next_scheduled_run, unrecorded_sessions, last_run: {id, status,
  started_at, finished_at, triggered_by, params, result, error} | null, term_state,
  finalize_grace_minutes, notes}`.
- `GET /auto-absent/runs?limit=20` (admin+) returns `[{id, job_name, status, started_at,
  finished_at, duration_seconds, triggered_by, triggered_by_name, trigger, params, result, error}]`,
  newest first.
- Legacy `POST /attendance/auto-absent?target_date=` returns `{success, message, processing_date,
  triggered_by (email), triggered_at, ...run result keys}`.

---

### 3.11 Presence code and attempts (`routes/attendance.py`, staff owner)
`GET /attendance/sessions/{id}/presence-code`:
```jsonc
{ "session_id": 345, "code": "482913", "digits": 6, "period_seconds": 30, "expires_in_seconds": 17,
  "server_time": "<iso>", "required": true,                      // policy.require_presence_code
  "checkin_path": "/student/attendance/mark?session=345&code=482913",  // QR = origin + path
  "window": { "opens_at": "<iso>", "closes_at": "<iso>", "late_after": "<iso>", "state": "not_open"|"open"|"closed" },
  "subject_name": "Data Structures", "start_time": "10:00", "end_time": "11:00" }
```
The code rotates every period; check-in accepts the current and the previous code.

`GET /attendance/sessions/{id}/face-attempts`:
```jsonc
{ "session_id": 345,
  "attempts": [{ "id": 1, "student_id": 9, "student_name": "…", "roll_number": "…", "outcome": "face_mismatch",
                 "counts_as_failure": true, "similarity": 0.21, "liveness_score": 0.93, "created_at": "<iso>" }],
  "summary": { "total": 12, "successes": 9, "failures": 2, "by_outcome": { "success": 9, "face_mismatch": 2, "low_quality": 1 } } }
```

### 3.12 Face enrolment — `POST /face-recognition/register-face-multi` (student)
Request `{images: string[], consent: true, challenge_id?: string}` (`register-face` also accepts legacy `image_data`).
Success (200):
```jsonc
{ "success": true, "message": "…",
  "details": { "images_processed": 3, "valid_images": 3, "poses": { "front": 1, "left": 1, "right": 1 },
               "template_count": 3, "model": "insightface/buffalo_l",
               "image_results": [{ "index": 0, "valid": true, "pose": "front"|"left"|"right"|null, "issues": [] }] } }
```
Errors use `{detail: {code, message, details}}`: 409 `already_enrolled`, 409 `enrolment_locked`,
400 `consent_required`, 400 `challenge_required` / `challenge_invalid`, 400 `invalid_frames`
(`{min_images, max_images, received}`), 422 `low_quality` (`{image_results, valid_images, required, quality_issues}`),
422 `pose_coverage` (`{missing_poses, image_results}`), 503 `liveness_unavailable`, 422 `spoof_suspected`,
409 `duplicate_face` (the other student is never revealed). Frame issue codes: `invalid_image`, `no_face`,
`multiple_faces`, `low_confidence`, `too_small`, `too_blurry`, `too_dark`, `too_bright`.

## 4. Changing endpoints

- **New route**: add it to the router module. Register a new module in `main.py` with
  `prefix="/api"`. Put static paths before catch-all `/{id}` paths (see `/attendance/{attendance_id}`
  and `/admins/me`).
- **Guards**: use `dependencies.py` helpers (`require_admin_role`, `require_teacher_or_admin`,
  `get_current_teacher`, `get_current_student`, `require_debug_admin`, `resolve_student_scope`).
  Do not compare `user.role` to strings.
- **Rules**: do not put attendance rules in routes. Use `attendance_recording.record_attendance`
  (all teacher/admin writes), `student_self_checkin`, `class_sessions.*` (materialize, resolve,
  cancel, make-up, unrecorded), `attendance_metrics.*` (every percentage), `term_service`,
  `attendance_policy`, `auto_absent_service`. Get "now"/"today" from `app.core.clock`
  (`app_now`, `app_today`), never from `datetime.now()`.
- **Errors**: raise or catch `DomainError`. Translate with `err.to_http_exception()`, the local
  `_domain_http`/`_http_error` (attendance and teacher routes, which give `invalid_entries` → 400),
  or `err.to_legacy_response()` where clients read `success`.
- **Frontend**: add the call to the matching `api.<namespace>` in `client.ts`. The error helpers
  there expose `status`, `code`, `errors` (`ApiErrorInfo`) from `detail`.
- **Regenerate this inventory** (stub InsightFace first, as `backend/tests/conftest.py` does):
  ```python
  from tests.support import testenv; testenv.configure_environment()
  from tests.support import fake_face; fake_face.install()
  from app.main import app; from fastapi.routing import APIRoute
  for r in app.routes:
      if isinstance(r, APIRoute):
          deps = [getattr(d.call, "__name__", "") for d in r.dependant.dependencies]
          print(sorted(r.methods), r.path, r.endpoint.__module__, r.endpoint.__name__, deps)
  ```
  Run it from `backend/` with `venv/Scripts/python.exe`.
