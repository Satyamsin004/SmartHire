import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header
import pdfplumber
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from app.core.db import get_db
from app.models.domain import InterviewSession, InterviewQuestion, InterviewAnswer, SpeechAnalysis, EyeTracking, EmotionAnalysis, ScoringReport, Candidate, User, ScheduledInterview, JobApplication, JobPosting, Resume
from app.services.ai_engine import ai_engine
from app.services.speech_service import speech_service
from app.services.vision_service import vision_service
from app.services.scoring_engine import scoring_engine
from app.services.interview_service import (
    PipelineManager, QuestionGeneratorService, EvaluationService, InterviewStateMachine
)
from app.schemas.domain import (
    StartInterviewRequest, QuestionResponse, SubmitAnswerRequest, AnswerEvaluationResponse, ScoringReportResponse
)
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/interview", tags=["AI Interview Engine"])

@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        content = await file.read()
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
                
        return {"resume_text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

@router.post("/start", response_model=Dict[str, Any])
async def start_interview_session(
    body: StartInterviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Starts an interview session bound strictly to candidate & recruiter configuration."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=current_user.id, target_role=body.role_target or "Software Engineer")
        db.add(candidate)
        await db.flush()

    scheduled_inst = None
    if body.schedule_id:
        res_s = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == body.schedule_id))
        scheduled_inst = res_s.scalar_one_or_none()

    if scheduled_inst:
        # MODE 2: Recruiter Scheduled Interview (Pre-configured by Recruiter)
        cfg = scheduled_inst.config_json or {}
        role_target = cfg.get("job_title") or candidate.target_role or "Software Engineer"
        round_type = scheduled_inst.round_type or cfg.get("round_type", "Technical")
        difficulty = scheduled_inst.difficulty or cfg.get("difficulty", "Medium")
        duration_minutes = scheduled_inst.duration_minutes or cfg.get("duration_minutes", 30)
        question_count = scheduled_inst.question_count or cfg.get("question_count", 6)
        resume_text = cfg.get("resume_text") or body.resume_text

        new_session = InterviewSession(
            title=f"{role_target} ({round_type} Round)",
            role_target=role_target,
            round_type=round_type,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
            question_count=question_count,
            interview_type="Recruiter",
            scheduled_interview_id=scheduled_inst.id,
            candidate_id=candidate.id,
            recruiter_id=scheduled_inst.recruiter_id,
            job_application_id=scheduled_inst.job_application_id,
            job_id=scheduled_inst.job_id,
            resume_id=scheduled_inst.resume_id,
            config_json=cfg,
            status="active"
        )
        db.add(new_session)
        await db.flush()

        scheduled_inst.status = "In Progress"
        scheduled_inst.session_id = new_session.id
        await db.flush()
    else:
        # MODE 1: Mock Practice Interview (Candidate Configured)
        role_target = body.role_target or "Software Engineer"
        round_type = body.round_type or "Technical"
        difficulty = body.difficulty or "Medium"
        duration_minutes = body.duration_minutes or 15
        question_count = 4 if duration_minutes <= 15 else (6 if duration_minutes <= 30 else 8)
        resume_text = body.resume_text

        new_session = InterviewSession(
            title=f"{role_target} ({round_type} Round)",
            role_target=role_target,
            round_type=round_type,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
            question_count=question_count,
            interview_type="Mock",
            candidate_id=candidate.id,
            status="active"
        )
        db.add(new_session)
        await db.flush()

    # Automatically advance candidate pipeline status to 'Interview Started'
    await PipelineManager.update_pipeline_stage(db, candidate.id, "Interview Started", job_id=new_session.job_id)

    target_num_q = new_session.question_count or 6

    # Generate UNIQUE, Non-Repeating questions
    questions_data = await QuestionGeneratorService.generate_unique_session_questions(
        db=db,
        session=new_session,
        role=new_session.role_target,
        round_type=new_session.round_type,
        difficulty=new_session.difficulty,
        resume_summary=resume_text,
        num_questions=target_num_q
    )

    if not questions_data:
        raise HTTPException(status_code=500, detail="Failed to generate questions from AI Engine.")

    db_questions = []
    response_questions = []

    for idx, q in enumerate(questions_data, start=1):
        db_q = InterviewQuestion(
            session_id=new_session.id,
            order_index=idx,
            question_text=q["question_text"],
            category=q.get("category", "Technical"),
            difficulty=q.get("difficulty", "Medium"),
            expected_keywords=q.get("expected_keywords", []),
            is_followup=False
        )
        db.add(db_q)
        db_questions.append(db_q)

    await db.commit()

    for q in db_questions:
        response_questions.append({
            "question_id": q.id,
            "session_id": new_session.id,
            "order_index": q.order_index,
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "expected_keywords": q.expected_keywords,
            "is_followup": False
        })

    return {
        "session_id": new_session.id,
        "title": new_session.title,
        "total_questions": len(response_questions),
        "first_question": response_questions[0],
        "questions": response_questions
    }

@router.post("/submit-answer", response_model=AnswerEvaluationResponse)
async def submit_answer(body: SubmitAnswerRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InterviewSession).where(InterviewSession.id == body.session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    res_q = await db.execute(select(InterviewQuestion).where(InterviewQuestion.id == body.question_id))
    question = res_q.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    speech_res = speech_service.analyze_speech(body.transcript_text, body.speech_duration_seconds or 45.0)
    vision_res = vision_service.analyze_telemetry(body.vision_telemetry)

    answer = InterviewAnswer(
        question_id=question.id,
        transcript_text=body.transcript_text
    )
    db.add(answer)
    await db.flush()

    speech_db = SpeechAnalysis(
        answer_id=answer.id,
        speaking_pace_wpm=speech_res["speaking_pace_wpm"],
        filler_word_count=speech_res["filler_word_count"],
        filler_words=speech_res["filler_words"]
    )
    vision_db = EyeTracking(
        answer_id=answer.id,
        eye_contact_percentage=vision_res["eye_contact_percentage"],
        attention_score=vision_res.get("attention_score", 90.0)
    )
    emotion_db = EmotionAnalysis(
        answer_id=answer.id,
        dominant_emotion=vision_res["dominant_emotion"],
        confidence_percentage=vision_res["confidence_percentage"]
    )
    db.add(speech_db)
    db.add(vision_db)
    db.add(emotion_db)

    # Get next question logic
    res_qs = await db.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.order_index)
    )
    all_questions = res_qs.scalars().all()

    next_q_db = None
    for q in all_questions:
        if q.order_index == question.order_index + 1:
            next_q_db = q
            break

    next_q_response = None
    if next_q_db:
        next_q_response = {
            "question_id": next_q_db.id,
            "session_id": session.id,
            "order_index": next_q_db.order_index,
            "question_text": next_q_db.question_text,
            "category": next_q_db.category,
            "difficulty": next_q_db.difficulty,
            "is_followup": next_q_db.is_followup
        }
    # Check if target maximum questions reached for session
    if not next_q_db:
        # Session is complete! Finalize session state and generate report
        session.status = "completed"
        await db.commit()
        await EvaluationService.generate_and_finalize_report(db, session.id)
        next_q_response = None

    # Generate verbal evaluation feedback
    evaluation_res = await ai_engine.evaluate_candidate_answer(
        question_text=question.question_text,
        candidate_answer=body.transcript_text,
        role=session.role_target
    )
    if isinstance(evaluation_res, dict):
        evaluation_feedback = evaluation_res.get("feedback") or str(evaluation_res)
    else:
        evaluation_feedback = str(evaluation_res) if evaluation_res else "Good technical response."

    await db.commit()

    return {
        "answer_id": answer.id,
        "speaking_pace_wpm": speech_res["speaking_pace_wpm"],
        "filler_word_count": speech_res["filler_word_count"],
        "filler_words": speech_res["filler_words"],
        "eye_contact_percentage": vision_res["eye_contact_percentage"],
        "confidence_percentage": vision_res["confidence_percentage"],
        "dominant_emotion": vision_res["dominant_emotion"],
        "evaluation_feedback": evaluation_feedback,
        "next_question": next_q_response
    }

@router.get("/report/{session_id}", response_model=ScoringReportResponse)
async def get_session_report(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to another candidate's interview session.")
        
    # Calculate, store in PostgreSQL, advance pipeline, and generate report via EvaluationService (Step 8 & 9)
    report = await EvaluationService.generate_and_finalize_report(db, session_id)

    return {
        "id": f"rep-{session_id}",
        "session_id": session_id,
        "communication_score": report.communication_score,
        "confidence_score": report.confidence_score,
        "technical_score": report.technical_score,
        "professionalism_score": report.professionalism_score,
        "overall_score": report.overall_score,
        "strengths": report.strengths,
        "weaknesses": report.weaknesses,
        "improvement_plan": report.improvement_plan,
        "rating_rubric": f"Overall Rating: {round(report.overall_score, 1)}%"
    }

@router.get("/history", response_model=List[Dict[str, Any]])
async def get_interview_history(
    candidate_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches interview history strictly filtered by authenticated user's Candidate record or specified candidate_id for recruiters."""
    cand_ids = []
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cands = res_c.scalars().all()
        if not cands:
            return []
        cand_ids = [c.id for c in cands]
    elif candidate_id:
        cand_ids = [candidate_id]

    if not cand_ids and current_user.role != "candidate":
        res = await db.execute(select(InterviewSession).order_by(InterviewSession.started_at.desc()).limit(15))
        sessions = res.scalars().all()
    else:
        res = await db.execute(
            select(InterviewSession)
            .where(InterviewSession.candidate_id.in_(cand_ids))
            .order_by(InterviewSession.started_at.desc())
            .limit(15)
        )
        sessions = res.scalars().all()

    history = []
    for s in sessions:
        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id == s.id))
        rep = res_rep.scalars().first()

        if not rep and (s.status == "completed" or s.status == "active"):
            try:
                rep = await EvaluationService.generate_and_finalize_report(db, s.id)
            except Exception as e:
                logger.warning(f"Auto-report generation for session {s.id} skipped: {e}")

        score = round(rep.overall_score, 1) if (rep and rep.overall_score is not None) else None

        history.append({
            "id": s.id,
            "title": s.title,
            "role_target": s.role_target,
            "round_type": s.round_type,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "score": score
        })

    return history
