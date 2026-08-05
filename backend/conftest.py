import os
import pytest

# Ensure tests default to SQLite unless an explicit DATABASE_URL is set (e.g. in CI with PostgreSQL)
if "DATABASE_URL" not in os.environ:
    os.environ["USE_SQLITE"] = "true"


@pytest.fixture(autouse=True)
def reset_provider_health():
    from app.services.ai_provider import ai_provider
    ai_provider.reset_health_states()


@pytest.fixture(scope="session", autouse=True)
async def reinitialize_engine_in_test_loop():
    """
    The AsyncEngine in app.core.db is created at module-import time, which
    happens BEFORE pytest-asyncio spins up its session event loop. On Linux
    (GitHub Actions) with asyncpg, the connection pool silently binds to the
    import-time loop. When tests later run inside pytest-asyncio's loop, every
    awaited database operation raises:

        RuntimeError: Task got Future attached to a different loop

    Fix: dispose the stale engine and recreate it (and the session factory)
    inside the running pytest event loop so all connections are attached to the
    correct loop. This only touches module-level variables in app.core.db —
    no production business logic is modified.
    """
    import app.core.db as db_module
    from app.core.config import settings
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import event as sa_event

    # 1. Dispose the stale import-time engine (its pool is on the wrong loop)
    try:
        await db_module.engine.dispose()
    except Exception:
        pass

    # 2. Rebuild engine kwargs exactly as db.py does
    connect_args = {}
    if settings.DATABASE_URL.startswith("sqlite"):
        connect_args["timeout"] = 30.0

    engine_kwargs = {
        "echo": False,
        "future": True,
        "pool_pre_ping": True,
        "connect_args": connect_args,
    }
    if not settings.DATABASE_URL.startswith("sqlite"):
        engine_kwargs.update({
            "pool_size": 20,
            "max_overflow": 10,
            "pool_recycle": 1800,
            "pool_timeout": 30,
        })

    # 3. Create a fresh engine inside the pytest-asyncio event loop
    new_engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

    if settings.DATABASE_URL.startswith("sqlite"):
        @sa_event.listens_for(new_engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

    new_session_factory = async_sessionmaker(
        bind=new_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    # 4. Rebind the module-level globals so all production code that imported
    #    `from app.core.db import engine` or `AsyncSessionLocal` now uses the
    #    correctly-looped instances.
    db_module.engine = new_engine
    db_module.AsyncSessionLocal = new_session_factory

    # 5. Initialize the schema tables inside the test loop
    async with new_engine.begin() as conn:
        await conn.run_sync(db_module.Base.metadata.create_all)

    yield

    # 6. Dispose after all tests are done
    await new_engine.dispose()


@pytest.fixture(autouse=True)
async def dispose_connections_between_tests():
    """Prevent connection pool state from leaking between individual tests."""
    yield
    import app.core.db as db_module
    await db_module.engine.dispose()
