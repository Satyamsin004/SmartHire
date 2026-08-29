import asyncio
import logging
from sqlalchemy import text
from app.core.db import engine, Base
import app.models.domain  # Load all SQLAlchemy models

logger = logging.getLogger(__name__)

ALTER_QUERIES = [
    # Candidates table columns
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Registered';",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruiter_notes TEXT;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rating FLOAT DEFAULT 0.0;",
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
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_preferences JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_preferences JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;",

    # Users & Recruiters
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);",
    "ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS company_logo VARCHAR(500);",

    # Resumes
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS objective TEXT;",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS projects JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_years VARCHAR(50);",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;",

    # Job Postings & Applications
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50) DEFAULT 'Remote';",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS education_required VARCHAR(255);",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS requirements TEXT;",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS perks TEXT;",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS selection_process TEXT;",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_contact VARCHAR(100);",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_email VARCHAR(255);",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_phone VARCHAR(50);",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS interview_rounds JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS hiring_timeline VARCHAR(100);",
    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS address TEXT;",
    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_ctc VARCHAR(50);",
    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS expected_ctc VARCHAR(50);",

    # Scheduled Interviews & Interview Sessions
    "ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS job_application_id VARCHAR(36);",
    "ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS job_id VARCHAR(36);",
    "ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS resume_id VARCHAR(36);",
    "ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 6;",
    "ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb;",

    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recruiter_id VARCHAR(36);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_application_id VARCHAR(36);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_id VARCHAR(36);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS resume_id VARCHAR(36);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS scheduled_interview_id VARCHAR(36);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'Medium';",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 6;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS interview_type VARCHAR(50) DEFAULT 'Recruiter';",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS fsm_state VARCHAR(50) DEFAULT 'WAITING_FOR_QUESTION';",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(50) DEFAULT 'CLEAN';",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS integrity_score FLOAT DEFAULT 100.0;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS total_integrity_incidents INTEGER DEFAULT 0;",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(255);",
    "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP;",

    # Scoring Reports
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS communication_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS confidence_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS technical_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS professionalism_metrics JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS missing_topics JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS ideal_answers JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS practice_suggestions JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS grammar_score FLOAT DEFAULT 85.0;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS problem_solving_score FLOAT DEFAULT 84.0;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS behavior_score FLOAT DEFAULT 82.0;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS leadership_score FLOAT DEFAULT 78.0;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS overall_summary TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS technical_analysis TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS communication_analysis TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS behavioral_analysis TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS grammar_analysis TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS confidence_analysis TEXT;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS weaknesses JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS improvement_plan JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS practice_recommendations JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS learning_resources JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS question_evaluations JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS speech_timeline JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS gaze_timeline JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS emotion_timeline JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'smart-hire-v2.0.0';",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS analysis_version VARCHAR(50) DEFAULT 'evidence_based_v2';",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500);",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS recommendation VARCHAR(50) DEFAULT 'Shortlist';",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS candidate_id VARCHAR(36);",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS transcript_id VARCHAR(36);",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS vision_analysis_id VARCHAR(36);",
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'COMPLETED';"
]

TABLES_FOR_ENV_COLUMNS = [
    "users", "candidates", "recruiters", "admins", "resumes", "job_descriptions",
    "saved_jobs", "interview_templates", "interview_sessions", "interview_questions",
    "interview_answers", "scoring_reports", "achievements", "activity_logs",
    "scheduled_interviews", "notifications", "job_postings", "job_applications", "offer_letters", "resume_views",
    "interview_recordings", "interview_transcripts", "interview_vision_analysis"
]

async def sync_database_schema():
    print("=== SYNCHRONIZING DATABASE SCHEMA ===")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        for query in ALTER_QUERIES:
            sql = query
            if conn.dialect.name == "sqlite":
                sql = sql.replace(" ADD COLUMN IF NOT EXISTS ", " ADD COLUMN ")
                sql = sql.replace("JSONB DEFAULT '{}'::jsonb", "JSON").replace("JSONB DEFAULT '[]'::jsonb", "JSON")
                sql = sql.replace("JSONB", "JSON").replace("::jsonb", "")
            try:
                await conn.execute(text(sql))
            except Exception as e:
                logger.warning("Query execution warning: %s", e)

        for tbl in TABLES_FOR_ENV_COLUMNS:
            for col_sql in [
                f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;",
                f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';"
            ]:
                sql = col_sql
                if conn.dialect.name == "sqlite":
                    sql = sql.replace(" ADD COLUMN IF NOT EXISTS ", " ADD COLUMN ")
                try:
                    await conn.execute(text(sql))
                except Exception:
                    pass

    from app.core.db import dispose_engine
    await dispose_engine()
    print("[SUCCESS] DATABASE SCHEMA SYNCHRONIZED CLEANLY!")

if __name__ == "__main__":
    asyncio.run(sync_database_schema())
