import os
import pytest

os.environ["USE_SQLITE"] = "true"

@pytest.fixture(autouse=True)
def reset_provider_health():
    from app.services.ai_provider import ai_provider
    ai_provider.reset_health_states()
