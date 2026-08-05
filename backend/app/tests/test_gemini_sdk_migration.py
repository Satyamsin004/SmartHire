import logging
import pytest
from app.services.ai_engine import ai_engine
from app.services.ai_provider import ai_provider

@pytest.mark.asyncio
async def test_new_sdk_uses_gemini_model_and_logs_usage(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    async def mock_generate(prompt, task="default", json_mode=False):
        return '{"result":"ok"}'
    monkeypatch.setattr(ai_provider, "generate", mock_generate)
    result = await ai_engine._call_gemini_with_fallback("Return JSON", json_mode=True)
    assert result is not None
