"""Live smoke test for multi-provider AI engine.

Run from backend/: `python verify_gemini_25_flash.py`
Requires GEMINI_API_KEY_1. No keys are printed by this script.
"""
import asyncio
import logging
import sys

from app.core.config import settings
from app.services.ai_engine import ai_engine


REQUESTS = {
    "interview question": "Generate one concise senior Python interview question.",
    "MCQ": "Generate one Python MCQ with four options, the correct answer, and a short explanation as JSON.",
    "ATS analysis": "Analyze this candidate for a backend Python role as JSON: skills Python, FastAPI, PostgreSQL; experience 3 years.",
}


async def main() -> int:
    if not settings.GEMINI_API_KEY_1:
        print("GEMINI_API_KEY_1 is not configured; live Gemini verification was skipped.")
        return 2

    failures = []
    try:
        for name, prompt in REQUESTS.items():
            response = await ai_engine._call_gemini_with_fallback(prompt, json_mode=name != "interview question")
            if response:
                print(f"PASS: {name}")
            else:
                print(f"FAIL: {name}; inspect Gemini request logs for details.")
                failures.append(name)
        return 1 if failures else 0
    finally:
        pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    sys.exit(asyncio.run(main()))
