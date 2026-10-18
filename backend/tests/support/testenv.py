"""Environment bootstrap for the AttendAI pytest harness.

``configure_environment()`` MUST run before anything imports ``app``:
``app.core.config`` instantiates ``Settings()`` at import time and pydantic-settings
falls back to ``backend/.env`` (live DB URL, SMTP credentials, ...) for every key
that is not present in ``os.environ``. We therefore set *every* setting explicitly.

The PostgreSQL *server* credentials (host/port/user/password) are taken from
``ATTENDAI_TEST_PG_URL`` if set, otherwise parsed from ``DATABASE_URL_SYNC`` /
``DATABASE_URL`` in ``backend/.env``. Only the server part is reused; the database
name is always replaced by a guarded test database name.
"""
from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.engine import URL, make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]
TESTS_DIR = BACKEND_DIR / "tests"
SCHEMA_DIR = TESTS_DIR / "schema"
BASELINE_SQL = SCHEMA_DIR / "baseline.sql"
SEED_SQL = SCHEMA_DIR / "seed_reference.sql"
DOTENV_PATH = BACKEND_DIR / ".env"

#: Only databases whose name matches this may ever be created, dropped or written by the harness.
TEST_DB_NAME_RE = re.compile(r"^attendancedb_(test|migtest)(_gw\d+)?$")
LIVE_DB_NAME = "attendancedb"
DEFAULT_TEST_DB_NAME = "attendancedb_test"

#: Alembic revision that ``baseline.sql`` corresponds to (live DB head when the dump was taken).
BASELINE_REVISION = "n20251103_payload_receipts"

APP_TIMEZONE = "Asia/Kathmandu"
#: Spelling used by the live server's ``TimeZone`` setting; both names are valid in PostgreSQL.
PG_TIMEZONE = "Asia/Katmandu"

#: Not a real secret: only signs JWTs inside the test process.
TEST_SECRET_KEY = "attendai-pytest-only-signing-key-0f1e2d3c4b5a69788796a5b4c3d2e1f0"


class UnsafeDatabaseError(RuntimeError):
    """Raised whenever the harness is about to touch a database that is not a test database."""


def assert_safe_db_name(name: str | None) -> str:
    if not name or name == LIVE_DB_NAME or not TEST_DB_NAME_RE.fullmatch(name):
        raise UnsafeDatabaseError(
            f"Refusing to use database {name!r}: test database names must match "
            f"{TEST_DB_NAME_RE.pattern} (the live database {LIVE_DB_NAME!r} is never touched)."
        )
    return name


def _read_dotenv_value(key: str) -> str | None:
    """Read a single key from backend/.env without loading the rest into the environment."""
    if not DOTENV_PATH.exists():
        return None
    for raw_line in DOTENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip().upper() == key.upper():
            return v.strip().strip('"').strip("'")
    return None


def dotenv_keys() -> set[str]:
    """Upper-cased keys present in backend/.env (values are never returned)."""
    if not DOTENV_PATH.exists():
        return set()
    keys = set()
    for raw_line in DOTENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#") and "=" in line:
            keys.add(line.split("=", 1)[0].strip().upper())
    return keys


def server_url() -> URL:
    """URL of the PostgreSQL server (sync driver, no database)."""
    raw = os.environ.get("ATTENDAI_TEST_PG_URL")
    if not raw:
        raw = _read_dotenv_value("DATABASE_URL_SYNC") or _read_dotenv_value("DATABASE_URL")
    if not raw:
        raise RuntimeError(
            "No PostgreSQL server configured for tests: set ATTENDAI_TEST_PG_URL="
            "postgresql://user:password@host:5432 or provide DATABASE_URL_SYNC in backend/.env"
        )
    url = make_url(raw)
    return url.set(drivername="postgresql", database=None)


def resolve_test_db_name() -> str:
    name = os.environ.get("ATTENDAI_TEST_DB_NAME", DEFAULT_TEST_DB_NAME)
    worker = os.environ.get("PYTEST_XDIST_WORKER")  # pytest-xdist: gw0, gw1, ...
    if worker and not name.endswith(f"_{worker}"):
        name = f"{name}_{worker}"
    return assert_safe_db_name(name)


@dataclass(frozen=True)
class HarnessDBConfig:
    name: str
    sync_url: URL
    async_url: URL
    upload_dir: str

    @property
    def sync_url_str(self) -> str:
        return self.sync_url.render_as_string(hide_password=False)

    @property
    def async_url_str(self) -> str:
        return self.async_url.render_as_string(hide_password=False)


#: Every environment variable the harness sets. Smoke tests assert that this covers
#: every ``Settings`` field and every key of backend/.env.
EXPLICIT_ENV: dict[str, str] = {}

_CONFIG: HarnessDBConfig | None = None


def configure_environment() -> HarnessDBConfig:
    """Set all Settings env vars to safe test values. Idempotent."""
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG

    name = resolve_test_db_name()
    server = server_url()
    sync_url = server.set(drivername="postgresql", database=name)
    async_url = server.set(drivername="postgresql+asyncpg", database=name)
    upload_dir = tempfile.mkdtemp(prefix="attendai-test-uploads-")

    env = {
        # Database
        "DATABASE_URL": async_url.render_as_string(hide_password=False),
        "DATABASE_URL_SYNC": sync_url.render_as_string(hide_password=False),
        # Security
        "SECRET_KEY": TEST_SECRET_KEY,
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
        # CORS
        "ALLOWED_ORIGINS": '["http://test"]',
        # Face recognition (the service itself is stubbed, see support/fake_face.py)
        "FACE_RECOGNITION_TOLERANCE": "0.6",
        "INSIGHTFACE_DET_SIZE": "640",
        "FACE_MAX_CONCURRENCY": "2",
        "ANTISPOOF_MODEL_DIR": "",
        "DEVELOPMENT_MODE": "true",
        # Files
        "UPLOAD_DIR": upload_dir,
        "MAX_FILE_SIZE": "10485760",
        # Email: never the real SMTP account
        "SMTP_HOST": "",
        "SMTP_PORT": "587",
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "FRONTEND_BASE_URL": "http://frontend.test",
        "FRONTEND_PORT": "8080",
        # Application
        "PROJECT_NAME": "AttendAI (tests)",
        "VERSION": "test",
        "DEBUG": "false",  # also disables SQL echo
        # Scheduler / clock (current + planned settings, see DOMAIN_RULES §1, §7)
        "ENABLE_AUTO_ABSENT_SCHEDULER": "false",
        "RUN_SCHEDULER": "false",
        "APP_TIMEZONE": APP_TIMEZONE,
    }
    os.environ.update(env)
    EXPLICIT_ENV.clear()
    EXPLICIT_ENV.update(env)

    _CONFIG = HarnessDBConfig(name=name, sync_url=sync_url, async_url=async_url, upload_dir=upload_dir)
    return _CONFIG


def get_config() -> HarnessDBConfig:
    if _CONFIG is None:
        raise RuntimeError("configure_environment() has not run yet")
    return _CONFIG


def clean_dump_sql(sql: str) -> str:
    """Make a ``pg_dump --schema-only`` script loadable through a plain DB-API cursor.

    * drops psql meta-commands (``\\restrict``/``\\unrestrict`` emitted by pg_dump >= 17.6, ``\\connect``...)
    * drops ``SET transaction_timeout`` (PostgreSQL 17+ only) so older servers can load it too
    """
    out = []
    for line in sql.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("\\"):
            continue
        if stripped.startswith("SET transaction_timeout"):
            continue
        out.append(line)
    return "\n".join(out) + "\n"
