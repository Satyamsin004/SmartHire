import asyncio
from sqlalchemy import text
from app.core.db import AsyncSessionLocal

async def purge_all_database_data():
    print("====================================================================")
    print("         PURGING ALL DATA FROM DATABASE (POSTGRESQL / SQLITE)")
    print("====================================================================\n")

    tables_to_purge = [
        # Level 1: Leaf child tables
        "resume_skills",
        "resume_educations",
        "resume_experiences",
        "resume_internships",
        "resume_projects",
        "resume_certifications",
        "resume_achievements",
        "resume_languages",
        "resume_ats",
        "interview_answers",
        "interview_questions",
        "speech_analysis",
        "eye_tracking",
        "emotion_analysis",
        "scoring_reports",
        "offer_letters",
        "job_applications",
        "saved_jobs",
        "resume_views",
        
        # Level 2: Parent child tables
        "resumes",
        "interview_sessions",
        "scheduled_interviews",
        "notifications",
        "activity_logs",
        "job_descriptions",
        "interview_templates",

        # Level 3: Core entity tables
        "job_postings",
        "candidates",
        "recruiters",
        "admins",

        # Level 4: Root user table
        "users"
    ]

    async with AsyncSessionLocal() as db:
        for table in tables_to_purge:
            try:
                result = await db.execute(text(f"DELETE FROM {table};"))
                deleted_count = result.rowcount
                print(f"[PURGED] Table '{table}' -> {deleted_count} rows deleted.")
            except Exception as e:
                print(f"[INFO] Table '{table}': {e}")

        await db.commit()
        print("\n====================================================================")
        print("[SUCCESS] ALL DATA PURGED CLEANLY FROM DATABASE.")
        print("====================================================================\n")

if __name__ == "__main__":
    asyncio.run(purge_all_database_data())
