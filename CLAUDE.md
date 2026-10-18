# CLAUDE.md

@AGENTS.md

## Claude Code notes
- **Read the docs first.** Read `docs/system/README.md` and the specific doc for the area you're touching instead of re-reading the whole codebase. `docs/system/domain-rules.md` is the spec for attendance logic.
- **Windows shells:** the host is Windows. The Bash tool is Git Bash and PowerShell is also available. Python is `backend/venv/Scripts/python.exe`; the PostgreSQL 17 tools are in `C:/Program Files/PostgreSQL/17/bin/`. Long heredocs containing quotes or backticks have failed in the Bash tool; write the script to a temp file and run it instead. Git Bash rewrites arguments that start with `/` (e.g. a route like `/app`) into Windows paths; prefix the command with `MSYS_NO_PATHCONV=1` when passing URL paths to scripts.
- **Subagents running tests in parallel:** give every subagent its own test database (`ATTENDAI_TEST_DB_NAME=attendancedb_test_gw<N>` with a unique number; other suffixes are rejected). Otherwise concurrent runs drop each other's database and fail at random.
- **File ownership:** when you split work across subagents, give each a clear set of files, especially `frontend/src/integrations/api/client.ts` and the shared services.
- **Local database:** the local DB (`attendancedb`, credentials in `backend/.env`) holds dummy data. Migrating it or resetting it is fine; no backup is needed.
- **Verify before finishing:** run the backend suite plus the frontend type check, lint and build. For UI changes, check both light and dark mode (theme key `attendai-theme` in localStorage).
- **Update the docs before finishing:** every behaviour, schema, endpoint, UI or workflow change updates the matching doc in the same change (see the table in "Keeping docs current" in AGENTS.md). When you delegate to subagents, either give one of them ownership of the docs or update them yourself from their reports. Your final message names the docs you changed.
