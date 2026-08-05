"""Centralized multi-provider AI routing for SmartHire AI.
No application service calls an SDK directly. All requests pass through AIProviderManager.
"""
import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Set, Tuple

import httpx
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger("smarthire.ai_provider")


@dataclass
class ProviderResult:
    text: str
    provider: str
    model: str
    key_index: int
    latency_ms: float
    tokens: Optional[int]


@dataclass
class ProviderHealthState:
    status: str = "healthy"  # "healthy", "cooldown", "probe"
    reason: Optional[str] = None
    cooldown_until: float = 0.0
    last_error: Optional[str] = None
    probe_in_progress: bool = False


class ProviderRequestError(RuntimeError):
    def __init__(self, provider: str, status_code: Optional[int], reason: str):
        self.provider = provider
        self.status_code = status_code
        self.reason = reason
        super().__init__(f"{provider}: {reason}")


class AIProviderManager:
    """Enterprise AI Provider Health Manager.
    
    Handles:
    - Task-specific routing priority (Assessment: OpenRouter -> Groq -> Gemini; Interview: Groq -> OpenRouter -> Gemini)
    - Dynamic Provider Health Cache & Automatic 5-minute Cooldown on 429
    - Instant Zero-Delay Failover (Skips unhealthy providers immediately without key rotation)
    - Automatic Probe Recovery (Allows one test request when cooldown expires)
    - Key rotation per provider for non-quota errors
    - Diagnostic health status API (/api/v1/system/ai-status)
    """

    MAX_RETRIES = 3
    RETRY_BACKOFF_DELAYS = [1.0, 2.0, 4.0]
    REQUEST_TIMEOUT_SECONDS = 60
    RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}

    # Task Priority Provider Routing Strategy
    ROUTES = {
        "ats": ("openrouter", "groq", "gemini"),
        "ats_resume_screening": ("openrouter", "groq", "gemini"),
        "interview_question": ("groq", "openrouter", "gemini"),
        "interview_question_generation": ("groq", "openrouter", "gemini"),
        "behavioral_interview": ("groq", "openrouter", "gemini"),
        "hr_interview": ("groq", "openrouter", "gemini"),
        "technical_interview": ("groq", "openrouter", "gemini"),
        "interview": ("groq", "openrouter", "gemini"),
        "assessment": ("openrouter", "groq", "gemini"),
        "assessment_mcq_generation": ("openrouter", "groq", "gemini"),
        "evaluation_reports": ("openrouter", "groq", "gemini"),
        "evaluation_report": ("openrouter", "groq", "gemini"),
        "report": ("openrouter", "groq", "gemini"),
        "default": ("openrouter", "groq", "gemini"),
    }

    def __init__(self) -> None:
        self._last_active_provider: Optional[str] = "openrouter"
        self._last_active_key_index: Dict[str, int] = {
            "gemini": 1,
            "openrouter": 1,
            "groq": 1,
        }
        self._last_status: Dict[str, Dict[str, Optional[object]]] = {
            "gemini": {"success": True, "reason": "OK", "key_index": 1},
            "openrouter": {"success": True, "reason": "OK", "key_index": 1},
            "groq": {"success": True, "reason": "OK", "key_index": 1},
        }
        self._health_states: Dict[str, ProviderHealthState] = {
            "gemini": ProviderHealthState(),
            "openrouter": ProviderHealthState(),
            "groq": ProviderHealthState(),
        }
        # In-memory question diversity registry
        self._question_history: Set[str] = set()

    def reset_health_states(self) -> None:
        self._health_states = {
            "gemini": ProviderHealthState(),
            "openrouter": ProviderHealthState(),
            "groq": ProviderHealthState(),
        }

    @staticmethod
    def _configured_keys(*keys: str) -> List[str]:
        return [key.strip() for key in keys if key and key.strip()]

    def _provider_config(self, provider: str) -> Tuple[List[str], str]:
        if provider == "gemini":
            raw_keys = [getattr(settings, f"GEMINI_API_KEY_{i}", None) for i in range(1, 6)]
            keys = self._configured_keys(*[k for k in raw_keys if k])
            model = settings.GEMINI_MODEL
        elif provider == "openrouter":
            keys = self._configured_keys(
                settings.OPENROUTER_API_KEY_1,
                settings.OPENROUTER_API_KEY_2,
            )
            model = settings.OPENROUTER_MODEL
        elif provider == "groq":
            keys = self._configured_keys(
                settings.GROQ_API_KEY_1,
                settings.GROQ_API_KEY_2,
            )
            model = settings.GROQ_MODEL
        else:
            raise ValueError(f"Unknown provider: {provider}")
        return keys, model

    @staticmethod
    def _is_retryable(status_code: Optional[int], reason: str) -> bool:
        if status_code in AIProviderManager.RETRYABLE_STATUS_CODES:
            return True
        if status_code is None:
            return True
        reason_lower = reason.lower()
        return any(term in reason_lower for term in ("timeout", "network", "connect", "rate"))

    async def generate(
        self,
        prompt: str,
        task: str = "default",
        json_mode: bool = False,
    ) -> Optional[str]:
        providers = self.ROUTES.get(task, self.ROUTES["default"])
        now = time.time()

        # Log Provider Routing Evaluation Decision
        logger.info("==========================================")
        logger.info("PROVIDER ROUTING EVALUATION | Task: %s", task)
        for p in providers:
            p_state = self._health_states.get(p, ProviderHealthState())
            if p_state.status == "disabled":
                logger.info(
                    "  %-12s | status=DISABLED         | Reason=Disabled (HTTP 402) | Action: SKIP",
                    p.capitalize()
                )
            elif p_state.cooldown_until > now:
                rem = int(p_state.cooldown_until - now)
                logger.info(
                    "  %-12s | status=UNHEALTHY/COOLDOWN | cooldown_remaining=%ds | last_error=%s | Action: SKIP",
                    p.capitalize(), rem, p_state.last_error or "429"
                )
            elif p_state.status == "cooldown" and now >= p_state.cooldown_until:
                logger.info(
                    "  %-12s | status=PROBE            | cooldown_expired=True   | Action: ALLOW ONE PROBE REQUEST",
                    p.capitalize()
                )
            else:
                logger.info(
                    "  %-12s | status=HEALTHY          | cooldown_remaining=0s   | Action: ELIGIBLE",
                    p.capitalize()
                )
        logger.info("==========================================")

        for provider in providers:
            state = self._health_states[provider]

            # 0. Permanent Provider Failure Check (HTTP 402 Payment/Credit Exhausted)
            if state.status == "disabled":
                logger.info(
                    "Skipping %s\nReason=Disabled (HTTP 402)",
                    provider.capitalize()
                )
                continue

            # 1. Check active cooldown
            if state.cooldown_until > now:
                rem = int(state.cooldown_until - now)
                logger.info(
                    "Provider Routing | Skipping provider=%s | status=COOLDOWN | cooldown_remaining=%ds | last_error=%s",
                    provider, rem, state.last_error or "429"
                )
                continue

            # 2. Check Cooldown Expiration & Probe Request Handling
            if state.status == "cooldown" or state.cooldown_until > 0:
                if now >= state.cooldown_until:
                    if state.probe_in_progress:
                        logger.info("Provider Routing | Skipping provider=%s | status=PROBE (Probe request already in progress)", provider)
                        continue
                    state.probe_in_progress = True
                    state.status = "probe"
                    logger.info("Provider Routing | Provider %s cooldown expired. Initiating PROBE request...", provider)

            keys, model = self._provider_config(provider)
            if not keys:
                state.probe_in_progress = False
                continue

            logger.info("Attempting provider=%s request using model=%s...", provider, model)

            for key_index, api_key in enumerate(keys, start=1):
                try:
                    result = await self._generate_with_key(
                        provider, model, api_key, key_index, prompt, json_mode
                    )
                    # Mark healthy on success
                    state.status = "healthy"
                    state.reason = "OK"
                    state.cooldown_until = 0.0
                    state.last_error = None
                    state.probe_in_progress = False

                    self._last_active_provider = provider
                    self._last_active_key_index[provider] = key_index
                    self._last_status[provider] = {
                        "success": True,
                        "reason": "OK",
                        "key_index": key_index,
                    }
                    logger.info("Provider %s SUCCESS (HTTP 200). Active provider set to %s.", provider.capitalize(), provider.capitalize())
                    return result.text

                except ProviderRequestError as error:
                    self._last_status[provider] = {
                        "success": False,
                        "reason": error.reason,
                        "key_index": key_index,
                    }
                    # Permanent Provider Failure (HTTP 402 Payment/Credit Exhausted)
                    if error.status_code == 402 or "402" in str(error.reason) or "payment" in str(error.reason).lower() or "credit" in str(error.reason).lower():
                        state.status = "disabled"
                        state.reason = "Disabled (HTTP 402)"
                        state.cooldown_until = 0.0
                        state.last_error = "402"
                        state.probe_in_progress = False

                        logger.error(
                            "Provider=%s\nHTTP=402\nAction=DISABLED\nReason=Payment/Credit Exhausted",
                            provider
                        )
                        break  # Do NOT retry additional API keys for this provider!

                    # On HTTP 429 quota error: Start 5-minute Cooldown immediately
                    if error.status_code == 429 or "429" in error.reason or "quota" in error.reason.lower():
                        state.status = "cooldown"
                        state.reason = "quota_exceeded"
                        state.cooldown_until = time.time() + 300.0  # 5 minutes
                        state.last_error = "429"
                        state.probe_in_progress = False

                        logger.warning(
                            "Provider %s returned HTTP 429 quota exceeded. Cooldown started for 300s. SKIPPING ENTIRE PROVIDER and failing over...",
                            provider.capitalize()
                        )
                        break  # Break out of key loop immediately!

                    logger.warning(
                        "Provider %s key_index=%d failed (%s). Trying next key...",
                        provider, key_index, error.reason
                    )
                    continue

            state.probe_in_progress = False
            logger.warning(
                "All keys for provider=%s exhausted for task=%s. Switching to fallback provider...",
                provider, task
            )

        logger.error("All AI providers exhausted for task=%s", task)
        return None

    async def _generate_with_key(
        self,
        provider: str,
        model: str,
        api_key: str,
        key_index: int,
        prompt: str,
        json_mode: bool,
    ) -> ProviderResult:
        last_error: Optional[ProviderRequestError] = None

        for attempt in range(self.MAX_RETRIES):
            started_at = time.perf_counter()
            try:
                if provider == "gemini":
                    text, tokens = await self._generate_gemini(
                        api_key, model, prompt, json_mode
                    )
                else:
                    text, tokens = await self._generate_openai_compatible(
                        provider, api_key, model, prompt, json_mode
                    )

                latency_ms = round((time.perf_counter() - started_at) * 1000, 1)
                tokens_count = tokens if tokens is not None else 0

                self._log(
                    provider=provider,
                    model=model,
                    key_index=key_index,
                    latency_ms=latency_ms,
                    tokens=tokens_count,
                    prompt=prompt,
                    completion=text,
                    success=True,
                    reason=None,
                    http_status=200,
                    retry_count=attempt,
                )

                return ProviderResult(
                    text=text,
                    provider=provider,
                    model=model,
                    key_index=key_index,
                    latency_ms=latency_ms,
                    tokens=tokens_count,
                )

            except (httpx.TimeoutException, httpx.NetworkError, asyncio.TimeoutError) as error:
                reason = type(error).__name__
                last_error = ProviderRequestError(provider, None, reason)
            except ProviderRequestError as error:
                last_error = error
            except Exception as error:
                code = getattr(error, "code", None) or getattr(error, "status_code", None)
                reason = str(error) or type(error).__name__
                last_error = ProviderRequestError(provider, code, reason)

            latency_ms = round((time.perf_counter() - started_at) * 1000, 1)
            self._log(
                provider=provider,
                model=model,
                key_index=key_index,
                latency_ms=latency_ms,
                tokens=0,
                prompt=prompt,
                completion=None,
                success=False,
                reason=last_error.reason,
                http_status=last_error.status_code,
                retry_count=attempt,
            )

            # On Gemini 429, don't waste retries on same key; break immediately to rotate key
            if provider == "gemini" and last_error.status_code == 429:
                break

            if not self._is_retryable(last_error.status_code, last_error.reason):
                break

            if attempt < self.MAX_RETRIES - 1:
                delay = self.RETRY_BACKOFF_DELAYS[attempt]
                logger.info(
                    "Retrying request | provider=%s | key_index=%d | attempt=%d/%d | delay=%.1fs",
                    provider,
                    key_index,
                    attempt + 2,
                    self.MAX_RETRIES,
                    delay,
                )
                await asyncio.sleep(delay)

        raise last_error or ProviderRequestError(provider, None, "unknown_failure")

    async def _generate_gemini(
        self, api_key: str, model: str, prompt: str, json_mode: bool
    ) -> Tuple[str, Optional[int]]:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=60_000),
        )
        try:
            config = (
                types.GenerateContentConfig(response_mime_type="application/json")
                if json_mode
                else None
            )
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=model, contents=prompt, config=config
                ),
                timeout=self.REQUEST_TIMEOUT_SECONDS,
            )
            if not response.text:
                raise ProviderRequestError("gemini", None, "empty_response")
            usage = getattr(response, "usage_metadata", None)
            tokens = getattr(usage, "total_token_count", None) if usage else None
            return response.text.strip(), tokens
        except Exception as error:
            status_code = getattr(error, "code", None) or getattr(error, "status_code", None)
            err_msg = str(error)
            if "429" in err_msg or status_code == 429 or "RESOURCE_EXHAUSTED" in err_msg:
                raise ProviderRequestError("gemini", 429, "429_quota_exceeded") from error
            raise ProviderRequestError("gemini", status_code, err_msg) from error
        finally:
            await client.aio.aclose()

    async def _generate_openai_compatible(
        self, provider: str, api_key: str, model: str, prompt: str, json_mode: bool
    ) -> Tuple[str, Optional[int]]:
        url = (
            "https://openrouter.ai/api/v1/chat/completions"
            if provider == "openrouter"
            else "https://api.groq.com/openai/v1/chat/completions"
        )
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        if provider == "openrouter":
            import json as _json
            logger.info("==========================================")
            logger.info("OPENROUTER REQUEST")
            logger.info("model=%s", model)
            logger.info("endpoint=%s", url)
            logger.info("payload=%s", _json.dumps(payload)[:500])
            logger.info("==========================================")

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)

        if provider == "openrouter":
            logger.info("==========================================")
            logger.info("OPENROUTER RESPONSE")
            logger.info("response status=%d", response.status_code)
            logger.info("response body=%s", response.text[:500])
            logger.info("==========================================")

        if response.status_code >= 400:
            raise ProviderRequestError(
                provider, response.status_code, f"http_{response.status_code}"
            )

        data = response.json()
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise ProviderRequestError(
                provider, None, f"invalid_response_{type(error).__name__}"
            ) from error

        if not text:
            raise ProviderRequestError(provider, None, "empty_response")

        tokens = (data.get("usage") or {}).get("total_tokens")
        return text.strip(), tokens

    @staticmethod
    def _log(
        provider: str,
        model: str,
        key_index: int,
        latency_ms: float,
        tokens: Optional[int],
        prompt: str,
        completion: Optional[str],
        success: bool,
        reason: str,
        http_status: Optional[int] = None,
        retry_count: int = 0,
    ) -> None:
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:8]
        logger.info(
            "AI request | provider=%s | model=%s | key_index=%d | latency_ms=%.1f | tokens=%s | prompt_hash=%s | prompt_length=%d | response_length=%d | http_status=%s | retry_count=%d | success=%s | failure_reason=%s",
            provider,
            model,
            key_index,
            latency_ms,
            tokens or 0,
            prompt_hash,
            len(prompt),
            len(completion or ""),
            http_status or "None",
            retry_count,
            success,
            reason,
        )

    # --- QUESTION DIVERSITY & SIMILARITY MATCHING ---
    @staticmethod
    def calculate_text_similarity(text1: str, text2: str) -> float:
        """Calculate similarity ratio between two questions using SequenceMatcher."""
        s1 = "".join(c.lower() for c in text1 if c.isalnum() or c.isspace()).strip()
        s2 = "".join(c.lower() for c in text2 if c.isalnum() or c.isspace()).strip()
        return SequenceMatcher(None, s1, s2).ratio()

    def is_duplicate_question(
        self, new_question: str, existing_questions: Optional[List[str]] = None, threshold: float = 0.70
    ) -> bool:
        """Check if a question is duplicate against existing list or recorded history."""
        targets = list(self._question_history)
        if existing_questions:
            targets.extend(existing_questions)

        for existing in targets:
            if self.calculate_text_similarity(new_question, existing) >= threshold:
                return True
        return False

    def register_asked_question(self, question_text: str) -> None:
        """Register question to global diversity tracking."""
        if question_text and question_text.strip():
            self._question_history.add(question_text.strip())

    # --- HEALTH CHECK DIAGNOSTICS & VERIFICATION HELPERS ---
    def set_provider_cooldown(self, provider: str, duration_sec: float = 300.0, error_reason: str = "429") -> None:
        """Manually trigger cooldown for testing & verification."""
        p_key = provider.lower()
        if p_key in self._health_states:
            st = self._health_states[p_key]
            st.status = "cooldown"
            st.reason = "quota_exceeded"
            st.cooldown_until = time.time() + duration_sec
            st.last_error = error_reason
            st.probe_in_progress = False

    def reset_provider_health(self, provider: Optional[str] = None) -> None:
        """Reset provider health to healthy for testing, manual reset, or successful probe."""
        if provider:
            p_key = provider.lower()
            if p_key in self._health_states:
                self._health_states[p_key] = ProviderHealthState()
                logger.info("Manual health reset for provider=%s", p_key)
        else:
            for p in self._health_states:
                self._health_states[p] = ProviderHealthState()
            logger.info("Manual health reset for ALL providers")

    def health_status(self) -> Dict[str, object]:
        """Return operational status of configured AI providers."""
        now = time.time()
        status = {}
        for provider, provider_name in [
            ("gemini", "Gemini"),
            ("openrouter", "OpenRouter"),
            ("groq", "Groq"),
        ]:
            keys, model = self._provider_config(provider)
            state = self._health_states.get(provider, ProviderHealthState())
            prev = self._last_status.get(provider, {})

            cooldown_rem = int(max(0, state.cooldown_until - now)) if state.cooldown_until > now else 0
            curr_status = "disabled" if state.status == "disabled" else ("cooldown" if cooldown_rem > 0 else state.status)

            status[provider_name] = {
                "status": curr_status,
                "cooldown_remaining": cooldown_rem,
                "last_error": state.last_error or (None if prev.get("success") else str(prev.get("reason") or "OK")),
                "available": len(keys) > 0,
                "key_active": f"Key {prev.get('key_index') or 1}",
                "quota_status": prev.get("reason") or "OK",
                "configured_key_count": len(keys),
                "model": model,
                "last_success": prev.get("success"),
            }

        curr_prov = self._last_active_provider or "openrouter"
        curr_prov_name = "OpenRouter" if curr_prov.lower() == "openrouter" else ("Groq" if curr_prov.lower() == "groq" else "Gemini")
        status["current_provider"] = curr_prov_name
        status["current_active_provider"] = curr_prov_name
        return status


ai_provider = AIProviderManager()
