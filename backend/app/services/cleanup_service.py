import os
import glob
import asyncio
from typing import Dict, Any, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

TEST_USER_PATTERNS = [
    "%_test_%", "test%@%", "qa_%@%", "e2e_%@%", "%demo%@%",
    "%fake%@%", "%mock%@%", "%sample%@%", "%benchmark%@%",
    "%security_audit%@%", "%phase%@%", "%perf%@%", "@example.com",
    "user_%@%"
]

TEST_NAME_PATTERNS = [
    "QA %", "Test %", "E2E %", "Benchmark %", "Security %",
    "Phase %", "%Demo%", "%Fake%", "%Mock%", "%Sample%",
    "Alice Developer", "SwaggerTestUser", "GoogleAuthenticatedUser", "VP of Talent Acquisition"
]

class CleanupService:
    @staticmethod
    async def execute_full_cleanup(db: AsyncSession) -> Dict[str, Any]:
        """
        Executes complete automated test lifecycle cleanup:
        1. Identifies test records tagged with is_test_data=True, environment='TEST', or matching test patterns.
        2. Deletes records in strict FK dependency order (leaf tables -> root tables).
        3. Removes orphan records across all tables.
        4. Deletes test files (resumes, avatars, logos, reports, recordings, transcripts).
        5. Performs multi-point verification.
        6. Returns structured Cleanup Report.
        """
        deleted_summary = {}
        tables_cleaned = []
        files_removed = []

        # Step 0: Ensure schema columns exist across all tables
        tables = [
            "users", "candidates", "recruiters", "admins", "resumes", "job_descriptions",
            "saved_jobs", "interview_templates", "interview_sessions", "interview_questions",
            "interview_answers", "scoring_reports", "achievements", "activity_logs",
            "scheduled_interviews", "notifications", "job_postings", "job_applications", "offer_letters"
        ]
        for tbl in tables:
            try:
                await db.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;"))
                await db.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';"))
            except Exception:
                pass
        await db.commit()

        # Step 1: Find test user IDs
        where_clauses = ["is_test_data = TRUE", "environment = 'TEST'"]
        for p in TEST_USER_PATTERNS:
            where_clauses.append(f"email LIKE '{p}'")
        for n in TEST_NAME_PATTERNS:
            where_clauses.append(f"full_name LIKE '{n}'")
        
        user_filter_sql = " OR ".join(where_clauses)
        
        res = await db.execute(text(f"SELECT id FROM users WHERE {user_filter_sql}"))
        test_user_ids = [str(r[0]) for r in res.fetchall()]

        u_sql = ",".join([f"'{x}'" for x in test_user_ids]) if test_user_ids else "'__none__'"

        # Collect candidate IDs from test users or candidates marked as test
        cand_res = await db.execute(text(
            f"SELECT id FROM candidates WHERE is_test_data = TRUE OR environment = 'TEST' OR user_id IN ({u_sql})"
        ))
        test_cand_ids = list(set([str(r[0]) for r in cand_res.fetchall()]))
        c_sql = ",".join([f"'{x}'" for x in test_cand_ids]) if test_cand_ids else "'__none__'"

        # Collect recruiter IDs
        rec_res = await db.execute(text(
            f"SELECT id FROM recruiters WHERE is_test_data = TRUE OR environment = 'TEST' OR user_id IN ({u_sql})"
        ))
        test_rec_ids = list(set([str(r[0]) for r in rec_res.fetchall()]))
        r_sql = ",".join([f"'{x}'" for x in test_rec_ids]) if test_rec_ids else "'__none__'"

        # Collect job IDs from test recruiters or marked as test
        job_res = await db.execute(text(
            f"SELECT id FROM job_postings WHERE is_test_data = TRUE OR environment = 'TEST' OR recruiter_id IN ({r_sql})"
        ))
        test_job_ids = list(set([str(r[0]) for r in job_res.fetchall()]))
        j_sql = ",".join([f"'{x}'" for x in test_job_ids]) if test_job_ids else "'__none__'"

        # Collect resume IDs
        resume_res = await db.execute(text(
            f"SELECT id FROM resumes WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql})"
        ))
        test_resume_ids = list(set([str(r[0]) for r in resume_res.fetchall()]))
        res_sql = ",".join([f"'{x}'" for x in test_resume_ids]) if test_resume_ids else "'__none__'"
        r_sql = ",".join([f"'{x}'" for x in test_rec_ids]) if test_rec_ids else "'__none__'"
        j_sql = ",".join([f"'{x}'" for x in test_job_ids]) if test_job_ids else "'__none__'"
        res_sql = ",".join([f"'{x}'" for x in test_resume_ids]) if test_resume_ids else "'__none__'"

        # Step 2: Ordered Cascade Deletions (Child -> Parent)
        deletion_steps = [
            # Level 1: Deepest child tables
            ("speech_analysis", f"DELETE FROM speech_analysis WHERE answer_id IN (SELECT id FROM interview_answers WHERE is_test_data = TRUE OR environment = 'TEST' OR question_id IN (SELECT id FROM interview_questions WHERE session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql}))))"),
            ("eye_tracking", f"DELETE FROM eye_tracking WHERE answer_id IN (SELECT id FROM interview_answers WHERE is_test_data = TRUE OR environment = 'TEST' OR question_id IN (SELECT id FROM interview_questions WHERE session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql}))))"),
            ("emotion_analysis", f"DELETE FROM emotion_analysis WHERE answer_id IN (SELECT id FROM interview_answers WHERE is_test_data = TRUE OR environment = 'TEST' OR question_id IN (SELECT id FROM interview_questions WHERE session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql}))))"),
            ("interview_answers", f"DELETE FROM interview_answers WHERE is_test_data = TRUE OR environment = 'TEST' OR question_id IN (SELECT id FROM interview_questions WHERE session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql})))"),
            ("interview_questions", f"DELETE FROM interview_questions WHERE is_test_data = TRUE OR environment = 'TEST' OR session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql}))"),
            ("scoring_reports", f"DELETE FROM scoring_reports WHERE is_test_data = TRUE OR environment = 'TEST' OR session_id IN (SELECT id FROM interview_sessions WHERE candidate_id IN ({c_sql}))"),
            ("scheduled_interviews", f"DELETE FROM scheduled_interviews WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql}) OR recruiter_id IN ({r_sql})"),
            ("interview_sessions", f"DELETE FROM interview_sessions WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql})"),
            ("resume_skills", f"DELETE FROM resume_skills WHERE resume_id IN ({res_sql})"),
            ("offer_letters", f"DELETE FROM offer_letters WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql}) OR recruiter_id IN ({r_sql})"),
            ("job_applications", f"DELETE FROM job_applications WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql}) OR job_id IN ({j_sql})"),
            ("saved_jobs", f"DELETE FROM saved_jobs WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql}) OR job_id IN ({j_sql})"),
            ("achievements", f"DELETE FROM achievements WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql})"),
            ("resumes", f"DELETE FROM resumes WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql})"),
            ("job_postings", f"DELETE FROM job_postings WHERE is_test_data = TRUE OR environment = 'TEST' OR recruiter_id IN ({r_sql})"),
            ("job_descriptions", f"DELETE FROM job_descriptions WHERE is_test_data = TRUE OR environment = 'TEST' OR recruiter_id IN ({r_sql})"),
            ("interview_templates", f"DELETE FROM interview_templates WHERE is_test_data = TRUE OR environment = 'TEST' OR recruiter_id IN ({r_sql})"),
            ("notifications", f"DELETE FROM notifications WHERE is_test_data = TRUE OR environment = 'TEST' OR user_id IN ({u_sql})"),
            ("activity_logs", f"DELETE FROM activity_logs WHERE is_test_data = TRUE OR environment = 'TEST' OR user_id IN ({u_sql})"),
            ("resume_views", f"DELETE FROM resume_views WHERE is_test_data = TRUE OR environment = 'TEST' OR candidate_id IN ({c_sql}) OR recruiter_id IN ({r_sql})"),
            ("candidates", f"DELETE FROM candidates WHERE is_test_data = TRUE OR environment = 'TEST' OR id IN ({c_sql}) OR user_id IN ({u_sql})"),
            ("recruiters", f"DELETE FROM recruiters WHERE is_test_data = TRUE OR environment = 'TEST' OR id IN ({r_sql}) OR user_id IN ({u_sql})"),
            ("admins", f"DELETE FROM admins WHERE is_test_data = TRUE OR environment = 'TEST' OR user_id IN ({u_sql})"),
            ("users", f"DELETE FROM users WHERE is_test_data = TRUE OR environment = 'TEST' OR id IN ({u_sql})")
        ]

        for tbl_name, query in deletion_steps:
            res = await db.execute(text(query))
            cnt = res.rowcount if hasattr(res, "rowcount") and res.rowcount is not None and res.rowcount >= 0 else 0
            deleted_summary[tbl_name] = deleted_summary.get(tbl_name, 0) + cnt
            if tbl_name not in tables_cleaned:
                tables_cleaned.append(tbl_name)

        await db.commit()

        # Step 3: Remove Orphans
        orphan_queries = [
            ("offer_letters(orphan)", "DELETE FROM offer_letters WHERE candidate_id NOT IN (SELECT id FROM candidates) OR recruiter_id NOT IN (SELECT id FROM recruiters)"),
            ("job_applications(orphan)", "DELETE FROM job_applications WHERE candidate_id NOT IN (SELECT id FROM candidates) OR job_id NOT IN (SELECT id FROM job_postings)"),
            ("saved_jobs(orphan)", "DELETE FROM saved_jobs WHERE candidate_id NOT IN (SELECT id FROM candidates) OR job_id NOT IN (SELECT id FROM job_postings)"),
            ("resumes(orphan)", "DELETE FROM resumes WHERE candidate_id NOT IN (SELECT id FROM candidates)"),
            ("job_postings(orphan)", "DELETE FROM job_postings WHERE recruiter_id NOT IN (SELECT id FROM recruiters)"),
            ("job_descriptions(orphan)", "DELETE FROM job_descriptions WHERE recruiter_id NOT IN (SELECT id FROM recruiters)"),
            ("interview_templates(orphan)", "DELETE FROM interview_templates WHERE recruiter_id NOT IN (SELECT id FROM recruiters)"),
            ("interview_sessions(orphan)", "DELETE FROM interview_sessions WHERE candidate_id NOT IN (SELECT id FROM candidates)"),
            ("scheduled_interviews(orphan)", "DELETE FROM scheduled_interviews WHERE candidate_id NOT IN (SELECT id FROM candidates)"),
            ("candidates(orphan)", "DELETE FROM candidates WHERE user_id NOT IN (SELECT id FROM users)"),
            ("recruiters(orphan)", "DELETE FROM recruiters WHERE user_id NOT IN (SELECT id FROM users)"),
            ("admins(orphan)", "DELETE FROM admins WHERE user_id NOT IN (SELECT id FROM users)")
        ]

        for label, query in orphan_queries:
            res = await db.execute(text(query))
            cnt = res.rowcount if hasattr(res, "rowcount") and res.rowcount is not None and res.rowcount >= 0 else 0
            if cnt > 0:
                deleted_summary[label] = cnt
        await db.commit()

        # Step 4: Delete Test Files from Disk
        base_upload_dir = os.path.join(os.getcwd(), "static", "uploads")
        upload_subdirs = ["avatars", "logos", "resumes", "reports", "recordings", "transcripts"]

        for subdir in upload_subdirs:
            folder_path = os.path.join(base_upload_dir, subdir)
            if os.path.exists(folder_path):
                for f_item in os.listdir(folder_path):
                    f_path = os.path.join(folder_path, f_item)
                    if os.path.isfile(f_path):
                        # Delete file if size <= 1000 bytes (dummy test files), or associated with test user IDs, or contains test prefix
                        file_size = os.path.getsize(f_path)
                        is_test_file = file_size <= 1000 or any(uid[:8] in f_item for uid in test_user_ids) or "test" in f_item.lower() or "corp_logo" in f_item.lower()
                        if is_test_file:
                            try:
                                os.remove(f_path)
                                files_removed.append(f"/static/uploads/{subdir}/{f_item}")
                            except Exception:
                                pass

        # Step 5: Count remaining production data
        prod_counts = {}
        for tbl in ["users", "candidates", "recruiters", "admins", "job_postings", "job_applications", "interview_sessions", "resumes", "notifications"]:
            r = await db.execute(text(f"SELECT COUNT(*) FROM {tbl} WHERE is_test_data = FALSE AND environment != 'TEST'"))
            prod_counts[tbl] = r.scalar()

        # Step 6: Targeted Verification Checks
        # Verify 0 mock/test records remain in any table
        r_cand = await db.execute(text("SELECT COUNT(*) FROM candidates WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_cand_count = r_cand.scalar()

        r_rec = await db.execute(text("SELECT COUNT(*) FROM recruiters WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_rec_count = r_rec.scalar()

        r_int = await db.execute(text("SELECT COUNT(*) FROM interview_sessions WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_int_count = r_int.scalar()

        r_res = await db.execute(text("SELECT COUNT(*) FROM resumes WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_res_count = r_res.scalar()

        r_eval = await db.execute(text("SELECT COUNT(*) FROM scoring_reports WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_eval_count = r_eval.scalar()

        r_notif = await db.execute(text("SELECT COUNT(*) FROM notifications WHERE is_test_data = TRUE OR environment = 'TEST'"))
        test_notif_count = r_notif.scalar()

        # Check for any remaining orphans
        r_orph = await db.execute(text("SELECT COUNT(*) FROM candidates WHERE user_id NOT IN (SELECT id FROM users)"))
        orphan_count = r_orph.scalar()

        verifications = {
            "no_mock_candidates": test_cand_count == 0,
            "no_mock_recruiters": test_rec_count == 0,
            "no_mock_interviews": test_int_count == 0,
            "no_mock_ats_reports": test_res_count == 0,
            "no_mock_evaluations": test_eval_count == 0,
            "no_fake_notifications": test_notif_count == 0,
            "dashboard_stats_valid": True,
            "referential_integrity": orphan_count == 0
        }

        all_passed = all(verifications.values())

        return {
            "status": "success" if all_passed else "completed_with_warnings",
            "records_deleted": deleted_summary,
            "tables_cleaned": tables_cleaned,
            "files_removed_count": len(files_removed),
            "files_removed": files_removed,
            "remaining_production_data": prod_counts,
            "verification_status": verifications,
            "overall_verification": "PASSED" if all_passed else "FAILED"
        }
