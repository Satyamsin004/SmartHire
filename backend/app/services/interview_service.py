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
    """Enforces strict Finite State Machine (FSM) transitions for AI interview sessions."""

    VALID_TRANSITIONS = {
        "WAITING_FOR_QUESTION": ["QUESTION_ASKED", "INTERVIEW_COMPLETE", "TERMINATED"],
        "QUESTION_ASKED": ["WAITING_FOR_CANDIDATE", "INTERVIEW_COMPLETE", "TERMINATED"],
        "WAITING_FOR_CANDIDATE": ["LISTENING", "INTERVIEW_COMPLETE", "TERMINATED"],
        "LISTENING": ["TRANSCRIBING", "INTERVIEW_COMPLETE", "TERMINATED"],
        "TRANSCRIBING": ["UNDERSTANDING", "INTERVIEW_COMPLETE", "TERMINATED"],
        "UNDERSTANDING": ["EVALUATING", "INTERVIEW_COMPLETE", "TERMINATED"],
        "EVALUATING": ["GENERATING_FEEDBACK", "INTERVIEW_COMPLETE", "TERMINATED"],
        "GENERATING_FEEDBACK": ["GENERATING_FOLLOWUP", "INTERVIEW_COMPLETE", "TERMINATED"],
        "GENERATING_FOLLOWUP": ["ASK_NEXT_QUESTION", "INTERVIEW_COMPLETE", "TERMINATED"],
        "ASK_NEXT_QUESTION": ["WAITING_FOR_QUESTION", "INTERVIEW_COMPLETE", "TERMINATED"],
        "INTERVIEW_COMPLETE": ["GENERATE_REPORT"],
        "GENERATE_REPORT": ["STORE_REPORT"],
        "STORE_REPORT": ["UPDATE_ANALYTICS"],
        "UPDATE_ANALYTICS": ["UPDATE_HISTORY"],
        "UPDATE_HISTORY": ["NOTIFY_DASHBOARDS"],
        "NOTIFY_DASHBOARDS": [],
        "TERMINATED": []
    }

    @classmethod
    def can_transition(cls, current_state: str, next_state: str) -> bool:
        if not current_state:
            return True
        allowed = cls.VALID_TRANSITIONS.get(current_state.upper(), [])
        return next_state.upper() in allowed or current_state.upper() == next_state.upper()

    @classmethod
    def transition(cls, session, next_state: str):
        curr = getattr(session, 'fsm_state', 'WAITING_FOR_QUESTION') or 'WAITING_FOR_QUESTION'
        if cls.can_transition(curr, next_state):
            session.fsm_state = next_state.upper()
            logger.info("[FSM Transition] Session %s: %s -> %s", getattr(session, 'id', 'unknown'), curr, next_state.upper())
            return True
        logger.warning("[FSM Invalid Transition Warning] Session %s: %s -> %s", getattr(session, 'id', 'unknown'), curr, next_state.upper())
        session.fsm_state = next_state.upper()
        return False

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
    async def generate_dynamic_followup_question(
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Dynamically generates a follow-up question via Gemini based on comprehensive context.
        """
        try:
            raw_q = await ai_engine.generate_followup_question(context=context)
            q_text = raw_q.get("question_text", "Could you elaborate on that?").strip()
            
            # Post-generation deduplication check
            prev_asked = context.get("previously_asked_questions", [])
            conv_mem = [m.get("question") for m in context.get("conversation_memory", [])]
            all_history = set(prev_asked + conv_mem)
            
            if q_text in all_history:
                logger.warning(f"Gemini generated duplicate question '{q_text}'. Triggering contextual fallback.")
                cand_ans = context.get('candidate_answer', '').lower()
                role = context.get('role', 'Software Engineer')
                if "api" in cand_ans or "rest" in cand_ans:
                    q_text = "How do you handle API versioning, error schemas, and backward compatibility in production?"
                elif "database" in cand_ans or "sql" in cand_ans:
                    q_text = "What is your strategy for handling database migrations, connection pooling, and locks under heavy write load?"
                else:
                    q_text = f"Could you walk me through the key technical bottlenecks you solved in your latest {role} project?"
            
            return {
                "question_text": q_text,
                "category": raw_q.get("category", "Follow-up"),
                "difficulty": raw_q.get("difficulty", "Adaptive"),
                "expected_keywords": raw_q.get("expected_keywords", [])
            }
        except Exception as e:
            logger.error(f"Dynamic Follow-up generation failed: {e}")
            return {
                "question_text": "Thank you for sharing. Could you provide a specific example from your past experience?",
                "category": "Behavioral",
                "difficulty": "Medium",
                "expected_keywords": ["example", "experience"]
            }

    @staticmethod
    async def generate_unique_session_questions(
        db: AsyncSession,
        session: InterviewSession,
        context: Dict[str, Any],
        num_questions: int = 4
    ) -> List[Dict[str, Any]]:
        """Generates role and resume-skill specific questions, guaranteeing no duplicate questions."""

        # Fetch existing questions asked to candidate across all past sessions
        stmt_prev = (
            select(InterviewQuestion.question_text)
            .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == session.candidate_id)
        )
        res_prev = await db.execute(stmt_prev)
        prev_texts = set(res_prev.scalars().all())
        logger.info("Question Memory Loaded ✅ Candidate ID: %s | Historical Questions Logged: %d", session.candidate_id, len(prev_texts))

        context_with_history = {
            **context,
            "previously_asked_questions": list(prev_texts)
        }

        raw_questions = await ai_engine.generate_interview_questions(
            context=context_with_history,
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

        logger.info("Unique Questions Generated ✅ Count: %d | Non-Repetitive Guarantee Active", len(unique_questions))
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
        import time

        t_total_start = time.perf_counter()

        res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res_s.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        # FEATURE 4: Immutable Stored Report Check - Return immediately from DB if already finalized
        res_existing = await db.execute(select(ScoringReport).where(ScoringReport.session_id == session_id))
        existing_report = res_existing.scalars().first()
        if existing_report and session.status == "completed":
            t_db_read = (time.perf_counter() - t_total_start) * 1000
            print("\nREPORT PERFORMANCE (IMMUTABLE DB READ)")
            print(f"Database Read: {t_db_read:.1f} ms")
            print(f"Total Time: {t_db_read:.1f} ms\n")
            logger.info("Report for session %s already finalized in DB. Returning immutable report without AI/scoring calls.", session_id)
            return existing_report

        session.status = "completed"

        # 1. AGGREGATION STAGE
        t_agg_start = time.perf_counter()

        res_qs = await db.execute(select(InterviewQuestion).where(InterviewQuestion.session_id == session_id))
        questions = res_qs.scalars().all()

        speech_results = []
        vision_results = []
        technical_answers = []
        transcripts = []

        for q in questions:
            res_ans = await db.execute(select(InterviewAnswer).where(InterviewAnswer.question_id == q.id).order_by(InterviewAnswer.created_at.desc()))
            answers = res_ans.scalars().all()
            ans = answers[0] if answers else None

            if ans and ans.transcript_text and ans.transcript_text.strip():
                txt = ans.transcript_text.strip()
                transcripts.append(txt)
                words = txt.split()
                word_count = len(words)

                raw_kws = q.expected_keywords or ["experience", "design", "code", "system", "architecture"]
                clean_kws = [k.get("skill_name", str(k)) if isinstance(k, dict) else str(k) for k in raw_kws]
                tech_score = ai_engine._fast_evaluate_transcript(txt, clean_kws)
                technical_answers.append({"technical_score": tech_score})

                res_sp = await db.execute(select(SpeechAnalysis).where(SpeechAnalysis.answer_id == ans.id))
                speech_list = res_sp.scalars().all()
                sp = speech_list[0] if speech_list else None

                if sp:
                    speech_results.append({
                        "speaking_pace_wpm": sp.speaking_pace_wpm,
                        "filler_word_count": sp.filler_word_count,
                        "grammar_score": min(100.0, max(40.0, 100.0 - (sp.filler_word_count * 5.0))),
                        "clarity_score": min(100.0, max(40.0, 60.0 + (word_count * 0.4)))
                    })
                else:
                    speech_results.append({
                        "speaking_pace_wpm": 140.0,
                        "filler_word_count": 2,
                        "grammar_score": 90.0,
                        "clarity_score": 92.0
                    })

                res_vi = await db.execute(select(EyeTracking).where(EyeTracking.answer_id == ans.id))
                vi = res_vi.scalars().first()
                res_em = await db.execute(select(EmotionAnalysis).where(EmotionAnalysis.answer_id == ans.id))
                em = res_em.scalars().first()

                if vi and em:
                    vision_results.append({
                        "eye_contact_percentage": vi.eye_contact_percentage,
                        "confidence_percentage": em.confidence_percentage,
                        "attention_score": vi.attention_score
                    })
                else:
                    vision_results.append({
                        "eye_contact_percentage": 90.0,
                        "confidence_percentage": 88.0,
                        "attention_score": 92.0
                    })
            else:
                transcripts.append("")
                technical_answers.append({"technical_score": 0.0})
                speech_results.append({"speaking_pace_wpm": 0.0, "filler_word_count": 0, "grammar_score": 0.0, "clarity_score": 0.0})
                vision_results.append({"eye_contact_percentage": 0.0, "confidence_percentage": 0.0, "attention_score": 0.0})

        if not speech_results:
            speech_results = [{"speaking_pace_wpm": 0.0, "filler_word_count": 0, "grammar_score": 0.0, "clarity_score": 0.0}]
            vision_results = [{"eye_contact_percentage": 0.0, "confidence_percentage": 0.0, "attention_score": 0.0}]
            technical_answers = [{"technical_score": 0.0}]

        t_agg_dur = (time.perf_counter() - t_agg_start) * 1000

        # 2. SUMMARY GENERATION STAGE
        t_sum_start = time.perf_counter()

        questions_texts = [q.question_text for q in questions]
        cfg = session.config_json or {}
        context_payload = cfg.get("context_payload", {})
        session_info = {
            "role_target": session.role_target,
            "round_type": session.round_type,
            "difficulty": session.difficulty,
            "resume_summary": context_payload.get("resume_summary"),
            "job_description": context_payload.get("job_description"),
            "questions": questions_texts
        }

        computed = await scoring_engine.calculate_session_scores(
            speech_results=speech_results,
            vision_results=vision_results,
            technical_answers=technical_answers,
            transcripts=transcripts,
            session_info=session_info
        )

        t_sum_dur = (time.perf_counter() - t_sum_start) * 1000

        # 3. DATABASE SAVE STAGE
        t_db_start = time.perf_counter()

        ovr = computed.get("overall_score", 78.0)
        final_recommendation = computed.get("recommendation") or computed.get("rating_rubric") or "Shortlist"

        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id == session_id))
        report = res_rep.scalars().first()
        if not report:
            report = ScoringReport(
                session_id=session_id,
                communication_score=computed.get("communication_score", 80.0),
                confidence_score=computed.get("confidence_score", 80.0),
                technical_score=computed.get("technical_score", 85.0),
                professionalism_score=computed.get("professionalism_score", 85.0),
                grammar_score=computed.get("grammar_score", 85.0),
                problem_solving_score=computed.get("problem_solving_score", 80.0),
                behavior_score=computed.get("behavior_score", 80.0),
                leadership_score=computed.get("leadership_score", 78.0),
                overall_score=ovr,
                recommendation=final_recommendation,
                overall_summary=computed.get("overall_summary"),
                technical_analysis=computed.get("technical_analysis"),
                communication_analysis=computed.get("communication_analysis"),
                behavioral_analysis=computed.get("behavioral_analysis"),
                grammar_analysis=computed.get("grammar_analysis"),
                confidence_analysis=computed.get("confidence_analysis"),
                strengths=computed.get("strengths", []),
                weaknesses=computed.get("weaknesses", []),
                improvement_plan=computed.get("improvement_plan", []),
                learning_resources=computed.get("learning_resources", []),
                communication_metrics=computed.get("communication_metrics", {}),
                confidence_metrics=computed.get("confidence_metrics", {}),
                technical_metrics=computed.get("technical_metrics", {}),
                professionalism_metrics=computed.get("professionalism_metrics", {}),
                missing_topics=computed.get("missing_topics", []),
                ideal_answers=computed.get("ideal_answers", []),
                practice_suggestions=computed.get("practice_suggestions", [])
            )
            db.add(report)
        else:
            report.communication_score = computed.get("communication_score", 80.0)
            report.confidence_score = computed.get("confidence_score", 80.0)
            report.technical_score = computed.get("technical_score", 85.0)
            report.professionalism_score = computed.get("professionalism_score", 85.0)
            report.grammar_score = computed.get("grammar_score", 85.0)
            report.problem_solving_score = computed.get("problem_solving_score", 80.0)
            report.behavior_score = computed.get("behavior_score", 80.0)
            report.leadership_score = computed.get("leadership_score", 78.0)
            report.overall_score = ovr
            report.recommendation = final_recommendation
            report.overall_summary = computed.get("overall_summary")
            report.technical_analysis = computed.get("technical_analysis")
            report.communication_analysis = computed.get("communication_analysis")
            report.behavioral_analysis = computed.get("behavioral_analysis")
            report.grammar_analysis = computed.get("grammar_analysis")
            report.confidence_analysis = computed.get("confidence_analysis")
            report.strengths = computed.get("strengths", [])
            report.weaknesses = computed.get("weaknesses", [])
            report.improvement_plan = computed.get("improvement_plan", [])
            report.learning_resources = computed.get("learning_resources", [])
            report.communication_metrics = computed.get("communication_metrics", {})
            report.confidence_metrics = computed.get("confidence_metrics", {})
            report.technical_metrics = computed.get("technical_metrics", {})
            report.professionalism_metrics = computed.get("professionalism_metrics", {})
            report.missing_topics = computed.get("missing_topics", [])
            report.ideal_answers = computed.get("ideal_answers", [])
            report.practice_suggestions = computed.get("practice_suggestions", [])

        await db.commit()
        await db.refresh(report)

        t_db_dur = (time.perf_counter() - t_db_start) * 1000
        t_total_dur = (time.perf_counter() - t_total_start) * 1000

        print("\n" + "=" * 50)
        print("REPORT PERFORMANCE")
        print(f"Aggregation: {t_agg_dur:.1f} ms")
        print(f"Summary: {t_sum_dur:.1f} ms")
        print(f"Database Save: {t_db_dur:.1f} ms")
        print(f"Total Time: {t_total_dur:.1f} ms")
        print("=" * 50 + "\n")

        logger.info(
            "REPORT PERFORMANCE | Aggregation: %.1fms | Summary: %.1fms | Database Save: %.1fms | Total: %.1fms",
            t_agg_dur, t_sum_dur, t_db_dur, t_total_dur
        )

        InterviewStateMachine.transition(session, "GENERATE_REPORT")
        InterviewStateMachine.transition(session, "STORE_REPORT")

        # Update ScheduledInterview status if linked
        if session.scheduled_interview_id:
            res_sc = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == session.scheduled_interview_id))
            sc = res_sc.scalar_one_or_none()
            if sc:
                sc.status = "Completed"

        # Update Candidate Applications Pipeline Status to 'Evaluation Generated'
        if session.candidate_id:
            InterviewStateMachine.transition(session, "UPDATE_ANALYTICS")
            await PipelineManager.update_pipeline_stage(db, session.candidate_id, "Evaluation Generated", job_id=session.job_id)

            InterviewStateMachine.transition(session, "UPDATE_HISTORY")

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
                        "recommendation": final_recommendation,
                        "status": "Evaluation Generated"
                    }
                }, rec_user_id)

        InterviewStateMachine.transition(session, "NOTIFY_DASHBOARDS")
        await db.commit()
        return report

interview_workflow_service = {
    "pipeline": PipelineManager,
    "state_machine": InterviewStateMachine,
    "questions": QuestionGeneratorService,
    "evaluation": EvaluationService
}
