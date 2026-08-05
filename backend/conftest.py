import os
import asyncio
import pytest

# Ensure tests use SQLite unless an explicit DATABASE_URL is set (e.g. in CI with PostgreSQL container)
if "DATABASE_URL" not in os.environ:
    os.environ["USE_SQLITE"] = "true"

@pytest.fixture(autouse=True)
def reset_provider_health():
    from app.services.ai_provider import ai_provider
    ai_provider.reset_health_states()

@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    from ensure_db_schema import sync_database_schema
    asyncio.run(sync_database_schema())
