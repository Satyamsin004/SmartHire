import os
import asyncio
import pytest

# Ensure tests default to SQLite unless an explicit DATABASE_URL is set (e.g. in CI with PostgreSQL container)
if "DATABASE_URL" not in os.environ:
    os.environ["USE_SQLITE"] = "true"

@pytest.fixture(autouse=True)
def reset_provider_health():
    from app.services.ai_provider import ai_provider
    ai_provider.reset_health_states()

@pytest.fixture(scope="session", autouse=True)
async def initialize_and_cleanup_test_database():
    from ensure_db_schema import sync_database_schema
    await sync_database_schema()
    yield
    from app.core.db import engine
    await engine.dispose()

@pytest.fixture(autouse=True)
async def cleanup_per_test_db_connections():
    yield
    from app.core.db import engine
    await engine.dispose()
