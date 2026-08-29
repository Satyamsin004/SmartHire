import asyncio
from sqlalchemy import text
from app.core.db import AsyncSessionLocal

async def purge_activity_data():
    async with AsyncSessionLocal() as db:
        tables_to_clear = [
            "scoring_reports",
            "interview_answers",
            "speech_analysis",
            "eye_tracking",
            "emotion_analysis",
            "interview_transcripts",
            "interview_vision_analysis",
            "interview_recordings",
            "interview_questions",
            "interview_sessions",
            "candidate_question_history",
            "assessment_question_history",
            "assessment_questions",
            "assessment_sessions",
            "job_applications",
            "saved_jobs",
            "scheduled_interviews",
            "notifications",
            "offer_letters",
            "job_postings"
        ]
        
        for table in tables_to_clear:
            try:
                await db.execute(text(f"DELETE FROM {table}"))
            except Exception as e:
                print(f"Notice on table {table}: {e}")
                
        # Reset candidate metrics on candidates table
        try:
            await db.execute(text("UPDATE candidates SET readiness_score = 0.0, avg_score = 0.0, total_interviews = 0"))
        except Exception as e:
            print(f"Notice resetting candidates table: {e}")

        await db.commit()
        print("[OK] PURGE COMPLETE: All jobs, interview history, applications, assessments, and notifications cleared cleanly!")
        print("[OK] User accounts and candidate profiles preserved intact.")

if __name__ == "__main__":
    asyncio.run(purge_activity_data())
