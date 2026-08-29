import asyncio
import sys
import os
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.db import get_engine, Base
import app.models.domain  # Ensure all models are registered

async def run_migrations():
    print("Running database migrations for Assessment Engine...")
    engine = get_engine()
    async with engine.begin() as conn:
        # 1. Create any missing tables (like candidate_question_history)
        await conn.run_sync(Base.metadata.create_all)

        # 2. Add missing columns to existing tables
        migrations = [
            "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS is_repeated BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS passage_text TEXT;",
            "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS dataset_json JSON;",
            "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS test_cases JSON;",
            "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS passage_text TEXT;",
            "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS dataset_json JSON;",
            "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS test_cases JSON;",
            "ALTER TABLE candidate_question_history ADD COLUMN IF NOT EXISTS category VARCHAR(100);",
            "ALTER TABLE candidate_question_history ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);",
        ]

        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                print(f"Notice executing '{stmt}': {e}")

    print("Database migrations completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migrations())
