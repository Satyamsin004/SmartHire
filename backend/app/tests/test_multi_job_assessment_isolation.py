import pytest
from datetime import datetime
from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, AssessmentSession, AssessmentResult
from app.services.recruitment_pipeline_service import RecruitmentPipelineService

@pytest.mark.asyncio
async def test_multi_job_assessment_isolation():
    """
    CRITICAL REGRESSION TEST:
    Verifies that when a single candidate applies to two different jobs
    (e.g., Zomato SDE Intern and Infosys Support Engineer), and only takes
    the online assessment for Job 1 (Zomato):
    1. Job 1 shows the completed assessment marks (e.g., 62.5%).
    2. Job 2 DOES NOT show Job 1's marks, session, or status (strictly None / Not Scheduled).
    3. Candidate is eligible for interview on Job 1, but NOT on Job 2.
    """
    async with AsyncSessionLocal() as db:
        # 1. Create Recruiter
        timestamp = datetime.utcnow().timestamp()
        rec_user = User(
            email=f"rec_isolation_{timestamp}@test.com",
            password_hash="dummy",
            role="recruiter",
            full_name="Abhay HR"
        )
        db.add(rec_user)
        await db.flush()

        rec = Recruiter(user_id=rec_user.id, company_name="Enterprise Hiring")
        db.add(rec)
        await db.flush()

        # 2. Create Two Different Jobs: Zomato SDE Intern & Infosys Support Engineer
        job_zomato = JobPosting(
            recruiter_id=rec.id,
            title="SDE Intern",
            company_name="Zomato",
            description="Software Engineer Internship",
            status="Open",
            required_skills=["Python", "FastAPI"]
        )
        job_infosys = JobPosting(
            recruiter_id=rec.id,
            title="Support Engineer",
            company_name="Infosys",
            description="L2/L3 Customer Support & IT Operations",
            status="Open",
            required_skills=["Networking", "Linux"]
        )
        db.add_all([job_zomato, job_infosys])
        await db.flush()

        # 3. Create Candidate: Somesh Singh
        cand_user = User(
            email=f"somesh_{timestamp}@test.com",
            password_hash="dummy",
            role="candidate",
            full_name="Somesh Singh"
        )
        db.add(cand_user)
        await db.flush()

        cand = Candidate(
            user_id=cand_user.id,
            target_role="Software Engineer",
            experience_level="Entry"
        )
        db.add(cand)
        await db.flush()

        # 4. Candidate applies to BOTH jobs
        app_zomato = JobApplication(
            job_id=job_zomato.id,
            candidate_id=cand.id,
            ats_score=100.0,
            status="ATS Passed"
        )
        app_infosys = JobApplication(
            job_id=job_infosys.id,
            candidate_id=cand.id,
            ats_score=100.0,
            status="ATS Passed"
        )
        db.add_all([app_zomato, app_infosys])
        await db.flush()

        # 5. Online Assessment is scheduled ONLY for Zomato SDE Intern
        session_zomato = AssessmentSession(
            candidate_id=cand.id,
            recruiter_id=rec.id,
            job_id=job_zomato.id,
            job_application_id=app_zomato.id,
            title="Zomato SDE Intern - Online Assessment",
            topics=["Python", "Algorithms"],
            difficulty="Medium",
            question_count=4,
            duration_minutes=30,
            passing_score=50.0,
            is_recruiter_configured=True,
            status="completed"
        )
        db.add(session_zomato)
        await db.flush()

        # Somesh attends and scores 62.5% on Zomato's assessment
        result_zomato = AssessmentResult(
            session_id=session_zomato.id,
            candidate_id=cand.id,
            overall_score=62.5,
            total_correct=5,
            total_wrong=3,
            total_skipped=0,
            section_scores={"Technical": 62.5},
            weak_areas=["System Design"],
            strong_areas=["Python"],
            improvement_suggestions=["Practice more algorithms"],
            hiring_recommendation="Pass"
        )
        db.add(result_zomato)
        app_zomato.status = "Tech Passed"

        # Infosys application is rejected at technical stage, NO assessment was ever taken for Infosys
        app_infosys.status = "Rejected"
        await db.commit()

        # 6. Query Applications through RecruitmentPipelineService
        all_apps = await RecruitmentPipelineService.get_applications(db, rec_user.id)
        zomato_card = next((a for a in all_apps if a["id"] == app_zomato.id), None)
        infosys_card = next((a for a in all_apps if a["id"] == app_infosys.id), None)

        assert zomato_card is not None, "Zomato application should exist in pipeline"
        assert infosys_card is not None, "Infosys application should exist in pipeline"

        # VERIFY ZOMATO APPLICATION HAS ASSESSMENT DATA
        assert zomato_card["assessment_score"] == 62.5
        assert zomato_card["assessment_passed"] is True
        assert zomato_card["recruiter_assessment"] is not None
        assert zomato_card["recruiter_assessment"]["score"] == 62.5
        assert zomato_card["recruiter_assessment"]["status"] == "Passed"

        # VERIFY INFOSYS APPLICATION DOES NOT CONTAIN ZOMATO'S ASSESSMENT DATA
        assert infosys_card["assessment_score"] is None, (
            f"Expected Infosys assessment_score to be None, but got {infosys_card['assessment_score']}"
        )
        assert infosys_card["recruiter_assessment"] is None, (
            f"Expected Infosys recruiter_assessment to be None, but got {infosys_card['recruiter_assessment']}"
        )
        assert infosys_card["assessment_passed"] is False, (
            "Infosys assessment_passed must be False"
        )

        # 7. VERIFY INTERVIEW SCHEDULER ELIGIBILITY IS ISOLATED
        eligible_zomato = await RecruitmentPipelineService.get_eligible_candidates_for_interview_scheduler(
            db, rec_user.id, job_zomato.id
        )
        eligible_infosys = await RecruitmentPipelineService.get_eligible_candidates_for_interview_scheduler(
            db, rec_user.id, job_infosys.id
        )

        zomato_candidate_ids = [c["candidate_id"] for c in eligible_zomato]
        infosys_candidate_ids = [c["candidate_id"] for c in eligible_infosys]

        assert cand.id in zomato_candidate_ids, "Candidate should be eligible for Zomato interview"
        assert cand.id not in infosys_candidate_ids, "Candidate must NOT be eligible for Infosys interview"
