"""AttendAI pytest harness.

Order matters: the environment and the InsightFace stub are installed at import time of
this conftest, *before* anything imports ``app``.

Fixtures (see the README section of the harness report / docstrings below):
    app, test_db, db_engine, db_connection, db, factory, client, auth_headers, token_for,
    default_password, fake_face, face_policy, frozen_now, sync_session_factory
Markers: integration, migration, slow, committing (see pytest.ini).
"""
from __future__ import annotations

import shutil
import time

# --- 1. environment + stubs BEFORE any `app` import ---------------------------------
from tests.support import testenv

_CFG = testenv.configure_environment()

from tests.support import fake_face as _fake_face  # noqa: E402

_FAKE_FACE_SERVICE = _fake_face.install()

from tests.support import database as _database  # noqa: E402

_database.install_connection_guard()

# --- 2. regular imports ------------------------------------------------------------------
import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from tests.support.auth import auth_headers as _auth_headers  # noqa: E402
from tests.support.auth import token_for as _token_for  # noqa: E402
from tests.support.clock import FrozenClock, clock_module, reset_clock  # noqa: E402
from tests.support.factories import DEFAULT_PASSWORD, Factory  # noqa: E402


def pytest_addoption(parser):
    group = parser.getgroup("attendai")
    group.addoption(
        "--keep-test-db",
        action="store_true",
        default=False,
        help="Do not drop the test database (attendancedb_test) at the end of the session.",
    )


def _verify_settings_point_at_test_db():
    """Abort the whole session if the app settings could reach a non-test database."""
    from app.core.config import settings

    for attr in ("database_url", "database_url_sync"):
        name = make_url(getattr(settings, attr)).database
        try:
            testenv.assert_safe_db_name(name)
        except testenv.UnsafeDatabaseError as exc:
            pytest.exit(f"ABORT: settings.{attr} -> {name!r}: {exc}", returncode=3)
        if name != _CFG.name:
            pytest.exit(f"ABORT: settings.{attr} -> {name!r}, expected {_CFG.name!r}", returncode=3)
    if settings.smtp_user or settings.smtp_password or settings.smtp_host:
        pytest.exit("ABORT: SMTP settings leaked into the test process", returncode=3)


# ------------------------------------------------------------------------------- app
@pytest.fixture(scope="session")
def app():
    """The FastAPI application (imported lazily, after env + stubs). No lifespan is run."""
    t0 = time.perf_counter()
    from app.main import app as fastapi_app

    _verify_settings_point_at_test_db()
    fastapi_app.state.attendai_import_seconds = time.perf_counter() - t0
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------- database
@pytest.fixture(scope="session")
def test_db(request, app):
    """(Re)create the guarded test DB: baseline.sql + seed + alembic stamp/upgrade head.

    Returns the HarnessDBConfig (``.name``, ``.sync_url``, ``.async_url``) with build timings
    attached as ``test_db.timings``.
    """
    timings = _database.build_test_database(_CFG.name, _CFG.sync_url_str)
    request.config.stash[_TIMINGS_KEY] = timings
    yield _CFG
    # dispose the app's own engines so DROP doesn't wait on them (FORCE would kill them anyway)
    try:
        from app.core import database as app_database

        app_database.sync_engine.dispose()
    except Exception:
        pass
    if not request.config.getoption("--keep-test-db"):
        _database.drop_database(_CFG.name)
    shutil.rmtree(_CFG.upload_dir, ignore_errors=True)


_TIMINGS_KEY = pytest.StashKey[dict]()


@pytest.fixture(scope="session")
async def db_engine(test_db, app):
    """NullPool async engine on the test DB (connections never outlive a test)."""
    engine = create_async_engine(test_db.async_url_str, poolclass=NullPool)
    yield engine
    await engine.dispose()
    try:
        from app.core import database as app_database

        await app_database.async_engine.dispose()
    except Exception:
        pass


@pytest.fixture
async def db_connection(db_engine):
    """One connection per test with an outer transaction that is always rolled back."""
    async with db_engine.connect() as conn:
        outer = await conn.begin()
        try:
            yield conn
        finally:
            if outer.is_active:
                await outer.rollback()


@pytest.fixture
async def db(db_connection):
    """AsyncSession joined to the outer transaction; ``commit()`` only releases a SAVEPOINT.

    Note: PostgreSQL ``now()`` is frozen for the whole test (single transaction).
    """
    session = AsyncSession(bind=db_connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture(scope="session")
def default_password() -> str:
    return DEFAULT_PASSWORD


@pytest.fixture(scope="session")
def _default_password_hash(app) -> str:
    from app.core.security import get_password_hash

    return get_password_hash(DEFAULT_PASSWORD)  # bcrypt once per session, reused by every factory user


@pytest.fixture
def factory(db, _default_password_hash) -> Factory:
    """``Factory`` bound to the per-test session (rows vanish on rollback)."""
    return Factory(db, _default_password_hash)


@pytest.fixture(scope="session")
def sync_session_factory(test_db):
    """sessionmaker for the *sync* engine on the test DB (used to override ``get_sync_db``).

    Sync sessions cannot join the per-test async transaction: their writes are committed.
    Mark such tests ``@pytest.mark.committing`` so the DB is truncated + re-seeded afterwards.
    """
    engine = create_engine(test_db.sync_url_str, poolclass=NullPool)
    yield sessionmaker(bind=engine, autocommit=False, autoflush=False)
    engine.dispose()


@pytest.fixture(autouse=True)
def _committing_cleanup(request):
    yield
    if request.node.get_closest_marker("committing") is not None:
        _database.truncate_all(_CFG.name)


# ------------------------------------------------------------------------------ client
@pytest.fixture
async def client(app, db, sync_session_factory):
    """httpx.AsyncClient over ASGITransport (no lifespan => scheduler never starts).

    ``get_db`` is overridden to yield the per-test session; ``get_sync_db`` (and its alias
    ``app.database.get_db``) to a sync session on the test DB.
    """
    import httpx

    from app.core.database import get_db, get_sync_db
    from app.services.scheduler_service import scheduler_service

    async def _override_get_db():
        yield db

    def _override_get_sync_db():
        session = sync_session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_sync_db] = _override_get_sync_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            assert not scheduler_service.running, "background scheduler must not run under tests"
            yield http
        assert not scheduler_service.running, "a request started the background scheduler"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def auth_headers(app):
    """``auth_headers(user_or_profile, **extra_claims) -> {"Authorization": "Bearer …"}``."""
    return _auth_headers


@pytest.fixture
def token_for(app):
    """``token_for(user_or_profile, expires_delta=None, **claims) -> str`` (raw JWT)."""
    return _token_for


# ------------------------------------------------------------------------ fakes/clock
@pytest.fixture
def fake_face():
    """The stubbed InsightFace singleton; reset after each test."""
    _FAKE_FACE_SERVICE.reset()
    yield _FAKE_FACE_SERVICE
    _FAKE_FACE_SERVICE.reset()


@pytest.fixture
def face_policy(db):
    """``await face_policy(**values)`` stores the ``face_verification`` setting (missing keys
    use the defaults of ``app.services.face_policy.FacePolicy``) and commits the savepoint so
    route rollbacks keep it. ``await face_policy()`` restores the defaults explicitly;
    ``await face_policy(**fake_face.RELAXED_FACE_POLICY)`` turns every anti-fraud layer off."""
    import json

    from sqlalchemy import text

    async def _set(**values):
        await db.execute(text("DELETE FROM system_settings WHERE key = 'face_verification'"))
        await db.execute(text(
            "INSERT INTO system_settings (key, value, category, description, data_type, is_active) "
            "VALUES ('face_verification', CAST(:v AS jsonb), 'security', 'test face policy', 'json', true)"),
            {"v": json.dumps(values)})
        await db.commit()
        return values

    return _set


@pytest.fixture
def frozen_now(app):
    """``clock = frozen_now(datetime(2025, 3, 3, 9, 30))`` -> FrozenClock (naive = Asia/Kathmandu).

    ``clock.advance(minutes=15)``, ``clock.set(dt)``. Skips if app.core.clock is not available yet.
    """
    module = clock_module()
    if module is None:
        pytest.skip("app.core.clock.set_now_provider is not available yet")

    def _freeze(dt):
        return FrozenClock(module, dt)

    yield _freeze
    reset_clock()


@pytest.fixture(autouse=True)
def _reset_global_state():
    """Reset process-global state between tests (clock provider, semester override cache)."""
    yield
    import sys

    if "app.core.clock" in sys.modules:
        reset_clock()
    sem = sys.modules.get("app.services.automatic_semester")
    service = getattr(sem, "AutomaticSemesterService", None) if sem else None
    if service is not None:
        for name in ("reset_to_defaults", "clear_override_cache"):
            fn = getattr(service, name, None)
            if callable(fn):
                fn()


# ------------------------------------------------------------------------------ report
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    timings = config.stash.get(_TIMINGS_KEY, None)
    if timings:
        terminalreporter.write_line(
            "attendai test DB {name}: create {c:.2f}s, schema+seed {s:.2f}s, alembic {a:.2f}s (head={h}), total {t:.2f}s".format(
                name=_CFG.name,
                c=timings.get("create", 0),
                s=timings.get("load_schema", 0),
                a=timings.get("alembic", 0),
                h=timings.get("alembic_head"),
                t=timings.get("total", 0),
            )
        )
