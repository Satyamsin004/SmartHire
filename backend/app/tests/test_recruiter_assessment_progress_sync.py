import pytest
from datetime import datetime
from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, AssessmentSession, AssessmentResult
from app.services.recruitment_pipeline_service import RecruitmentPipelineService

@pytest.mark.asyncio
async def test_recruiter_assessment_pass_and_fail_progress_sync():
    """
    Verifies that when an online assessment is completed:
    1. Candidate with score >= passing_score gets 'Assessment Passed'
    2. Recruiter applications list returns recruiter_assessment with passing_score, is_passed=True, and score
    3. Candidate becomes eligible for Technical Interview scheduling
    4. Candidate with score < passing_score gets 'Assessment Failed' and is marked Failed
    """
    async with AsyncSessionLocal() as db_session:
        # 1. Create Recruiter & Job
        rec_user = User(email=f"rec_{datetime.utcnow().timestamp()}@test.com", password_hash="dummy", role="recruiter", full_name="Recruiter Manager")
        db_session.add(rec_user)
        await db_session.flush()

        rec = Recruiter(user_id=rec_user.id, company_name="Zomato")
        db_session.add(rec)
        await db_session.flush()

        job = JobPosting(
            recruiter_id=rec.id,
            title="SDE intern",
            company_name="Zomato",
            description="Software Engineering Internship role",
            status="Open",
            required_skills=["Python", "FastAPI"]
        )
        db_session.add(job)
        await db_session.flush()

        # 2. Create Passing Candidate & Application
        cand_user_pass = User(email=f"cand_pass_{datetime.utcnow().timestamp()}@test.com", password_hash="dummy", role="candidate", full_name="Satyam Kumar")
        db_session.add(cand_user_pass)
        await db_session.flush()

        cand_pass = Candidate(user_id=cand_user_pass.id, target_role="SDE intern", experience_level="Entry")
        db_session.add(cand_pass)
        await db_session.flush()

        app_pass = JobApplication(
            job_id=job.id,
            candidate_id=cand_pass.id,
            ats_score=100.0,
            status="ATS Passed"
        )
        db_session.add(app_pass)
        await db_session.flush()

        # Recruiter schedules assessment with passing_score=40.0
        session_pass = AssessmentSession(
            candidate_id=cand_pass.id,
            recruiter_id=rec.id,
            job_id=job.id,
            job_application_id=app_pass.id,
            title="SDE intern - Online Assessment",
            topics=["Python", "Data Structures"],
            difficulty="Medium",
            question_count=2,
            duration_minutes=30,
            passing_score=40.0,
            is_recruiter_configured=True,
            status="scheduled"
        )
        db_session.add(session_pass)
        app_pass.status = "Assessment Scheduled"
        await db_session.flush()

        # 3. Simulate Candidate Attending & Scoring 50.0% (Passed >= 40.0%)
        res_pass = AssessmentResult(
            session_id=session_pass.id,
            candidate_id=cand_pass.id,
            overall_score=50.0,
            total_correct=1,
            total_wrong=1,
            total_skipped=0,
            section_scores={"Technical": 50.0},
            weak_areas=["Data Structures"],
            strong_areas=["Python"],
            improvement_suggestions=["Review trees"],
            hiring_recommendation="Pass"
        )
        db_session.add(res_pass)
        session_pass.status = "completed"
        app_pass.status = "Assessment Passed"
        await db_session.commit()

        # 4. Verify RecruitmentPipelineService.get_applications returns accurate assessment data
        apps_data = await RecruitmentPipelineService.get_applications(db_session, rec_user.id, job_id=job.id)
        matched_app = next((a for a in apps_data if a["id"] == app_pass.id), None)
        assert matched_app is not None
        assert matched_app["status"] == "Assessment Passed"
        assert matched_app["assessment_score"] == 50.0
        assert matched_app["assessment_passed"] is True
        assert matched_app["recruiter_assessment"] is not None
        assert matched_app["recruiter_assessment"]["status"] == "Passed"
        assert matched_app["recruiter_assessment"]["score"] == 50.0
        assert matched_app["recruiter_assessment"]["passing_score"] == 40.0
        assert matched_app["recruiter_assessment"]["is_passed"] is True

        # 5. Verify Candidate is now eligible for Interview Scheduling (Stage 4)
        eligible_cands = await RecruitmentPipelineService.get_eligible_candidates_for_interview_scheduler(db_session, rec_user.id, job.id)
        cand_ids = [c["candidate_id"] for c in eligible_cands]
        assert cand_pass.id in cand_ids

        # 6. Test Failing Candidate Workflow (Score 30% < 40% cutoff)
        cand_user_fail = User(email=f"cand_fail_{datetime.utcnow().timestamp()}@test.com", password_hash="dummy", role="candidate", full_name="Failing Candidate")
        db_session.add(cand_user_fail)
        await db_session.flush()

        cand_fail = Candidate(user_id=cand_user_fail.id, target_role="SDE intern", experience_level="Entry")
        db_session.add(cand_fail)
        await db_session.flush()

        app_fail = JobApplication(
            job_id=job.id,
            candidate_id=cand_fail.id,
            ats_score=85.0,
            status="Assessment Scheduled"
        )
        db_session.add(app_fail)
        await db_session.flush()

        session_fail = AssessmentSession(
            candidate_id=cand_fail.id,
            recruiter_id=rec.id,
            job_id=job.id,
            job_application_id=app_fail.id,
            title="SDE intern - Online Assessment",
            topics=["Python"],
            passing_score=40.0,
            is_recruiter_configured=True,
            status="scheduled"
        )
        db_session.add(session_fail)
        await db_session.flush()

        res_fail = AssessmentResult(
            session_id=session_fail.id,
            candidate_id=cand_fail.id,
            overall_score=30.0,
            total_correct=0,
            total_wrong=2,
            total_skipped=0,
            section_scores={"Technical": 0.0},
            weak_areas=["Python"],
            strong_areas=[],
            improvement_suggestions=["Improve Python basics"],
            hiring_recommendation="Fail"
        )
        db_session.add(res_fail)
        session_fail.status = "completed"
        app_fail.status = "Assessment Failed"
        await db_session.commit()

        # Invalidate in-memory cache since direct ORM test inserts bypass API mutation handlers
        from app.core.cache import fast_cache
        fast_cache.clear()

        # Verify failing candidate in recruiter applications
        apps_data_2 = await RecruitmentPipelineService.get_applications(db_session, rec_user.id, job_id=job.id)
        matched_app_fail = next((a for a in apps_data_2 if a["id"] == app_fail.id), None)
        assert matched_app_fail is not None
        assert matched_app_fail["status"] == "Assessment Failed"
        assert matched_app_fail["assessment_score"] == 30.0
        assert matched_app_fail["assessment_passed"] is False
        assert matched_app_fail["recruiter_assessment"]["status"] == "Failed"
        assert matched_app_fail["recruiter_assessment"]["is_passed"] is False

        # Verify failing candidate is NOT eligible for Technical Interview
        eligible_cands_2 = await RecruitmentPipelineService.get_eligible_candidates_for_interview_scheduler(db_session, rec_user.id, job.id)
        cand_ids_2 = [c["candidate_id"] for c in eligible_cands_2]
        assert cand_fail.id not in cand_ids_2
