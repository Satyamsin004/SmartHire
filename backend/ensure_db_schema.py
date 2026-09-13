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
    "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'COMPLETED';",

    # Assessment questions & Master question bank
    "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS passage_text TEXT;",
    "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS dataset_json JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS passage_text TEXT;",
    "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS dataset_json JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE master_question_bank ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb;",
    "CREATE INDEX IF NOT EXISTS ix_interview_sessions_candidate_id ON interview_sessions(candidate_id);",
    "CREATE INDEX IF NOT EXISTS ix_interview_sessions_job_id ON interview_sessions(job_id);",
    "CREATE INDEX IF NOT EXISTS ix_interview_sessions_job_application_id ON interview_sessions(job_application_id);",
    "CREATE INDEX IF NOT EXISTS ix_interview_questions_session_id ON interview_questions(session_id);",
    "CREATE INDEX IF NOT EXISTS ix_interview_answers_question_id ON interview_answers(question_id);",
    "CREATE INDEX IF NOT EXISTS ix_scoring_reports_session_id ON scoring_reports(session_id);",
    "ALTER TABLE interview_questions ALTER COLUMN category TYPE VARCHAR(255);",
    "ALTER TABLE interview_questions ALTER COLUMN difficulty TYPE VARCHAR(100);",
    "ALTER TABLE speech_analysis ALTER COLUMN tone TYPE VARCHAR(255);",
    "ALTER TABLE emotion_analysis ALTER COLUMN dominant_emotion TYPE VARCHAR(100);"
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

    # Seed baseline Logical Reasoning questions if pool is low
    try:
        from app.services.duplicate_detector import duplicate_detector
        import json as _json
        import uuid as _uuid
        async with engine.begin() as conn:
            cnt_res = await conn.execute(text("SELECT COUNT(*) FROM master_question_bank WHERE topic = 'Logical Reasoning'"))
            lr_cnt = cnt_res.scalar() or 0
            if lr_cnt < 12:
                seed_lr_items = [
                    ("Look at this number sequence: 2, 1, (1/2), (1/4), ... What number should come next?",
                     ["(1/8)", "(1/16)", "(2/8)", "(1/10)"], 0,
                     "Each number is half of the previous number: (1/4) * (1/2) = 1/8."),
                    ("SCD, TEF, UGH, ____, WKL. Which group of letters should fill the blank?",
                     ["VIJ", "VJI", "UJI", "IJT"], 0,
                     "The first letters are in alphabetical order: S, T, U, V, W. The second and third letters are CD, EF, GH, IJ, KL."),
                    ("A person walks 5 km North, turns right and walks 3 km, then turns right again and walks 5 km. In which direction is he from the starting point?",
                     ["East", "West", "North", "South"], 0,
                     "The North and South movements cancel each other out, leaving him 3 km East of the starting point."),
                    ("A is B's sister. C is B's mother. D is C's father. E is D's mother. How is A related to D?",
                     ["Granddaughter", "Grandmother", "Daughter", "Grandson"], 0,
                     "A is the daughter of C, and C is the daughter of D. Therefore, A is the granddaughter of D."),
                    ("Five colleagues (P, Q, R, S, T) sit in a row facing North. R sits to the immediate right of Q. P sits to the left of S but to the right of T. If Q sits in the middle, who sits on the extreme right?",
                     ["S", "P", "R", "T"], 0,
                     "Arrangement from left to right: T, P, Q, R, S. Therefore, S is at the extreme right."),
                    ("Architect : Building :: Sculptor : ?",
                     ["Statue", "Museum", "Stone", "Chisel"], 0,
                     "An architect designs a building; a sculptor creates a statue."),
                    ("Statements: Some actors are singers. All singers are dancers. Conclusions: I. Some actors are dancers. II. No singer is an actor.",
                     ["Only Conclusion I follows", "Only Conclusion II follows", "Both follow", "Neither follows"], 0,
                     "Since all singers are dancers and some actors are singers, the intersection guarantees some actors are dancers."),
                    ("In a code language, if MONKEY is written as XDJMNL, how is TIGER written in that code?",
                     ["QDFHS", "SDFHQ", "UJHFS", "SHFDQ"], 0,
                     "Each letter is shifted back by 1 and written in reverse order: T->S, I->H, G->F, E->D, R->Q -> reversed: QDFHS.")
                ]
                for q_text, opts, c_opt, expl in seed_lr_items:
                    fp = duplicate_detector.compute_fingerprint(q_text)
                    ch = duplicate_detector.compute_concept_hash("Logical Reasoning", "Core Reasoning", "Analytical Deduction", "Medium")
                    q_id = f"seed_{_uuid.uuid4().hex[:12]}"
                    ins_sql = text("""
                        INSERT INTO master_question_bank 
                        (id, topic, subtopic, concept, difficulty, bloom_taxonomy, question_type, scenario_type, technology, tags, question_text, options, correct_option, explanation, created_by, question_fingerprint, concept_hash)
                        VALUES (:id, 'Logical Reasoning', 'Core Reasoning', 'Analytical Deduction', 'Medium', 'Analyze', 'MCQ', 'General Enterprise', 'General', '[]', :q_text, :opts, :c_opt, :expl, 'system_seed', :fp, :ch)
                        ON CONFLICT DO NOTHING;
                    """)
                    await conn.execute(ins_sql, {
                        "id": q_id,
                        "q_text": q_text,
                        "opts": _json.dumps(opts),
                        "c_opt": c_opt,
                        "expl": expl,
                        "fp": fp,
                        "ch": ch
                    })
    except Exception as e:
        logger.warning("MasterQuestionBank seed notice: %s", e)

    from app.core.db import dispose_engine
    await dispose_engine()
    print("[SUCCESS] DATABASE SCHEMA SYNCHRONIZED CLEANLY!")

if __name__ == "__main__":
    asyncio.run(sync_database_schema())
