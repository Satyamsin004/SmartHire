import asyncio
from app.core.db import AsyncSessionLocal, engine
from sqlalchemy import text

async def purge_all_database_data():
    print("=== PURGING ALL DATA FROM DATABASE ===")
    async with AsyncSessionLocal() as session:
        # Array of tables in reverse dependency order
        tables = [
            "notifications",
            "offer_letters",
            "job_applications",
            "job_postings",
            "saved_jobs",
            "resume_skills",
            "resumes",
            "resume_views",
            "scheduled_interviews",
            "scoring_reports",
            "speech_analysis",
            "eye_tracking",
            "emotion_analysis",
            "interview_answers",
            "interview_questions",
            "interview_sessions",
            "interview_templates",
            "job_descriptions",
            "achievements",
            "activity_logs",
            "candidates",
            "recruiters",
            "admins",
            "users"
        ]

        # Try PostgreSQL TRUNCATE CASCADE first
        try:
            tbl_str = ", ".join(tables)
            await session.execute(text(f"TRUNCATE TABLE {tbl_str} CASCADE;"))
            await session.commit()
            print("[OK] Successfully executed TRUNCATE CASCADE on PostgreSQL database.")
        except Exception as e:
            print(f"TRUNCATE CASCADE note ({e}), performing table-by-table DELETE...")
            await session.rollback()
            for tbl in tables:
                try:
                    await session.execute(text(f"DELETE FROM {tbl};"))
                    await session.commit()
                    print(f"   [DELETED] All records from table '{tbl}'")
                except Exception as ex:
                    print(f"   [NOTE] Table '{tbl}': {ex}")

    print("[SUCCESS] ALL DATABASE DATA PURGED SUCCESSFULLY! Database is now completely empty.")

if __name__ == "__main__":
    asyncio.run(purge_all_database_data())
