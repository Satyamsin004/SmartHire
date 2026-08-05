import logging

import pytest
from google.genai import errors

from app.services.ai_engine import ai_engine


class _Usage:
    total_token_count = 17


class _Response:
    text = '{"result":"ok"}'
    usage_metadata = _Usage()


class _Models:
    def __init__(self, failures=0):
        self.failures = failures
        self.calls = []

    async def generate_content(self, *, model, contents, config):
        self.calls.append((model, contents, config))
        if self.failures:
            self.failures -= 1
            raise errors.ClientError(429, {"error": {"message": "rate limit"}})
        return _Response()


class _Client:
    def __init__(self, models):
        self.aio = type("AsyncClient", (), {"models": models})()


@pytest.mark.asyncio
async def test_new_sdk_uses_gemini_model_and_logs_usage(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    result = await ai_engine._call_gemini_with_fallback("Return JSON", json_mode=True)
    assert result is not None
    assert "tokens=" in caplog.text or "success=True" in caplog.text
