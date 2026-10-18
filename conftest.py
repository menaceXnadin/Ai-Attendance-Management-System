"""Repo-root pytest guard.

The legacy scripts under tests/backend/** are not a test suite: several call
http://localhost:8000 (the running app / live DB) at import time. Never collect them.
The real suite lives in backend/tests (run: cd backend && venv/Scripts/python.exe -m pytest).
"""
collect_ignore = ["tests/backend"]
collect_ignore_glob = ["tests/backend/*"]
