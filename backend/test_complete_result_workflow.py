import asyncio
import os
import uuid
import time
from datetime import datetime
from sqlalchemy.future import select

from app.core.db import AsyncSessionLocal
from app.models.domain import (
    User, Candidate, Recruiter, JobPosting, JobApplication,
    InterviewSession, InterviewQuestion, InterviewAnswer,
    SpeechAnalysis, EyeTracking, EmotionAnalysis, ScoringReport,
    ScheduledInterview, Resume, ResumeSkill
)
from app.services.ai_engine import ai_engine
from app.services.speech_service import speech_service
from app.services.scoring_engine import scoring_engine
from app.services.interview_service import (
    PipelineManager, QuestionGeneratorService, EvaluationService
)
from app.api.v1.interview import get_interview_history, get_session_report

async def run_complete_result_workflow_verification():
    async with AsyncSessionLocal() as db:
        print("\n================================================================================")
        print("SMARTHIRE AI — END-TO-END INTERVIEW RESULT WORKFLOW VERIFICATION SUITE")
        print("================================================================================\n")

        # =========================================================================
        # WORKFLOW 1: MOCK INTERVIEW WORKFLOW
        # =========================================================================
        print("--------------------------------------------------------------------------------")
        print("[WORKFLOW 1/2] EXECUTING MOCK INTERVIEW WORKFLOW VERIFICATION...")
        print("--------------------------------------------------------------------------------")

        # 1. Provision Candidate User & Profile
        mock_user_id = f"test-usr-mock-{uuid.uuid4().hex[:8]}"
        mock_user = User(
            id=mock_user_id,
            email=f"mock_cand_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="hashed_secret_123",
            full_name="Jordan Vance",
            role="candidate",
            is_active=True
        )
        db.add(mock_user)
        await db.flush()

        mock_cand = Candidate(
            id=f"cand-mock-{uuid.uuid4().hex[:8]}",
            user_id=mock_user.id,
            headline="Full Stack Software Engineer",
            experience_level="4 years"
        )
        db.add(mock_cand)
        await db.flush()

        # 2. Upload & Store Candidate Resume in PostgreSQL
        mock_resume = Resume(
            candidate_id=mock_cand.id,
            file_name="jordan_vance_resume.pdf",
            file_path="/uploads/resumes/jordan_vance_resume.pdf",
            raw_text="Jordan Vance - Full Stack Developer skilled in React, Python, FastAPI, and PostgreSQL.",
            summary="Full Stack Developer with 4 years of experience building web applications.",
            ats_score=88.0,
            projects=["Enterprise Analytics Portal", "Real-Time Chat Engine"],
            experience_years="4 years",
            education_level="Bachelor of Science in CS"
        )
        db.add(mock_resume)
        await db.flush()
        for sk in ["React", "Python", "FastAPI", "PostgreSQL", "System Design"]:
            db.add(ResumeSkill(resume_id=mock_resume.id, skill_name=sk, category="Technical"))
        await db.flush()
        print(" -> Candidate Profile & Resume Persisted to PostgreSQL [OK]")

        # 3. Candidate Starts Configurable Mock Interview Session
        mock_sess_id = f"sess-mock-{uuid.uuid4().hex[:8]}"
        mock_session = InterviewSession(
            id=mock_sess_id,
            candidate_id=mock_cand.id,
            title="Frontend System Design & Architecture Practice",
            role_target="Senior Frontend Developer",
            round_type="Technical",
            interview_type="Mock",
            difficulty="Medium",
            duration_minutes=15,
            question_count=4,
            status="in_progress",
            config_json={
                "context_payload": {
                    "role": "Senior Frontend Developer",
                    "round_type": "Technical",
                    "difficulty": "Medium",
                    "resume_summary": mock_resume.summary,
                    "resume_skills": ["React", "Python", "FastAPI", "PostgreSQL"],
                    "resume_projects": mock_resume.projects,
                    "job_description": "Not Applicable (Mock Practice)"
                }
            }
        )
        db.add(mock_session)
        await db.flush()
        print(f" -> Mock Interview Session Started (ID: {mock_sess_id}) [OK]")

        # 4. Generate First Question via Gemini & Store Question 1
        q1_data = await ai_engine.generate_interview_questions(mock_session.config_json["context_payload"], num_questions=1)
        q1_obj = q1_data[0]
        q1_db = InterviewQuestion(
            session_id=mock_sess_id,
            order_index=1,
            question_text=q1_obj["question_text"],
            category=q1_obj.get("category", "Frontend Architecture"),
            difficulty="Medium",
            expected_keywords=["React", "State Management", "Virtual DOM"],
            is_followup=False
        )
        db.add(q1_db)
        await db.flush()
        print(f" -> Gemini Generated Q1: '{q1_db.question_text[:70]}...' [OK]")

        # 5. Candidate Answers Q1 & Generates Contextual Follow-up (Q2)
        ans1_text = "I build modular React components using custom hooks for state management and leverage virtual DOM memoization to optimize re-renders."
        a1_db = InterviewAnswer(question_id=q1_db.id, transcript_text=ans1_text)
        db.add(a1_db)
        await db.flush()
        db.add(SpeechAnalysis(answer_id=a1_db.id, speaking_pace_wpm=140.0, filler_word_count=0))
        db.add(EyeTracking(answer_id=a1_db.id, eye_contact_percentage=93.0, attention_score=95.0))
        db.add(EmotionAnalysis(answer_id=a1_db.id, dominant_emotion="Neutral", confidence_percentage=90.0))
        await db.flush()

        followup_context = {
            **mock_session.config_json["context_payload"],
            "conversation_memory": [{"question": q1_db.question_text, "answer": ans1_text}],
            "previously_asked_questions": [q1_db.question_text],
            "previous_question": q1_db.question_text,
            "candidate_answer": ans1_text
        }
        q2_data = await QuestionGeneratorService.generate_dynamic_followup_question(followup_context)
        q2_db = InterviewQuestion(
            session_id=mock_sess_id,
            order_index=2,
            question_text=q2_data["question_text"],
            category=q2_data.get("category", "Deep Dive"),
            difficulty="Adaptive",
            expected_keywords=q2_data.get("expected_keywords", ["hooks", "memoization"]),
            is_followup=True
        )
        db.add(q2_db)
        await db.flush()
        print(f" -> Contextual Follow-up Q2 Generated: '{q2_db.question_text[:70]}...' [OK]")

        ans2_text = "To prevent unnecessary re-renders, I use useMemo and useCallback for expensive calculations, and split global context into granular sub-stores."
        a2_db = InterviewAnswer(question_id=q2_db.id, transcript_text=ans2_text)
        db.add(a2_db)
        await db.flush()

        # 6. Mock Interview Completes & Generates AI Evaluation Report
        mock_session.status = "completed"
        await db.commit()

        mock_report = await EvaluationService.generate_and_finalize_report(db, mock_sess_id)
        assert mock_report is not None, "Evaluation Report MUST be created for Mock Interview"
        assert mock_report.overall_score > 0, "Evaluation score MUST be non-zero"
        print(f" -> AI Evaluation Report Generated: Overall Score {mock_report.overall_score}% | Rubric: {mock_report.recommendation} [OK]")

        # 7. Verify Candidate AI Feedback Card Creation & History Lookup
        history_mock = await get_interview_history(candidate_id=mock_cand.id, current_user=mock_user, db=db)
        assert len(history_mock) >= 1, "Candidate history MUST contain the completed mock interview!"
        card = history_mock[0]
        assert card["session_id"] == mock_sess_id, "Card session_id MUST match mock session!"
        assert card["score"] == round(mock_report.overall_score, 1), "Card score MUST match evaluation score!"
        assert card["interview_type"] == "Mock", "Interview type MUST be 'Mock'!"
        print(f" -> AI Feedback Card Created & Verified in Candidate History [OK]")

        # 8. Verify Report Details Lookup for Mock Session
        rep_view = await get_session_report(session_id=mock_sess_id, current_user=mock_user, db=db)
        assert rep_view["overall_score"] == mock_report.overall_score, "Detailed report overall_score MUST match DB report!"
        assert len(rep_view["strengths"]) > 0, "Report MUST contain key strengths!"
        print(" -> Detailed Report Endpoint Verified for Mock Session [OK]")


        # =========================================================================
        # WORKFLOW 2: RECRUITER SCHEDULED INTERVIEW WORKFLOW
        # =========================================================================
        print("\n--------------------------------------------------------------------------------")
        print("[WORKFLOW 2/2] EXECUTING RECRUITER SCHEDULED INTERVIEW WORKFLOW VERIFICATION...")
        print("--------------------------------------------------------------------------------")

        # 1. Provision Recruiter User & Job Requisition
        rec_user_id = f"test-usr-rec2-{uuid.uuid4().hex[:8]}"
        rec_user = User(
            id=rec_user_id,
            email=f"recruiter_lead_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="rec_secret_hash_456",
            full_name="Samantha Sterling",
            role="recruiter",
            is_active=True
        )
        db.add(rec_user)
        await db.flush()

        recruiter = Recruiter(
            id=f"rec2-{uuid.uuid4().hex[:8]}",
            user_id=rec_user.id,
            company_name="SmartHire Enterprise Systems"
        )
        db.add(recruiter)
        await db.flush()

        job2 = JobPosting(
            id=f"job2-{uuid.uuid4().hex[:8]}",
            recruiter_id=recruiter.id,
            company_name=recruiter.company_name,
            title="Principal Backend Systems Architect",
            department="Cloud Engineering",
            employment_type="Full-Time",
            description="Seeking a Principal Systems Architect proficient in Python, FastAPI, PostgreSQL, Distributed Systems, and System Architecture.",
            required_skills=["Python", "FastAPI", "PostgreSQL", "System Architecture", "Distributed Systems"]
        )
        db.add(job2)
        await db.flush()

        # 2. Candidate Submits Job Application
        app2 = JobApplication(
            id=f"app2-{uuid.uuid4().hex[:8]}",
            job_id=job2.id,
            candidate_id=mock_cand.id,
            resume_id=mock_resume.id,
            status="Shortlisted",
            ats_score=92.0
        )
        db.add(app2)
        await db.flush()
        print(f" -> Job Application Created for Requisition '{job2.title}' [OK]")

        # 3. Recruiter Schedules Official Technical Interview Round
        sched2 = ScheduledInterview(
            id=f"sched2-{uuid.uuid4().hex[:8]}",
            candidate_id=mock_cand.id,
            recruiter_id=recruiter.id,
            job_application_id=app2.id,
            job_id=job2.id,
            resume_id=mock_resume.id,
            round_type="Technical",
            scheduled_date=datetime.utcnow(),
            duration_minutes=30,
            difficulty="Hard",
            status="Scheduled"
        )
        db.add(sched2)
        await db.flush()
        await PipelineManager.update_pipeline_stage(db, mock_cand.id, "Interview Scheduled", job_id=job2.id)
        await db.commit()
        print(f" -> Recruiter Scheduled Technical Round (ID: {sched2.id}) [OK]")

        # 4. Candidate Joins Official Interview (Session Auto-Populates from Requisition & Resume)
        rec_sess_id = f"sess-rec-{uuid.uuid4().hex[:8]}"
        rec_session = InterviewSession(
            id=rec_sess_id,
            candidate_id=mock_cand.id,
            recruiter_id=recruiter.id,
            job_application_id=app2.id,
            job_id=job2.id,
            resume_id=mock_resume.id,
            scheduled_interview_id=sched2.id,
            title=f"Technical Interview - {job2.title}",
            role_target=job2.title,
            round_type="Technical",
            interview_type="Recruiter",
            difficulty="Hard",
            duration_minutes=30,
            question_count=6,
            status="in_progress",
            config_json={
                "context_payload": {
                    "role": job2.title,
                    "round_type": "Technical",
                    "difficulty": "Hard",
                    "resume_summary": mock_resume.summary,
                    "resume_skills": ["Python", "FastAPI", "PostgreSQL", "Distributed Systems"],
                    "resume_projects": mock_resume.projects,
                    "job_description": job2.description
                }
            }
        )
        db.add(rec_session)
        sched2.session_id = rec_sess_id
        sched2.status = "In Progress"
        await db.flush()
        print(f" -> Official Candidate Interview Session Started (ID: {rec_sess_id}) [OK]")

        # 5. Gemini Asks System Architecture Question & Candidate Responds
        rq1_data = await ai_engine.generate_interview_questions(rec_session.config_json["context_payload"], num_questions=1)
        rq1_obj = rq1_data[0]
        rq1_db = InterviewQuestion(
            session_id=rec_sess_id,
            order_index=1,
            question_text=rq1_obj["question_text"],
            category="System Architecture",
            difficulty="Hard",
            expected_keywords=["FastAPI", "PostgreSQL", "Concurrency", "Scaling"],
            is_followup=False
        )
        db.add(rq1_db)
        await db.flush()

        rans1_text = "I architected distributed FastAPI backend services with asynchronous PostgreSQL connection pools and implemented database read-replicas for high-concurrency scaling."
        ra1_db = InterviewAnswer(question_id=rq1_db.id, transcript_text=rans1_text)
        db.add(ra1_db)
        await db.flush()
        db.add(SpeechAnalysis(answer_id=ra1_db.id, speaking_pace_wpm=138.0, filler_word_count=0))
        db.add(EyeTracking(answer_id=ra1_db.id, eye_contact_percentage=95.0, attention_score=98.0))
        db.add(EmotionAnalysis(answer_id=ra1_db.id, dominant_emotion="Neutral", confidence_percentage=94.0))
        await db.flush()

        # 6. Official Recruiter Interview Completes
        rec_session.status = "completed"
        sched2.status = "Completed"
        await db.commit()

        # 7. Finalize Evaluation & Pipeline Update
        rec_report = await EvaluationService.generate_and_finalize_report(db, rec_sess_id)
        assert rec_report is not None, "Evaluation Report MUST be created for Recruiter Interview"
        assert rec_report.overall_score > 0, "Evaluation score MUST be non-zero"
        print(f" -> AI Evaluation Report Finalized: Overall Score {rec_report.overall_score}% | Hiring Recommendation: {rec_report.recommendation} [OK]")

        # 8. Verify Application Pipeline Auto-Advanced to 'Evaluation Generated'
        res_app_check = await db.execute(select(JobApplication).where(JobApplication.id == app2.id))
        updated_app = res_app_check.scalar_one()
        assert updated_app.status == "Evaluation Generated", f"Pipeline status must advance to 'Evaluation Generated', got '{updated_app.status}'"
        print(f" -> Job Application Pipeline Status Auto-Advanced to: '{updated_app.status}' [OK]")

        # 9. Verify Candidate AI Feedback Card Created for Recruiter Interview
        history_rec = await get_interview_history(candidate_id=mock_cand.id, current_user=mock_user, db=db)
        assert len(history_rec) >= 2, "Candidate history MUST contain both Mock and Recruiter interview cards!"
        rec_card = [c for c in history_rec if c["session_id"] == rec_sess_id][0]
        assert rec_card["interview_type"] == "Recruiter", "Card type MUST be 'Recruiter'!"
        assert rec_card["score"] == round(rec_report.overall_score, 1), "Card score MUST match recruiter report!"
        print(f" -> Recruiter Interview AI Feedback Card Persisted to Candidate Dashboard [OK]")

        # 10. Verify Recruiter Dashboard Receives Full Evaluation Report & PDF Download Data
        rec_rep_view = await get_session_report(session_id=rec_sess_id, current_user=rec_user, db=db)
        assert rec_rep_view["overall_score"] == rec_report.overall_score, "Recruiter report overall_score MUST match candidate report!"
        assert rec_rep_view["technical_score"] == rec_report.technical_score, "Technical scores MUST match!"
        assert rec_rep_view["communication_score"] == rec_report.communication_score, "Communication scores MUST match!"
        assert rec_rep_view["recommendation"] == rec_report.recommendation, "Hiring recommendations MUST match!"
        print(" -> Recruiter Dashboard Received Full Matching Technical Evaluation & Scores [OK]")

        print("\n================================================================================")
        print("OVERALL VERIFICATION STATUS: PASSED (100% SUCCESS ACROSS BOTH WORKFLOWS)")
        print("================================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_complete_result_workflow_verification())
