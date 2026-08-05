import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter, AssessmentSession, AssessmentQuestion, AssessmentAnswer, AssessmentResult
from app.dependencies.auth import get_current_user, require_role
from app.services.assessment_service import assessment_service, AssessmentGenerationError

router = APIRouter(prefix="/aptitude", tags=["Unified AI Assessment Engine"])

class StartAssessmentRequest(BaseModel):
    title: Optional[str] = "Aptitude & Technical Practice"
    topics: List[str] = ["Quantitative Aptitude", "Logical Reasoning", "Software Concepts"]
    difficulty: str = "Medium"
    question_count: int = 10
    duration_minutes: int = 15
    passing_score: Optional[float] = 70.0
    negative_marking: Optional[float] = 0.25
    proctoring_enabled: Optional[bool] = True
    is_recruiter_configured: Optional[bool] = False
    recruiter_id: Optional[str] = None
    job_id: Optional[str] = None
    job_application_id: Optional[str] = None

    @field_validator("question_count")
    @classmethod
    def validate_question_count(cls, value: int) -> int:
        if value not in {10, 20, 30, 40, 50, 75, 100}:
            raise ValueError("question_count must be one of 10, 20, 30, 40, 50, 75, or 100")
        return value

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, value: int) -> int:
        if not 5 <= value <= 180:
            raise ValueError("duration_minutes must be between 5 and 180")
        return value

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, value: List[str]) -> List[str]:
        cleaned = list(dict.fromkeys(topic.strip() for topic in value if topic and topic.strip()))
        if not cleaned:
            raise ValueError("Select at least one topic")
        return cleaned

class AnswerItem(BaseModel):
    question_id: str
    selected_option: Optional[int] = None # None if skipped, 0-3 if answered
    time_taken_seconds: Optional[int] = 0

class SubmitAssessmentRequest(BaseModel):
    answers: List[AnswerItem]
    proctoring_violations: Optional[int] = 0

@router.post("/start", summary="Start Assessment Session (Practice Hub or Recruiter Online Exam)")
async def start_assessment(
    body: StartAssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initializes an assessment session powered by the Unified AI Assessment Engine."""
    try:
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()

        if not candidate and current_user.role == "candidate":
            candidate = Candidate(user_id=current_user.id)
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)

        session = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=candidate.id if candidate else None,
            title=body.title or "Aptitude & Technical Assessment",
            topics=body.topics,
            difficulty=body.difficulty,
            question_count=body.question_count,
            duration_minutes=body.duration_minutes,
            passing_score=body.passing_score or 70.0,
            negative_marking=body.negative_marking or 0.25,
            proctoring_enabled=body.proctoring_enabled if body.proctoring_enabled is not None else True,
            is_recruiter_configured=body.is_recruiter_configured or False,
            recruiter_id=body.recruiter_id,
            job_id=body.job_id,
            job_application_id=body.job_application_id
        )

        import logging
        _log = logging.getLogger("smarthire.aptitude_endpoint")
        _log.info("==========================================")
        _log.info("SESSION CREATED | ID: %s | Title: %s | Requested Questions: %d | Topics: %s", session.id, session.title, session.question_count, session.topics)
        _log.info("==========================================")

        # Pre-generate questions via Gemini AI
        questions = await assessment_service.generate_questions_for_session(db, session.id)

        _log.info("PAPER BUILDER SELECT COUNT: %d", len(questions))
        _log.info("QUESTIONS RETURNED TO FRONTEND: %d", len(questions))

        return {
            "session_id": session.id,
            "title": session.title,
            "topics": session.topics,
            "difficulty": session.difficulty,
            "question_count": session.question_count,
            "duration_minutes": session.duration_minutes,
            "passing_score": session.passing_score,
            "negative_marking": session.negative_marking,
            "proctoring_enabled": session.proctoring_enabled,
            "total_questions": len(questions)
        }
    except AssessmentGenerationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to start assessment: {str(e)}")

@router.get("/session/{session_id}/questions", response_model=List[Dict[str, Any]], summary="Get Assessment Questions")
async def get_assessment_questions(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches MCQs for the specified assessment session."""
    res_s = await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found.")

    questions = await assessment_service.generate_questions_for_session(db, session_id)

    out = []
    for q in questions:
        out.append({
            "id": q.id,
            "order_index": q.order_index,
            "category": q.category,
            "topic": q.topic,
            "question_text": q.question_text,
            "code_snippet": q.code_snippet,
            "options": q.options,
            "negative_marks": q.negative_marks
        })
    return out

@router.post("/session/{session_id}/submit", summary="Submit Assessment Answers for Evaluation")
async def submit_assessment(
    session_id: str,
    body: SubmitAssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Evaluates candidate assessment submission with negative marking, section scores, and AI recommendations."""
    res_s = await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found.")

    answers_payload = [a.dict() for a in body.answers]
    result = await assessment_service.evaluate_assessment_submission(
        db=db,
        session_id=session_id,
        answers_payload=answers_payload,
        proctoring_violations=body.proctoring_violations or 0
    )

    return {
        "status": "success",
        "session_id": session_id,
        "overall_score": result.overall_score,
        "total_correct": result.total_correct,
        "total_wrong": result.total_wrong,
        "total_skipped": result.total_skipped,
        "hiring_recommendation": result.hiring_recommendation,
        "proctoring_violations": result.proctoring_violations
    }

@router.get("/session/{session_id}/result", summary="Get Full Assessment Report & Question Review")
async def get_assessment_result(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns detailed assessment report including question-by-question review and explanations."""
    res_s = await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found.")

    res_r = await db.execute(select(AssessmentResult).where(AssessmentResult.session_id == session_id))
    result = res_r.scalar_one_or_none()
    if not result:
        if session.status != "completed":
            raise HTTPException(status_code=404, detail="Assessment session is still in progress.")
        # Auto-evaluate session answers on the fly if session was completed
        res_ans = await db.execute(select(AssessmentAnswer).where(AssessmentAnswer.session_id == session_id))
        answers = res_ans.scalars().all()
        answers_payload = [
            {"question_id": a.question_id, "selected_option": a.selected_option, "time_taken_seconds": a.time_taken_seconds}
            for a in answers
        ]
        result = await assessment_service.evaluate_assessment_submission(
            db=db,
            session_id=session_id,
            answers_payload=answers_payload,
            proctoring_violations=session.violations_count or 0
        )

    res_qs = await db.execute(select(AssessmentQuestion).where(AssessmentQuestion.session_id == session_id).order_by(AssessmentQuestion.order_index))
    questions = res_qs.scalars().all()

    question_review = []
    for q in questions:
        res_ans = await db.execute(select(AssessmentAnswer).where(
            AssessmentAnswer.session_id == session_id,
            AssessmentAnswer.question_id == q.id
        ))
        ans = res_ans.scalar_one_or_none()

        question_review.append({
            "question_id": q.id,
            "order_index": q.order_index,
            "category": q.category,
            "topic": q.topic,
            "question_text": q.question_text,
            "code_snippet": q.code_snippet,
            "options": q.options,
            "correct_option": q.correct_option,
            "selected_option": ans.selected_option if ans else None,
            "is_correct": ans.is_correct if ans else False,
            "points_earned": ans.points_earned if ans else 0.0,
            "explanation": q.explanation
        })

    return {
        "session_id": session_id,
        "title": session.title,
        "difficulty": session.difficulty,
        "overall_score": result.overall_score,
        "total_correct": result.total_correct,
        "total_wrong": result.total_wrong,
        "total_skipped": result.total_skipped,
        "section_scores": result.section_scores,
        "weak_areas": result.weak_areas,
        "strong_areas": result.strong_areas,
        "improvement_suggestions": result.improvement_suggestions,
        "hiring_recommendation": result.hiring_recommendation,
        "proctoring_violations": result.proctoring_violations,
        "question_review": question_review
    }

@router.get("/history", response_model=List[Dict[str, Any]], summary="Get Candidate Assessment History")
async def get_assessment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches candidate assessment history cards."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand:
        return []

    res_sess = await db.execute(
        select(AssessmentSession)
        .where(AssessmentSession.candidate_id == cand.id)
        .order_by(AssessmentSession.created_at.desc())
    )
    sessions = res_sess.scalars().all()

    out = []
    for s in sessions:
        res_r = await db.execute(select(AssessmentResult).where(AssessmentResult.session_id == s.id))
        res = res_r.scalar_one_or_none()

        out.append({
            "session_id": s.id,
            "title": s.title,
            "difficulty": s.difficulty,
            "question_count": s.question_count,
            "duration_minutes": s.duration_minutes,
            "topics": s.topics,
            "status": s.status,
            "date": s.created_at.strftime('%b %d, %Y') if s.created_at else "Recent",
            "overall_score": res.overall_score if res else None,
            "hiring_recommendation": res.hiring_recommendation if res else "Pending"
        })
    return out
