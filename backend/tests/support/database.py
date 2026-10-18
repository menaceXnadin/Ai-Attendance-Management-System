"""Test-database lifecycle: guarded create/drop, schema load, alembic, truncate.

Every function re-validates the database name with ``assert_safe_db_name`` right before
acting, and ``install_connection_guard()`` makes *every* SQLAlchemy pool in the process
(app engines, alembic's engine, the harness engines) refuse a connection whose
``current_database()`` is not a test database.
"""
from __future__ import annotations

import time
from pathlib import Path

import psycopg2
from psycopg2 import sql as pgsql
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.pool import Pool

from .testenv import (
    BACKEND_DIR,
    BASELINE_REVISION,
    BASELINE_SQL,
    PG_TIMEZONE,
    SEED_SQL,
    TEST_DB_NAME_RE,
    UnsafeDatabaseError,
    assert_safe_db_name,
    clean_dump_sql,
    server_url,
)

#: Tables whose rows come from seed_reference.sql (kept by ``truncate_all``).
REFERENCE_TABLES = ("system_settings", "attendance_thresholds")


def _connect(dbname: str):
    srv = server_url()
    return psycopg2.connect(
        host=srv.host or "localhost",
        port=srv.port or 5432,
        user=srv.username,
        password=srv.password,
        dbname=dbname,
        application_name="attendai-pytest",
        connect_timeout=10,
    )


def _connect_test_db(name: str):
    conn = _connect(assert_safe_db_name(name))
    with conn.cursor() as cur:
        cur.execute("SELECT current_database()")
        actual = cur.fetchone()[0]
    if actual != name:
        conn.close()
        raise UnsafeDatabaseError(f"connected to {actual!r}, expected {name!r}")
    return conn


def recreate_database(name: str) -> None:
    """DROP … WITH (FORCE) + CREATE … TEMPLATE template0 via the ``postgres`` maintenance DB."""
    assert_safe_db_name(name)
    conn = _connect("postgres")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            ident = pgsql.Identifier(assert_safe_db_name(name))
            cur.execute(pgsql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(ident))
            cur.execute(pgsql.SQL("CREATE DATABASE {} TEMPLATE template0 ENCODING 'UTF8'").format(ident))
            cur.execute(pgsql.SQL("ALTER DATABASE {} SET timezone TO {}").format(ident, pgsql.Literal(PG_TIMEZONE)))
    finally:
        conn.close()


def drop_database(name: str) -> None:
    assert_safe_db_name(name)
    conn = _connect("postgres")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                pgsql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(pgsql.Identifier(assert_safe_db_name(name)))
            )
    finally:
        conn.close()


def execute_sql_file(name: str, path: Path) -> None:
    """Run a SQL script (pg_dump output allowed) in one transaction on the test DB."""
    script = clean_dump_sql(path.read_text(encoding="utf-8"))
    conn = _connect_test_db(name)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(script)
    finally:
        conn.close()


def run_alembic(name: str, sync_url: str, *, stamp: str = BASELINE_REVISION, upgrade: str = "head") -> str:
    """``alembic stamp <baseline>`` then ``alembic upgrade head`` against the test DB.

    alembic/env.py takes its URL from ``app.core.config.settings.database_url_sync``; we verify
    that it points at the guarded test DB before running anything. Returns the resulting head.
    """
    from alembic import command
    from alembic.config import Config

    from app.core.config import settings

    configured = make_url(settings.database_url_sync).database
    if configured != assert_safe_db_name(name):
        raise UnsafeDatabaseError(
            f"settings.database_url_sync points at {configured!r}, expected test DB {name!r}; refusing to run alembic"
        )

    cfg = Config()  # no ini file -> env.py skips fileConfig(), the ini's live URL is never read
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))
    command.stamp(cfg, stamp)
    command.upgrade(cfg, upgrade)

    conn = _connect_test_db(name)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT string_agg(version_num, ',') FROM alembic_version")
            return cur.fetchone()[0]
    finally:
        conn.close()


def build_test_database(name: str, sync_url: str, *, run_migrations: bool = True) -> dict:
    """Full (re)build: create DB, load baseline + seed, alembic stamp/upgrade. Returns timings."""
    timings = {}
    t0 = time.perf_counter()
    recreate_database(name)
    timings["create"] = time.perf_counter() - t0
    t1 = time.perf_counter()
    execute_sql_file(name, BASELINE_SQL)
    execute_sql_file(name, SEED_SQL)
    timings["load_schema"] = time.perf_counter() - t1
    if run_migrations:
        t2 = time.perf_counter()
        timings["alembic_head"] = run_alembic(name, sync_url)
        timings["alembic"] = time.perf_counter() - t2
    timings["total"] = time.perf_counter() - t0
    return timings


def truncate_all(name: str) -> None:
    """Empty every table (RESTART IDENTITY CASCADE) and re-seed reference rows.

    Used after tests marked ``@pytest.mark.committing`` (e.g. routes using the sync
    ``get_sync_db`` session, which cannot join the per-test transaction).
    """
    conn = _connect_test_db(name)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
                )
                tables = [r[0] for r in cur.fetchall()]
                if tables:
                    cur.execute(
                        pgsql.SQL("TRUNCATE {} RESTART IDENTITY CASCADE").format(
                            pgsql.SQL(", ").join(pgsql.Identifier("public", t) for t in tables)
                        )
                    )
    finally:
        conn.close()
    execute_sql_file(name, SEED_SQL)


_GUARD_INSTALLED = False


def install_connection_guard() -> None:
    """Reject any SQLAlchemy connection (any engine, sync or async) to a non-test database."""
    global _GUARD_INSTALLED
    if _GUARD_INSTALLED:
        return

    @event.listens_for(Pool, "connect")
    def _refuse_non_test_databases(dbapi_connection, connection_record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("SELECT current_database()")
            current = cursor.fetchone()[0]
        finally:
            cursor.close()
        if not TEST_DB_NAME_RE.fullmatch(current or ""):
            raise UnsafeDatabaseError(
                f"pytest harness blocked a connection to database {current!r} (only {TEST_DB_NAME_RE.pattern} allowed)"
            )

    _GUARD_INSTALLED = True
