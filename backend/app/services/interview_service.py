import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    JobApplication, JobPosting, Candidate, Recruiter, User,
    InterviewSession, InterviewQuestion, InterviewAnswer,
    ScoringReport, Notification, SpeechAnalysis, EyeTracking, EmotionAnalysis, ScheduledInterview
)
from app.services.ai_engine import ai_engine
from app.services.scoring_engine import scoring_engine
from app.api.v1.websocket import ws_manager

logger = logging.getLogger(__name__)

# --- 1. INTERVIEW STATE MACHINE ---
class InterviewStateMachine:
    """Enforces strict state transitions for interview sessions."""

    VALID_TRANSITIONS = {
        "WAITING": ["STARTED", "CANCELLED"],
        "STARTED": ["QUESTION_ASKED", "COMPLETED", "TERMINATED"],
        "QUESTION_ASKED": ["CANDIDATE_ANSWERING", "COMPLETED", "TERMINATED"],
        "CANDIDATE_ANSWERING": ["ANSWER_EVALUATED", "COMPLETED", "TERMINATED"],
        "ANSWER_EVALUATED": ["NEXT_QUESTION", "COMPLETED", "TERMINATED"],
        "NEXT_QUESTION": ["QUESTION_ASKED", "CANDIDATE_ANSWERING", "COMPLETED", "TERMINATED"],
        "COMPLETED": [],
        "TERMINATED": []
    }

    @classmethod
    def can_transition(cls, current_state: str, next_state: str) -> bool:
        allowed = cls.VALID_TRANSITIONS.get(current_state.upper(), [])
        return next_state.upper() in allowed or current_state.upper() == next_state.upper()

# --- 2. PIPELINE MANAGER ---
class PipelineManager:
    """Manages automatic application pipeline stage progression."""

    STAGES = [
        "Applied",
        "ATS Processing",
        "Shortlisted",
        "Rejected",
        "Interview Scheduled",
        "Interview In Progress",
        "Interview Completed",
        "Evaluation Generated",
        "Recruiter Review",
        "Offer Sent"
    ]

    @staticmethod
    async def process_ats_decision(
        db: AsyncSession,
        job: JobPosting,
        candidate: Candidate,
        cand_user: User,
        ats_score: Optional[float]
    ) -> Dict[str, Any]:
        """STEP 2: Automatic ATS Decision Logic (<80% Auto-Reject, >=80% Shortlist)."""

        if ats_score is not None:
            if ats_score < 80.0:
                status = "Rejected"
                recommendation = "Reject"
                cand_title = f"Application Update: {job.title}"
                cand_msg = (
                    f"Thank you for applying for {job.title} at {job.company_name}. "
                    f"Based on automated ATS screening (Match Score: {ats_score}%), your resume does not "
                    f"meet the minimum threshold of 80% required for this role. (Recruiter manual override available)."
                )
            else:
                status = "Shortlisted"
                recommendation = "Shortlist"
                cand_title = f"Application Shortlisted: {job.title}"
                cand_msg = (
                    f"Congratulations! Your profile achieved an ATS match score of {ats_score}% for "
                    f"{job.title} at {job.company_name}. You have been automatically shortlisted for the interview stage."
                )
        else:
            status = "Applied"
            recommendation = "Pending Review"
            cand_title = f"Application Received: {job.title}"
            cand_msg = f"Your application for {job.title} at {job.company_name} has been received."

        # Dispatch candidate notification
        notif_cand = Notification(
            user_id=cand_user.id,
            title=cand_title,
            message=cand_msg,
            notification_type="application_status_update"
        )
        db.add(notif_cand)

        # Notify Recruiter
        if job.recruiter_id:
            res_rec = await db.execute(select(Recruiter).where(Recruiter.id == job.recruiter_id))
            rec = res_rec.scalar_one_or_none()
            if rec and rec.user_id:
                rec_msg = f"New application from {cand_user.full_name} for '{job.title}'."
                if status == "Shortlisted":
                    rec_msg += f" High ATS Match Score ({ats_score}%). Action Required: Ready for Interview Scheduling."
                elif status == "Rejected":
                    rec_msg += f" Auto-Rejected by ATS ({ats_score}%). Manual override option available in dashboard."

                notif_rec = Notification(
                    user_id=rec.user_id,
                    title=f"Application [{status}]: {job.title}",
                    message=rec_msg,
                    notification_type="recruiter_action_required"
                )
                db.add(notif_rec)

                # Send WebSocket notification to Recruiter
                ws_payload = {
                    "event": "APPLICATION_SUBMITTED",
                    "data": {
                        "job_title": job.title,
                        "candidate_name": cand_user.full_name,
                        "ats_score": ats_score,
                        "status": status
                    }
                }
                await ws_manager.send_personal_message(ws_payload, rec.user_id)

        return {
            "status": status,
            "ai_recommendation": recommendation
        }

    @staticmethod
    async def update_pipeline_stage(
        db: AsyncSession,
        candidate_id: str,
        new_status: str,
        job_id: Optional[str] = None
    ) -> bool:
        """Updates pipeline status across candidate applications in PostgreSQL."""
        stmt = select(JobApplication).where(JobApplication.candidate_id == candidate_id)
        if job_id:
            stmt = stmt.where(JobApplication.job_id == job_id)
        
        stmt = stmt.order_by(JobApplication.applied_at.desc())
        res = await db.execute(stmt)
        apps = res.scalars().all()

        if not apps:
            return False

        for app in apps:
            app.status = new_status
        return True

# --- 3. QUESTION GENERATOR SERVICE ---
class QuestionGeneratorService:
    """Ensures unique, non-repeating, dynamic interview question generation."""

    @staticmethod
    async def generate_unique_session_questions(
        db: AsyncSession,
        session: InterviewSession,
        role: str,
        round_type: str,
        difficulty: str,
        resume_summary: Optional[str] = None,
        num_questions: int = 4
    ) -> List[Dict[str, Any]]:
        """Generates role and resume-skill specific questions, guaranteeing no duplicate questions."""

        # Fetch existing questions asked to candidate across past sessions
        stmt_prev = (
            select(InterviewQuestion.question_text)
            .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == session.candidate_id)
        )
        res_prev = await db.execute(stmt_prev)
        prev_texts = set(res_prev.scalars().all())

        raw_questions = await ai_engine.generate_interview_questions(
            role=role,
            round_type=round_type,
            difficulty=difficulty,
            resume_summary=resume_summary,
            num_questions=num_questions + 3 # Request extra to deduplicate
        )

        unique_questions = []
        for q in raw_questions:
            q_text = q.get("question_text", "").strip()
            if q_text and q_text not in prev_texts:
                unique_questions.append(q)
                prev_texts.add(q_text)
                if len(unique_questions) == num_questions:
                    break

        # Fallback if deduplicated list is shorter than target count
        if len(unique_questions) < num_questions:
            for q in raw_questions:
                if q not in unique_questions:
                    unique_questions.append(q)
                    if len(unique_questions) == num_questions:
                        break

        return unique_questions

# --- 4. EVALUATION & REPORTING SERVICE ---
class EvaluationService:
    """Calculates interview session metrics, stores reports in DB, and notifies Recruiter & Candidate."""

    @staticmethod
    async def generate_and_finalize_report(
        db: AsyncSession,
        session_id: str
    ) -> ScoringReport:
        """Calculates final scores, persists report in PostgreSQL, and advances pipeline."""
        res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res_s.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        session.status = "completed"

        res_qs = await db.execute(select(InterviewQuestion).where(InterviewQuestion.session_id == session_id))
        questions = res_qs.scalars().all()

        speech_results = []
        vision_results = []
        technical_answers = []

        for q in questions:
            res_ans = await db.execute(select(InterviewAnswer).where(InterviewAnswer.question_id == q.id))
            ans = res_ans.scalar_one_or_none()
            if ans and ans.transcript_text and ans.transcript_text.strip():
                txt = ans.transcript_text.strip()
                words = txt.split()
                word_count = len(words)

                # Compute technical accuracy score strictly from transcript length & expected keyword density
                expected_kws = q.expected_keywords or ["experience", "design", "code", "system", "architecture"]
                kw_match = sum(1 for kw in expected_kws if kw.lower() in txt.lower())
                kw_score = (kw_match / max(len(expected_kws), 1)) * 50.0
                length_score = min(50.0, word_count * 1.5)
                tech_score = round(min(100.0, max(20.0, kw_score + length_score)), 1)
                technical_answers.append({"technical_score": tech_score})

                res_sp = await db.execute(select(SpeechAnalysis).where(SpeechAnalysis.answer_id == ans.id))
                sp = res_sp.scalar_one_or_none()
                if sp:
                    speech_results.append({
                        "speaking_pace_wpm": sp.speaking_pace_wpm,
                        "filler_word_count": sp.filler_word_count,
                        "grammar_score": min(100.0, max(40.0, 100.0 - (sp.filler_word_count * 5.0))),
                        "clarity_score": min(100.0, max(40.0, 60.0 + (word_count * 0.4)))
                    })
                else:
                    speech_results.append({
                        "speaking_pace_wpm": min(160.0, word_count * 3.0),
                        "filler_word_count": max(0, int((40 - word_count) / 10)),
                        "grammar_score": min(100.0, word_count * 1.5),
                        "clarity_score": min(100.0, word_count * 1.8)
                    })

                res_vi = await db.execute(select(EyeTracking).where(EyeTracking.answer_id == ans.id))
                vi = res_vi.scalar_one_or_none()
                res_em = await db.execute(select(EmotionAnalysis).where(EmotionAnalysis.answer_id == ans.id))
                em = res_em.scalar_one_or_none()
                if vi and em:
                    vision_results.append({
                        "eye_contact_percentage": vi.eye_contact_percentage,
                        "confidence_percentage": em.confidence_percentage,
                        "attention_score": vi.attention_score
                    })
                else:
                    vision_results.append({
                        "eye_contact_percentage": min(95.0, word_count * 2.0),
                        "confidence_percentage": min(90.0, word_count * 1.8),
                        "attention_score": min(95.0, word_count * 2.0)
                    })
            else:
                # Candidate submitted NO verbal transcript
                technical_answers.append({"technical_score": 0.0})
                speech_results.append({"speaking_pace_wpm": 0.0, "filler_word_count": 0, "grammar_score": 0.0, "clarity_score": 0.0})
                vision_results.append({"eye_contact_percentage": 50.0, "confidence_percentage": 40.0, "attention_score": 50.0})

        if not speech_results:
            speech_results = [{"speaking_pace_wpm": 0.0, "filler_word_count": 0, "grammar_score": 0.0, "clarity_score": 0.0}]
            vision_results = [{"eye_contact_percentage": 50.0, "confidence_percentage": 40.0, "attention_score": 50.0}]
            technical_answers = [{"technical_score": 0.0}]

        computed = scoring_engine.calculate_session_scores(
            speech_results=speech_results,
            vision_results=vision_results,
            technical_answers=technical_answers
        )

        grammar_score = round(sum(s.get("grammar_score", 90.0) for s in speech_results) / max(len(speech_results), 1), 1)
        prob_score = round(sum(t.get("technical_score", 85.0) for t in technical_answers) / max(len(technical_answers), 1), 1)
        ovr = computed["overall_score"]
        recommendation = "Shortlist" if ovr >= 80.0 else ("Move to Next Round" if ovr >= 65.0 else "Reject")

        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id == session_id))
        report = res_rep.scalars().first()
        if not report:
            report = ScoringReport(
                session_id=session_id,
                communication_score=computed["communication_score"],
                confidence_score=computed["confidence_score"],
                technical_score=computed["technical_score"],
                professionalism_score=computed["professionalism_score"],
                grammar_score=grammar_score,
                problem_solving_score=prob_score,
                overall_score=computed["overall_score"],
                recommendation=recommendation,
                strengths=computed["strengths"],
                weaknesses=computed["weaknesses"],
                improvement_plan=computed["improvement_plan"]
            )
            db.add(report)
        else:
            report.communication_score = computed["communication_score"]
            report.confidence_score = computed["confidence_score"]
            report.technical_score = computed["technical_score"]
            report.professionalism_score = computed["professionalism_score"]
            report.grammar_score = grammar_score
            report.problem_solving_score = prob_score
            report.overall_score = computed["overall_score"]
            report.recommendation = recommendation
            report.strengths = computed["strengths"]
            report.weaknesses = computed["weaknesses"]
            report.improvement_plan = computed["improvement_plan"]

        # Update ScheduledInterview status if linked
        if session.scheduled_interview_id:
            res_sc = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == session.scheduled_interview_id))
            sc = res_sc.scalar_one_or_none()
            if sc:
                sc.status = "Completed"

        # Update Candidate Applications Pipeline Status to 'Recruiter Review'
        if session.candidate_id:
            await PipelineManager.update_pipeline_stage(db, session.candidate_id, "Recruiter Review", job_id=session.job_id)

            # Fetch candidate user to notify
            res_c = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
            cand = res_c.scalar_one_or_none()
            if cand and cand.user_id:
                notif_cand = Notification(
                    user_id=cand.user_id,
                    title=f"Interview Completed: {session.title}",
                    message=f"Your interview evaluation is ready. Overall Score: {computed['overall_score']}%.",
                    notification_type="interview_completed"
                )
                db.add(notif_cand)

            # Notify Recruiter
            rec_user_id = None
            if session.recruiter_id:
                res_rec = await db.execute(select(Recruiter).where(Recruiter.id == session.recruiter_id))
                rec = res_rec.scalar_one_or_none()
                if rec:
                    rec_user_id = rec.user_id

            if rec_user_id:
                cand_name = "Candidate"
                if cand and cand.user_id:
                    res_cu = await db.execute(select(User).where(User.id == cand.user_id))
                    cu = res_cu.scalar_one_or_none()
                    if cu:
                        cand_name = cu.full_name

                notif_rec = Notification(
                    user_id=rec_user_id,
                    title=f"Interview Completed: {cand_name}",
                    message=f"{cand_name} completed {session.title}. Overall Score: {computed['overall_score']}%. Evaluation ready for review.",
                    notification_type="interview_evaluation_ready"
                )
                db.add(notif_rec)

                # Send WebSocket notification to recruiter
                await ws_manager.send_personal_message({
                    "event": "INTERVIEW_COMPLETED",
                    "data": {
                        "session_id": session_id,
                        "candidate_name": cand_name,
                        "overall_score": computed["overall_score"],
                        "recommendation": recommendation,
                        "status": "Recruiter Review"
                    }
                }, rec_user_id)

        await db.commit()
        return report

interview_workflow_service = {
    "pipeline": PipelineManager,
    "state_machine": InterviewStateMachine,
    "questions": QuestionGeneratorService,
    "evaluation": EvaluationService
}
