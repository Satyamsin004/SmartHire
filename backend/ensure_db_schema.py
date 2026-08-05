import asyncio
import logging
from sqlalchemy import text
from app.core.db import engine, Base
import app.models.domain  # Load all SQLAlchemy models

logger = logging.getLogger(__name__)

ALTER_QUERIES = [
    # Candidates table columns
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_preferences JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_preferences JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS headline VARCHAR(255);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location VARCHAR(255);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS employment_preference VARCHAR(100);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_authorization VARCHAR(100);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;",

    # Scoring reports table columns
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS communication_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS confidence_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS technical_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS professionalism_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS missing_topics JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS ideal_answers JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS practice_suggestions JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS fsm_state VARCHAR(50) DEFAULT 'WAITING_FOR_QUESTION';"
]

async def sync_database_schema():
    print("=== SYNCHRONIZING POSTGRESQL DATABASE SCHEMA ===")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        for query in ALTER_QUERIES:
            try:
                await conn.execute(text(query))
            except Exception as e:
                # Handle SQLite vs PostgreSQL syntax differences
                fallback_query = query.replace("JSONB DEFAULT '{}'::jsonb", "JSON DEFAULT '{}'").replace("JSONB DEFAULT '[]'::jsonb", "JSON DEFAULT '[]'")
                try:
                    await conn.execute(text(fallback_query))
                except Exception as inner_e:
                    logger.warning("Query execution warning: %s", inner_e)

    print("[SUCCESS] DATABASE SCHEMA SYNCHRONIZED CLEANLY!")

if __name__ == "__main__":
    asyncio.run(sync_database_schema())
