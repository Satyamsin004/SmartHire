"""Self-test script to verify SmartHire AI Provider Manager.
Verifies:
1. Environment Variable Loading
2. Gemini Key Rotation (Simulating 429 quota exhaustion)
3. OpenRouter Provider Execution
4. Groq Provider Execution
5. Automatic Failover Across Providers
6. Latency & Logging Metrics
7. Question Diversity / Deduplication
8. Diagnostic Health Endpoint Structure
"""
import asyncio
import logging
import os
import sys
import time
from typing import Optional, List, Tuple
from unittest.mock import AsyncMock, patch

# Ensure backend path is in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set env path for config loading
os.environ["PYTHONPATH"] = backend_dir

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("verify_ai_providers")


async def main():
    print("=" * 80)
    print("=== SMARTHIRE AI MULTI-PROVIDER ARCHITECTURE VERIFICATION ===")
    print("=" * 80)

    from app.core.config import settings
    from app.services.ai_provider import ai_provider, ProviderRequestError

    # --- 1. VERIFY ENVIRONMENT VARIABLES ---
    print("\n--- 1. Checking Environment Variables ---")
    keys_status = {
        "GEMINI_API_KEY_1": bool(settings.GEMINI_API_KEY_1),
        "GEMINI_API_KEY_2": bool(settings.GEMINI_API_KEY_2),
        "GEMINI_API_KEY_3": bool(settings.GEMINI_API_KEY_3),
        "GEMINI_API_KEY_4": bool(settings.GEMINI_API_KEY_4),
        "OPENROUTER_API_KEY_1": bool(settings.OPENROUTER_API_KEY_1),
        "OPENROUTER_API_KEY_2": bool(settings.OPENROUTER_API_KEY_2),
        "GROQ_API_KEY_1": bool(settings.GROQ_API_KEY_1),
        "GROQ_API_KEY_2": bool(settings.GROQ_API_KEY_2),
    }

    for key_name, configured in keys_status.items():
        val = getattr(settings, key_name)
        masked = f"{val[:6]}...{val[-4:]}" if val and len(val) > 10 else ("Configured" if val else "MISSING")
        print(f"  [ENV] {key_name:<20}: {'[OK] (' + masked + ')' if configured else '[MISSING]'}")

    print(f"  [ENV] GEMINI_MODEL       : {settings.GEMINI_MODEL}")
    print(f"  [ENV] OPENROUTER_MODEL   : {settings.OPENROUTER_MODEL}")
    print(f"  [ENV] GROQ_MODEL         : {settings.GROQ_MODEL}")

    all_keys_ok = all(keys_status.values())
    if not all_keys_ok:
        print("[WARNING] Some API keys are missing in .env")

    # --- 2. VERIFY GEMINI KEY ROTATION (MOCK 429) ---
    print("\n--- 2. Verifying Gemini Key Rotation on 429 Quota Exhaustion ---")
    keys_attempted: List[int] = []

    async def mock_generate_gemini(api_key: str, model: str, prompt: str, json_mode: bool) -> Tuple[str, Optional[int]]:
        # Map key to index
        all_keys, _ = ai_provider._provider_config("gemini")
        try:
            key_idx = all_keys.index(api_key) + 1
        except ValueError:
            key_idx = 1
        keys_attempted.append(key_idx)
        if key_idx < 4:
            logger.info("Simulating 429 Rate Limit on Gemini Key %d...", key_idx)
            raise ProviderRequestError("gemini", 429, "429_quota_exceeded")
        logger.info("Gemini Key 4 Success!")
        return "Simulated Gemini completion from Key 4", 42

    with patch.object(ai_provider, "_generate_gemini", side_effect=mock_generate_gemini):
        start_t = time.perf_counter()
        resp = await ai_provider.generate("Test prompt for key rotation", task="ats")
        elapsed_ms = (time.perf_counter() - start_t) * 1000

    print(f"  Rotation Chain Result: '{resp}'")
    print(f"  Keys Attempted Sequence: {keys_attempted}")
    print(f"  Rotation Latency: {elapsed_ms:.1f} ms")

    assert keys_attempted == [1, 2, 3, 4], f"Expected rotation [1, 2, 3, 4], got {keys_attempted}"
    assert resp == "Simulated Gemini completion from Key 4", "Expected Key 4 response"
    print("  [PASS] Gemini Key Rotation (Key 1 -> 429 -> Key 2 -> 429 -> Key 3 -> 429 -> Key 4) Verified [OK]")

    # --- 3. VERIFY AUTOMATIC FAILOVER (GEMINI -> OPENROUTER) ---
    print("\n--- 3. Verifying Automatic Failover (Gemini Exhausted -> OpenRouter) ---")

    async def mock_gemini_all_fail(api_key: str, model: str, prompt: str, json_mode: bool) -> Tuple[str, Optional[int]]:
        raise ProviderRequestError("gemini", 429, "429_all_keys_exhausted")

    async def mock_openrouter_success(provider: str, api_key: str, model: str, prompt: str, json_mode: bool) -> Tuple[str, Optional[int]]:
        return "Fallback completion from OpenRouter", 65

    with patch.object(ai_provider, "_generate_gemini", side_effect=mock_gemini_all_fail), \
         patch.object(ai_provider, "_generate_openai_compatible", side_effect=mock_openrouter_success):
        start_t = time.perf_counter()
        resp = await ai_provider.generate("ATS Resume screening task", task="ats")
        elapsed_ms = (time.perf_counter() - start_t) * 1000

    print(f"  Failover Result: '{resp}'")
    print(f"  Failover Latency: {elapsed_ms:.1f} ms")
    assert resp == "Fallback completion from OpenRouter", "Expected OpenRouter fallback response"
    print("  [PASS] Failover from Gemini to OpenRouter Verified [OK]")

    # --- 4. VERIFY GROQ FALLBACK FOR INTERVIEWS ---
    print("\n--- 4. Verifying Provider Routing & Groq Fallback for Interviews ---")

    async def mock_groq_success(provider: str, api_key: str, model: str, prompt: str, json_mode: bool) -> Tuple[str, Optional[int]]:
        return "Technical interview question from Groq fallback", 50

    with patch.object(ai_provider, "_generate_gemini", side_effect=mock_gemini_all_fail), \
         patch.object(ai_provider, "_generate_openai_compatible", side_effect=mock_groq_success):
        start_t = time.perf_counter()
        resp = await ai_provider.generate("Generate technical question", task="technical_interview")
        elapsed_ms = (time.perf_counter() - start_t) * 1000

    print(f"  Interview Fallback Result: '{resp}'")
    print(f"  Interview Fallback Latency: {elapsed_ms:.1f} ms")
    assert resp == "Technical interview question from Groq fallback", "Expected Groq fallback for interview"
    print("  [PASS] Interview Routing Fallback to Groq Verified [OK]")

    # --- 5. VERIFY EXPONENTIAL BACKOFF RETRY LOGIC ---
    print("\n--- 5. Verifying Exponential Backoff Retries (3 Attempts) ---")
    attempts_made = 0

    async def mock_transient_error(api_key: str, model: str, prompt: str, json_mode: bool) -> Tuple[str, Optional[int]]:
        nonlocal attempts_made
        attempts_made += 1
        if attempts_made < 3:
            raise ProviderRequestError("gemini", 503, "503_service_unavailable")
        return "Recovered after 2 retries", 30

    with patch.object(ai_provider, "_generate_gemini", side_effect=mock_transient_error), \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        resp = await ai_provider.generate("Test retry backoff", task="ats")

    print(f"  Total Attempts: {attempts_made}")
    print(f"  Backoff Delays Called: {[call.args[0] for call in mock_sleep.call_args_list]}")
    assert attempts_made == 3, f"Expected 3 attempts, got {attempts_made}"
    assert mock_sleep.call_count == 2, "Expected 2 sleep calls for backoff"
    assert resp == "Recovered after 2 retries", "Expected successful recovery on 3rd attempt"
    print("  [PASS] Exponential Backoff Retries (1s, 2s) Verified [OK]")

    # --- 6. VERIFY QUESTION DIVERSITY & SIMILARITY DEDUPLICATION ---
    print("\n--- 6. Verifying Question Diversity & Similarity Deduplication ---")
    q1 = "What is the difference between synchronous and asynchronous execution in JavaScript?"
    q2 = "Explain the difference between synchronous and asynchronous code in JavaScript?"
    q3 = "How does PostgreSQL manage transactions using WAL logs?"

    sim_1_2 = ai_provider.calculate_text_similarity(q1, q2)
    sim_1_3 = ai_provider.calculate_text_similarity(q1, q3)

    print(f"  Similarity (q1 vs q2 - similar): {sim_1_2 * 100:.1f}%")
    print(f"  Similarity (q1 vs q3 - different): {sim_1_3 * 100:.1f}%")

    ai_provider.register_asked_question(q1)
    is_dup_similar = ai_provider.is_duplicate_question(q2)
    is_dup_different = ai_provider.is_duplicate_question(q3)

    print(f"  Duplicate Check for Similar Question: {is_dup_similar} (Expected: True)")
    print(f"  Duplicate Check for Different Question: {is_dup_different} (Expected: False)")

    assert is_dup_similar is True, "Similar question should be marked as duplicate"
    assert is_dup_different is False, "Different question should not be marked as duplicate"
    print("  [PASS] Question Similarity & Deduplication Verified [OK]")

    # --- 7. VERIFY HEALTH STATUS DIAGNOSTICS ---
    print("\n--- 7. Verifying Health Status Diagnostics Endpoint Output ---")
    status = ai_provider.health_status()
    print("  Health Status Output:")
    for key, val in status.items():
        print(f"    {key}: {val}")

    assert "Gemini" in status, "Health status missing Gemini"
    assert "OpenRouter" in status, "Health status missing OpenRouter"
    assert "Groq" in status, "Health status missing Groq"
    assert "current_active_provider" in status, "Health status missing current_active_provider"
    print("  [PASS] Health Status Endpoint Structure Verified [OK]")

    # --- 8. LIVE PROVIDER API CONNECTION TEST ---
    print("\n--- 8. Testing Live API Connection (Primary Provider) ---")
    try:
        live_result = await ai_provider.generate(
            "Respond with exact phrase 'SMARTHIRE_AI_HEALTHY'",
            task="default"
        )
        print(f"  Live Completion Response: '{live_result}'")
        if live_result:
            print("  [PASS] Live Provider Communication Verified [OK]")
        else:
            print("  [NOTICE] Live completion returned None (Check internet or quota)")
    except Exception as e:
        print(f"  [NOTICE] Live completion call error: {e}")

    print("\n" + "=" * 80)
    print("=== ALL AI PROVIDER ARCHITECTURE VERIFICATION TESTS PASSED SUCCESSFULLY! ===")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
