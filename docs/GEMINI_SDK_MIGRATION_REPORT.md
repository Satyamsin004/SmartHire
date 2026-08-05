# Multi-Provider AI Architecture Report

## Result

SmartHire AI uses the centralized multi-provider manager (`app/services/ai_provider.py`) with support for Gemini (`gemini-2.0-flash`), OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`), and Groq (`llama-3.3-70b-versatile`).

## Multi-Key Configuration

Configured environment variables in `.env`:
- `GEMINI_API_KEY_1`..`4`
- `OPENROUTER_API_KEY_1`..`2`
- `GROQ_API_KEY_1`..`2`

No code references single `GEMINI_API_KEY` anymore.
- Live smoke verification was attempted on 2026-08-05. The SDK connected, but
  Gemini returned HTTP 429 because the configured project's `gemini-2.5-flash`
  free-tier request quota was exhausted. This is an external quota condition,
  not a migration failure; retry after quota reset or with a billed project.
- Rebuild the backend Docker image after deployment so the removed legacy SDK is
  no longer present in the image.
