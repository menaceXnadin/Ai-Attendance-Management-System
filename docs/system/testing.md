# Testing

## Backend (pytest)
Run the suite from `backend/`:

```
cd backend
venv/Scripts/python.exe -m pytest -q        # ~70 s, 695 tests at last count
```

- **Config:** `backend/pytest.ini` sets `testpaths=tests`, `asyncio_mode=auto` and session-scoped event loops. A repo-root `conftest.py` stops pytest from collecting the legacy scripts in `tests/backend/**`, some of which call `localhost:8000` when imported.
- **Test database:** every session builds a throwaway `attendancedb_test` on the local PostgreSQL server:
  1. drop and create it;
  2. load `backend/tests/schema/baseline.sql` (a schema-only dump of the pre-redesign database) and `seed_reference.sql`;
  3. `alembic stamp n20251103_payload_receipts`;
  4. `alembic upgrade head`, so every run also exercises the latest migration.

  The database is dropped afterwards unless you pass `--keep-test-db`. A name guard allows only names like `attendancedb_test*` and `attendancedb_migtest*`, and a connection guard refuses any other database.
- **Parallel runs:** when several agents or terminals run tests at once, give each its own database, e.g. `ATTENDAI_TEST_DB_NAME=attendancedb_test_gw42 venv/Scripts/python.exe -m pytest -q`. Otherwise one run drops the database under another. `ATTENDAI_TEST_PG_URL` overrides the server.
- **Isolation:** each test runs in an outer transaction and the routes' commits release savepoints (`join_transaction_mode="create_savepoint"`); everything is rolled back afterwards. An error response rolls back the shared session and expires ORM objects, so capture ids before making a call that may fail. Tests that hit sync `get_sync_db` routes need `@pytest.mark.committing`; the database is then truncated and re-seeded.
- **App import:** InsightFace is stubbed in `sys.modules` before the app is imported, every Settings env var is set explicitly (nothing falls back to `backend/.env`), and the scheduler never starts. httpx's `ASGITransport` doesn't run the app's lifespan.

### Fixtures (`backend/tests/conftest.py`, `tests/support/*`)
- `db`: an `AsyncSession` inside the per-test transaction.
- `client`: an httpx `AsyncClient` against the app, with `get_db` overridden.
- `factory`: raw-SQL factories for `faculty`, `subject`, `user`, `admin`, `teacher`, `student`, `class_schedule`, `term`, `academic_event`/`holiday`/`exam`/`cancelled_class`, `attendance_record`, and `cohort` (faculty + subject + teacher + students + weekly schedule + term). All accept `**extra` columns.
- `auth_headers(entity)` and `token_for(entity, **claims)`: real JWTs.
- `frozen_now(dt)`: freezes `app.core.clock`; always use it for time-dependent tests.
- `fake_face`: the stubbed face engine (`tests/support/fake_face.py`). It implements the engine API of [face-verification.md §3](face-verification.md): `set_face(...)`, `set_frames([...])` with `frontal(emb)`, `turned(emb, 'left'|'right')`, `face_spec(...)`; ready-made `checkin_burst(emb, direction)` and `enrolment_burst(emb)`; `blend(a, b, w)` for borderline similarities; `liveness_available = False` to simulate missing anti-spoof models. `RELAXED_FACE_POLICY` turns off head turn, liveness and presence code.
- `face_policy(**values)`: writes (merges) the `face_verification` setting and commits; use it to switch face checks on or off per test.
- `tests/domain/conftest.py`: a shared cohort fixture for domain tests. It pins `tracking_start_date` to 2025-12-01, because the migration writes the real migration date.

### Layout
| File | Covers |
|---|---|
| `tests/domain/test_pure_rules.py` | Check-in window boundaries, reason/`confirm_held` matrix, exact-fraction eligibility, bands, streaks, day classification |
| `tests/domain/test_terms.py`, `test_instructional_calendar.py` | Term resolution and validation, weekly off-day, holidays, exams, the academic-year label |
| `tests/domain/test_class_sessions.py` | Materialization idempotency, tracking start, make-ups, event reconcile/restore |
| `tests/domain/test_recording.py` | Writer permissions, overrides, audit, all-or-nothing batches, cancelled sessions |
| `tests/domain/test_finalizer.py` | Held-only absences, idempotency, enrollment, lock contention, job_runs |
| `tests/domain/test_metrics.py`, `test_edge_cases.py`, `test_clock.py` | Metrics definitions and the regressions found in review |
| `tests/test_routes_*.py` | HTTP integration per route group (attendance, teacher, student/face, terms/calendar) |
| `tests/test_face_checkin.py`, `test_face_presence.py` | Face check-in: every §7 code path, lock-out, attempts log, challenges, presence-code and attempts endpoints |
| `tests/test_face_enrollment.py` | Enrolment, deletion, admin reset, duplicate and spoof blocking, student payload privacy |
| `tests/domain/test_face_math.py`, `test_presence_code.py`, `test_face_policy.py` | Pure face helpers, rotating codes, policy parsing and validation |
| `tests/test_metrics_consumers.py` | Every percentage endpoint reports the same numbers |
| `tests/test_route_guards.py` | Fails if any write endpoint lacks auth (allowlist: login, forgot/reset password) |
| `tests/test_harness_smoke.py` | Harness safety: DB guard, no `.env` leaks, scheduler off, rollback |

Rules for tests:
- Encode the rules in [domain-rules.md](domain-rules.md). Never change an expected outcome just to make the code pass.
- If the code contradicts a rule, mark the test `xfail(strict=True, reason="SPEC VIOLATION: …")` and fix the code.

If the schema baseline must change (rare), regenerate it with `backend/tests/schema/regenerate_baseline.py`. It reads from the live DB, read-only.

## Frontend
There are no frontend unit tests. Checks:

```
cd frontend
npx tsc -p tsconfig.app.json --noEmit   # must report 0 errors
npm run lint                            # 0 errors expected (warnings are fast-refresh/hook-deps)
npm run build
```

### Visual QA in a browser
Run both dev servers (backend :8000, frontend :8080) and check pages in a real browser: the chrome-devtools MCP tools, or headless Chrome driven over CDP. Check light and dark mode (localStorage `attendai-theme` = `light` / `dark`, then reload) and phone, tablet and desktop widths (390, 1024, 1440).

Local logins on the dummy `attendancedb` (passwords are not stored in this public repo; ask the project owner):

| Role | Email |
|---|---|
| Admin | `admin@attendance.com` |
| Teacher | `teacher.test@university.edu` (teaches Programming Fundamentals 1 and Operating Systems 1, Computer Science semester 1) |
| Student | `aarati.shrestha@students.example.edu` (and the other `*@students.example.edu` QA students) |

These exist only in the local dummy database. When you capture screenshots for the landing page (`src/assets/landing/screens/`), rewrite any real-looking personal emails or phone numbers in the page before capturing.

## Legacy scripts
`tests/backend/**` (repo root) holds old ad-hoc scripts: analysis, data population and migrations that run against a live DB. They are not a test suite, are git-ignored, and describe pre-redesign behaviour.
