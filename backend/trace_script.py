import sys, os
sys.path.append(os.path.dirname(__file__))

import asyncio, json
from app.services.ai_engine import ai_engine
from app.services.question_factory import question_factory
from app.services.question_planner import question_planner

async def main():
    slots = question_planner.create_blueprint(['Software Concepts'], 'Medium', 10)
    prompt = question_factory._build_factory_prompt(slots, [], 1)
    raw = await ai_engine._call_gemini_with_fallback(prompt, json_mode=True, task='assessment')
    print("=== RAW RESPONSE ===")
    print(raw[:1000])
    parsed = json.loads(ai_engine._clean_json_str(raw))
    qs = parsed if isinstance(parsed, list) else parsed.get('questions', [])
    print("\n=== PARSED QUESTIONS ===")
    for idx, q in enumerate(qs, 1):
        print(f"Q#{idx}: correct_option={q.get('correct_option')} | options={q.get('options')}")

if __name__ == "__main__":
    asyncio.run(main())
