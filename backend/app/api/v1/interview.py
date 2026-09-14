import uuid
import logging
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Response, Query, status
import pdfplumber
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from typing import List, Dict, Any, Optional
from app.core.db import get_db
from app.models.domain import (
    InterviewSession, InterviewRecording, InterviewQuestion, InterviewAnswer,
    SpeechAnalysis, EyeTracking, EmotionAnalysis, ScoringReport, Candidate, Recruiter, User,
    ScheduledInterview, JobApplication, JobPosting, Resume, ResumeSkill,
    InterviewTranscriptSegment, InterviewSpeechMetric, InterviewFillerEvent,
    InterviewVisualMetric, InterviewVisualObservation
)
from app.services.ai_engine import ai_engine
from app.services.speech_service import speech_service
from app.services.vision_service import vision_service
from app.services.scoring_engine import scoring_engine
from app.services.interview_service import (
    PipelineManager, QuestionGeneratorService, EvaluationService, InterviewStateMachine
)
from app.services.pdf_service import pdf_generator
from app.services.technical_evaluator import technical_evaluator
from app.schemas.domain import (
    StartInterviewRequest, QuestionResponse, SubmitAnswerRequest, AnswerEvaluationResponse, ScoringReportResponse
)
from app.dependencies.auth import get_current_user

import re
import hashlib
from pydantic import BaseModel

router = APIRouter(prefix="/interview", tags=["AI Interview Engine"])
logger = logging.getLogger("smarthire.interview")

from app.services.storage_service import storage_service
from app.services.resume_service import ResumeService

resume_service = ResumeService()

_tts_cache: Dict[str, bytes] = {}

async def _synthesize_edge_tts(clean_text: str, voice: str) -> bytes:
    import edge_tts
    comm = edge_tts.Communicate(clean_text, voice)
    chunks = []
    async for chunk in comm.stream():
        if chunk.get("type") == "audio" and "data" in chunk:
            chunks.append(chunk["data"])
    return b"".join(chunks)

async def _prewarm_tts(text: str, voice: str = "en-US-AriaNeural"):
    """Pre-generates neural TTS audio in the background so questions play with 0ms latency."""
    try:
        raw = (text or "").strip()
        if not raw:
            return
        clean_text = re.sub(r'[*_#`~]', '', raw).strip()
        cache_key = hashlib.md5(f"{voice}:{clean_text}".encode()).hexdigest()
        if cache_key in _tts_cache:
            return
        audio_bytes = await asyncio.wait_for(_synthesize_edge_tts(clean_text, voice), timeout=4.5)
        if audio_bytes:
            if len(_tts_cache) > 120:
                _tts_cache.clear()
            _tts_cache[cache_key] = audio_bytes
            logger.info(f"[TTS Pre-warm] Pre-cached {len(audio_bytes)} bytes audio for question: {clean_text[:40]}...")
    except Exception as e:
        logger.debug(f"[TTS Pre-warm] Notice: {e}")

@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ["pdf", "docx", "doc"]:
        raise HTTPException(status_code=400, detail="Only PDF (.pdf) and Word (.docx) files are supported.")
    
    try:
        content = await file.read()
        extracted_text = resume_service.extract_text_from_file_bytes(content, filename)
        if not extracted_text or not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from uploaded file.")
            
        parsed_json = await ai_engine.parse_resume_to_json(extracted_text.strip())
        return {"resume_text": extracted_text.strip(), "parsed_data": parsed_json}
    except HTTPException:
        raise
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
        if not scheduled_inst:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled interview not found.")

        # Check authorization: Candidate must own this scheduled interview
        is_owner = (scheduled_inst.candidate_id == candidate.id)
        if not is_owner and scheduled_inst.job_application_id:
            res_app = await db.execute(select(JobApplication).where(JobApplication.id == scheduled_inst.job_application_id))
            job_app = res_app.scalar_one_or_none()
            if job_app and job_app.candidate_id == candidate.id:
                is_owner = True
        if not is_owner and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to start this scheduled interview."
            )

        # Check status: Completed or Cancelled interviews cannot be restarted
        if scheduled_inst.status in ("Completed", "Cancelled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This interview has already been marked as {scheduled_inst.status}."
            )

        # ENFORCE SCHEDULE TIME: Candidate can ONLY start at or after the scheduled time, NOT before!
        if scheduled_inst.scheduled_date:
            sched_dt = scheduled_inst.scheduled_date
            if sched_dt.tzinfo is not None:
                sched_dt = sched_dt.replace(tzinfo=None)
            now_utc = datetime.utcnow()
            if now_utc < sched_dt:
                diff = sched_dt - now_utc
                total_secs = int(diff.total_seconds())
                hours = total_secs // 3600
                minutes = (total_secs % 3600) // 60
                seconds = total_secs % 60
                time_parts = []
                if hours > 0:
                    time_parts.append(f"{hours}h")
                if minutes > 0 or hours > 0:
                    time_parts.append(f"{minutes}m")
                time_parts.append(f"{seconds}s")
                remaining_str = " ".join(time_parts)
                formatted_time = sched_dt.strftime("%b %d, %Y at %I:%M %p")
                logger.warning(
                    f"[Interview Start Blocked] Candidate {candidate.id} attempted to start scheduled interview {scheduled_inst.id} before scheduled time {formatted_time}. Remaining: {remaining_str}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This interview is scheduled for {formatted_time}. You can only attend at the scheduled time, not before that (starts in {remaining_str})."
                )

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
        difficulty = body.difficulty or "Easy"
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
            config_json={"parsed_resume": body.parsed_resume, "resume_text": body.resume_text},
            status="active"
        )
        db.add(new_session)
        await db.flush()

    # Automatically advance candidate pipeline status to round-specific 'In Progress' status
    if new_session.interview_type == "Recruiter" and new_session.job_application_id:
        r_name = (new_session.round_type or "Interview").capitalize()
        await PipelineManager.update_pipeline_stage(db, candidate.id, f"{r_name} In Progress", job_id=new_session.job_id)
    else:
        await PipelineManager.update_pipeline_stage(db, candidate.id, "Interview Started", job_id=new_session.job_id)

    target_num_q = new_session.question_count or 6

    # Fetch candidate's latest stored Resume from PostgreSQL
    res_r = await db.execute(
        select(Resume).where(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc())
    )
    db_resume = res_r.scalars().first()

    if not db_resume and (body.resume_text or body.parsed_resume):
        parsed = body.parsed_resume or {}
        new_res = Resume(
            candidate_id=candidate.id,
            file_name="mock_resume.pdf",
            raw_text=body.resume_text or "",
            summary=parsed.get("summary") or "Candidate Resume",
            ats_score=parsed.get("ats_score", 75.0),
            projects=parsed.get("projects", []),
            certifications=parsed.get("certifications", []),
            experience_years=parsed.get("experience_years") or "Not Available",
            education_level=parsed.get("education_level") or "Not Available"
        )
        db.add(new_res)
        await db.flush()
        db_resume = new_res
        
        for sk in parsed.get("skills", []):
            sk_name = sk.get("skill_name", str(sk)) if isinstance(sk, dict) else str(sk)
            sk_cat = sk.get("category", "Technical") if isinstance(sk, dict) else "Technical"
            db.add(ResumeSkill(resume_id=new_res.id, skill_name=sk_name, category=sk_cat))
        await db.flush()
    
    db_skills = []
    if db_resume:
        res_sk = await db.execute(select(ResumeSkill).where(ResumeSkill.resume_id == db_resume.id))
        db_skills = res_sk.scalars().all()

    # Load Job Description if job_id exists
    job_desc_text = "Not Available"
    target_job_id = scheduled_inst.job_id if scheduled_inst else None
    if target_job_id:
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == target_job_id))
        job_inst = res_j.scalar_one_or_none()
        if job_inst and job_inst.description:
            job_desc_text = job_inst.description

    resume_summary_val = (db_resume.summary if db_resume and db_resume.summary else None) or body.resume_text or "Not Available"
    raw_skills = [s.skill_name for s in db_skills] if db_skills else (body.parsed_resume.get("skills", []) if body.parsed_resume else [])
    resume_skills_val = [s.get("skill_name", str(s)) if isinstance(s, dict) else str(s) for s in raw_skills]
    resume_projects_raw = (db_resume.projects if db_resume and db_resume.projects else None) or (body.parsed_resume.get("projects", []) if body.parsed_resume else [])
    # Filter out SmartHire project from context - SmartHire is the interview platform itself
    resume_projects_val = [
        p for p in (resume_projects_raw or [])
        if not (isinstance(p, str) and "smarthire" in p.lower())
        and not (isinstance(p, dict) and "smarthire" in (p.get("project_name", "") or str(p)).lower())
    ]

    context_payload = {
        "role": new_session.role_target,
        "round_type": new_session.round_type,
        "difficulty": new_session.difficulty,
        "language": body.language or "English",
        "resume_summary": resume_summary_val,
        "resume_skills": resume_skills_val,
        "resume_projects": resume_projects_val,
        "ats_match": "Not Available",
        "job_description": job_desc_text
    }

    new_session.config_json = {
        **(new_session.config_json or {}),
        "language": body.language or "English",
        "context_payload": context_payload,
        "parsed_resume": body.parsed_resume
    }

    await db.flush()

    # Generate ONLY the first question statically (follow-ups are dynamic)
    questions_data = await QuestionGeneratorService.generate_unique_session_questions(
        db=db,
        session=new_session,
        context=context_payload,
        num_questions=1
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
            category=str(q.get("category", "Technical"))[:250],
            difficulty=str(q.get("difficulty", "Medium"))[:90],
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

    if response_questions:
        try:
            cand_name = (current_user.full_name or "Candidate").strip()
            round_str = new_session.round_type or "Technical"
            role_str = new_session.role_target or "Software Engineer"
            first_q_text = response_questions[0]["question_text"]
            greeting_speech = f"Hi {cand_name}! Welcome to your {round_str} interview for the {role_str} position. I am your AI Interviewer. Let's begin with your first question. {first_q_text}"
            asyncio.create_task(_prewarm_tts(greeting_speech))
            asyncio.create_task(_prewarm_tts(first_q_text))
        except Exception:
            pass

    return {
        "session_id": new_session.id,
        "title": new_session.title,
        "role_target": new_session.role_target,
        "round_type": new_session.round_type,
        "difficulty": new_session.difficulty,
        "duration_minutes": new_session.duration_minutes,
        "question_count": new_session.question_count,
        "total_questions": new_session.question_count or len(response_questions) or 6,
        "first_question": response_questions[0],
        "questions": response_questions
    }

@router.get("/interview-sessions/{session_id}/status", summary="Get Interview Session Status")
async def get_interview_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves real-time status and metadata for an interview session with ownership verification."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to view this session status."
            )
    elif current_user.role == "recruiter":
        res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == current_user.id))
        recruiter = res_r.scalar_one_or_none()
        if not recruiter:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: Recruiter profile not found.")
        is_authorized = False
        if session.recruiter_id and session.recruiter_id == recruiter.id:
            is_authorized = True
        elif session.scheduled_interview_id:
            sched_res = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == session.scheduled_interview_id))
            sched = sched_res.scalar_one_or_none()
            if sched and sched.recruiter_id == recruiter.id:
                is_authorized = True
        if not is_authorized and session.candidate_id:
            res_app = await db.execute(
                select(JobApplication)
                .join(JobPosting, JobPosting.id == JobApplication.job_id)
                .where(JobApplication.candidate_id == session.candidate_id, JobPosting.recruiter_id == recruiter.id)
            )
            if res_app.scalars().first():
                is_authorized = True
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to view this session status."
            )

    return {
        "session_id": session.id,
        "status": session.status,
        "candidate_id": session.candidate_id,
        "recruiter_id": session.recruiter_id,
        "recording_status": getattr(session, "recording_status", "PENDING"),
        "title": session.title,
        "round_type": session.round_type,
        "question_count": session.question_count,
        "created_at": session.started_at.isoformat() if session.started_at else None
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

    # Determine if interview should continue or terminate based on timer and question count
    next_q_response = None
    
    # Calculate elapsed seconds (prefer frontend elapsed_seconds if sent, otherwise fallback to server time)
    started_at = session.started_at or datetime.utcnow()
    if hasattr(started_at, 'tzinfo') and started_at.tzinfo is not None:
        started_at = started_at.replace(tzinfo=None)
    server_elapsed = (datetime.utcnow() - started_at).total_seconds()
    elapsed_seconds = body.elapsed_seconds if body.elapsed_seconds is not None else server_elapsed
    
    max_duration_seconds = (session.duration_minutes or 15) * 60
    min_questions = session.question_count or 6

    # Terminate if:
    # 1. Timer expired
    # 2. Reached minimum target question count AND at least 75% of configured time elapsed
    # 3. Reached 2x maximum question count safety limit
    timer_expired = elapsed_seconds >= max_duration_seconds
    questions_satisfied = question.order_index >= min_questions and elapsed_seconds >= (max_duration_seconds * 0.75)
    max_safety_limit = question.order_index >= (min_questions * 2)

    should_continue = not (timer_expired or questions_satisfied or max_safety_limit)
    is_transition = False

    if should_continue:
        try:
            # 1. Fetch conversation history for current session (including current answer just flushed)
            history_stmt = (
                select(InterviewQuestion, InterviewAnswer)
                .join(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
                .where(InterviewQuestion.session_id == session.id)
                .order_by(InterviewQuestion.order_index)
            )
            history_res = await db.execute(history_stmt)
            history = history_res.all()
            
            conversation_memory = []
            for h_q, h_a in history:
                conversation_memory.append({
                    "question": h_q.question_text,
                    "answer": h_a.transcript_text or ""
                })

            # 2. Fetch previously asked questions across all past sessions for candidate
            stmt_prev = (
                select(InterviewQuestion.question_text)
                .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
                .where(InterviewSession.candidate_id == session.candidate_id)
            )
            res_prev = await db.execute(stmt_prev)
            previously_asked = list(set(res_prev.scalars().all()))

            # 3. Retrieve context payload from session config
            cfg = session.config_json or {}
            saved_ctx = cfg.get("context_payload", {})

            context_payload = {
                "role": session.role_target,
                "round_type": session.round_type,
                "difficulty": session.difficulty,
                "resume_summary": saved_ctx.get("resume_summary", "Not Available"),
                "resume_skills": saved_ctx.get("resume_skills", []),
                "resume_projects": saved_ctx.get("resume_projects", []),
                "job_description": saved_ctx.get("job_description", "Not Available"),
                "conversation_memory": conversation_memory,
                "previously_asked_questions": previously_asked,
                "previous_question": question.question_text,
                "candidate_answer": body.transcript_text
            }

            # FEATURE 3: Follow-up strategy enforcement (max 1 follow-up per main question)
            # Parallelize question generation and feedback remark generation for low latency (< 3s)
            async def get_next_question():
                if question.is_followup:
                    try:
                        main_q_list = await asyncio.wait_for(
                            QuestionGeneratorService.generate_unique_session_questions(
                                db=db,
                                session=session,
                                context=context_payload,
                                num_questions=1
                            ),
                            timeout=7.5
                        )
                        if main_q_list:
                            main_q_data = main_q_list[0]
                            return InterviewQuestion(
                            session_id=session.id,
                            order_index=question.order_index + 1,
                            question_text=main_q_data.get("question_text", "Let's move on to our next technical topic."),
                            category=str(main_q_data.get("category", "Technical"))[:250],
                            difficulty=str(main_q_data.get("difficulty", question.difficulty))[:90],
                            expected_keywords=main_q_data.get("expected_keywords", []),
                            is_followup=False
                        ), True
                    except Exception as e:
                        logger.warning(f"Fast main question generation fallback: {e}")

                    fallback_pool = [
                        "Can you explain what a function is in programming and why functions are useful?",
                        "In simple terms, what is the difference between a list (or array) and a dictionary (or key-value map)?",
                        "In web development, what is the basic difference between a GET request and a POST request?",
                        "Can you explain what an if-else statement or a loop does in your code?",
                        "What is a database table, and what is the purpose of a primary key in simple terms?",
                        "Could you tell me about a simple project you built or worked on recently and what it does?",
                        "In simple terms, what is the difference between the frontend and the backend of a website?"
                    ]
                    chosen_main = next(
                        (fb for fb in fallback_pool if fb not in previously_asked and fb != question.question_text),
                        fallback_pool[(question.order_index) % len(fallback_pool)]
                    )

                    return InterviewQuestion(
                        session_id=session.id,
                        order_index=question.order_index + 1,
                        question_text=chosen_main,
                        category="Programming Fundamentals",
                        difficulty="Easy",
                        expected_keywords=["basics", "programming", "simplicity"],
                        is_followup=False
                    ), True
                else:
                    try:
                        next_q_data = await asyncio.wait_for(
                            QuestionGeneratorService.generate_dynamic_followup_question(
                                context=context_payload
                            ),
                            timeout=7.5
                        )
                        return InterviewQuestion(
                            session_id=session.id,
                            order_index=question.order_index + 1,
                            question_text=next_q_data.get("question_text", "Could you elaborate further on that?"),
                            category=str(next_q_data.get("category", "Follow-up"))[:250],
                            difficulty=str(next_q_data.get("difficulty", question.difficulty))[:90],
                            expected_keywords=next_q_data.get("expected_keywords", []),
                            is_followup=True
                        ), False
                    except Exception as e:
                        logger.warning(f"Fast followup question fallback: {e}")
                        fallback_followups = [
                            "Thank you for that explanation. Could you walk me through the key technical trade-offs you considered?",
                            "Could you elaborate on how you handled edge cases and failure modes in that architecture?",
                            "What metrics or logging did you rely on to verify that your implementation met latency and stability requirements?",
                            "If you were to re-architect that solution to handle 100x the traffic today, what would you change?"
                        ]
                        chosen_followup = next(
                            (ff for ff in fallback_followups if ff not in previously_asked and ff != question.question_text),
                            fallback_followups[(question.order_index) % len(fallback_followups)]
                        )
                        return InterviewQuestion(
                            session_id=session.id,
                            order_index=question.order_index + 1,
                            question_text=chosen_followup,
                            category="Follow-up",
                            difficulty=str(question.difficulty or "Medium")[:90],
                            expected_keywords=["trade-offs", "scalability", "reliability"],
                            is_followup=True
                        ), False

            async def get_feedback():
                try:
                    return await asyncio.wait_for(
                        ai_engine.evaluate_candidate_answer(
                            question_text=question.question_text,
                            candidate_answer=body.transcript_text,
                            role=session.role_target,
                            is_transition=question.is_followup,
                            next_topic=None
                        ),
                        timeout=2.8
                    )
                except Exception as e:
                    logger.warning(f"AI evaluation remark timeout/error: {e}")
                    if question.is_followup:
                        return "Well done! Thanks for explaining that clearly. Let's move to the next topic."
                    return "Good answer! That is a solid explanation. Let's probe a bit further into that."

            try:
                q_res, evaluation_feedback = await asyncio.gather(
                    get_next_question(),
                    get_feedback(),
                    return_exceptions=False
                )
                next_q_db, is_trans = q_res
                db.add(next_q_db)
                await db.flush()

                next_q_response = {
                    "question_id": next_q_db.id,
                    "session_id": session.id,
                    "order_index": next_q_db.order_index,
                    "question_text": next_q_db.question_text,
                    "category": next_q_db.category,
                    "difficulty": next_q_db.difficulty,
                    "is_followup": next_q_db.is_followup
                }
                try:
                    asyncio.create_task(_prewarm_tts(next_q_db.question_text))
                except Exception:
                    pass
            except Exception as dynamic_q_err:
                logger.error(f"Dynamic Question Generation Error: {dynamic_q_err}")
                try:
                    await db.rollback()
                    # Re-persist the current answer so candidate work is never lost
                    db.add(answer)
                    db.add(speech_db)
                    db.add(vision_db)
                    db.add(emotion_db)
                    await db.flush()
                except Exception as rb_err:
                    logger.warning(f"Answer re-persistence notice after rollback: {rb_err}")
                next_q_response = None
                evaluation_feedback = "Thank you. We have concluded this portion of the interview."
        except Exception as dynamic_q_err:
            logger.error(f"Dynamic Question Pipeline Error: {dynamic_q_err}")
            next_q_response = None
            evaluation_feedback = "Thank you. We have concluded this portion of the interview."

    # If interview is ending, finalize session state promptly without blocking API response
    if not next_q_response:
        session.status = "completed"
        if 'evaluation_feedback' not in locals() or not evaluation_feedback:
            evaluation_feedback = "Thank you. Your interview is now complete."

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
        "interviewer_remark": evaluation_feedback,
        "next_question": next_q_response
    }

@router.post("/finish/{session_id}", summary="Explicitly finish interview session and generate report")
async def finish_interview_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Explicitly marks an interview session as completed and generates full PostgreSQL report."""
    try:
        res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        if current_user.role == "candidate":
            res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
            cands = res_c.scalars().all()
            cand_ids = [c.id for c in cands]
            if not cands:
                candidate = Candidate(user_id=current_user.id, target_role="Software Engineer")
                db.add(candidate)
                await db.flush()
                cand_ids = [candidate.id]
            if session.candidate_id and cand_ids and session.candidate_id not in cand_ids:
                raise HTTPException(status_code=403, detail="Unauthorized access to another candidate's interview session.")
            elif session.candidate_id is None and cand_ids:
                session.candidate_id = cand_ids[0]

        report = await EvaluationService.generate_and_finalize_report(db, session_id)
        return {
            "status": "completed",
            "session_id": session_id,
            "overall_score": getattr(report, "overall_score", 80.0) if report else 80.0,
            "recommendation": getattr(report, "recommendation", "Shortlist") if report else "Shortlist"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finishing session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Finish session error: {type(e).__name__} - {str(e)}")

@router.get("/session/{session_id}", summary="Get active interview session details")
async def get_interview_session_details(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found.")

        # Candidate & Recruiter Access Control
        if current_user and current_user.role == "candidate":
            res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
            cand = res_c.scalar_one_or_none()
            if cand and session.candidate_id and session.candidate_id != cand.id and session.interview_type not in ("Mock", "Practice"):
                raise HTTPException(status_code=403, detail="Unauthorized access to this interview session.")
        elif current_user and current_user.role == "recruiter":
            res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == current_user.id))
            rec = res_r.scalar_one_or_none()
            if rec and session.recruiter_id and session.recruiter_id != rec.id and current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Unauthorized recruiter access to this session.")

        cand_name = "Candidate"
        if session.candidate_id:
            cand_res = await db.execute(
                select(User.full_name)
                .join(Candidate, Candidate.user_id == User.id)
                .where(Candidate.id == session.candidate_id)
            )
            name_val = cand_res.scalar_one_or_none()
            if name_val:
                cand_name = name_val

        q_res = await db.execute(
            select(InterviewQuestion)
            .where(InterviewQuestion.session_id == session_id)
            .order_by(InterviewQuestion.order_index)
        )
        db_questions = q_res.scalars().all()

        a_res = await db.execute(
            select(InterviewAnswer.question_id)
            .join(InterviewQuestion, InterviewQuestion.id == InterviewAnswer.question_id)
            .where(InterviewQuestion.session_id == session_id)
        )
        answered_ids = set(a_res.scalars().all())

        questions_list = []
        current_q = None
        for q in db_questions:
            q_dict = {
                "question_id": q.id,
                "id": q.id,
                "session_id": session.id,
                "order_index": q.order_index,
                "question_text": q.question_text,
                "category": q.category,
                "difficulty": q.difficulty,
                "is_followup": q.is_followup
            }
            questions_list.append(q_dict)
            if not current_q and q.id not in answered_ids:
                current_q = q_dict

        if not current_q and questions_list:
            current_q = questions_list[-1]

        if current_q and "question_text" in current_q:
            try:
                asyncio.create_task(_prewarm_tts(current_q["question_text"]))
            except Exception:
                pass

        return {
            "session_id": session.id,
            "title": session.title,
            "role_target": session.role_target,
            "round_type": session.round_type,
            "difficulty": session.difficulty,
            "duration_minutes": session.duration_minutes,
            "status": session.status,
            "candidate_name": cand_name,
            "total_questions": session.question_count or len(questions_list) or 6,
            "first_question": current_q or (questions_list[0] if questions_list else None),
            "current_question": current_q,
            "questions": questions_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report/{session_id}")
@router.get("/evaluation/{session_id}")
async def get_session_report(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        import time
        t_start = time.perf_counter()

        res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found.")

        if current_user.role == "candidate":
            res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
            cands = res_c.scalars().all()
            cand_ids = [c.id for c in cands]
            if not cands or (session.candidate_id and session.candidate_id not in cand_ids):
                raise HTTPException(status_code=403, detail="Unauthorized access to another candidate's interview session.")
        elif current_user.role == "recruiter":
            res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == current_user.id))
            rec = res_r.scalar_one_or_none()
            if not rec:
                raise HTTPException(status_code=403, detail="Recruiter profile not found.")
            res_j = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == rec.id))
            rec_job_ids = res_j.scalars().all()

            is_own_job = session.job_id in rec_job_ids if session.job_id else False
            is_own_recruiter = session.recruiter_id == rec.id if session.recruiter_id else False
            if session.job_application_id:
                res_app = await db.execute(select(JobApplication.job_id).where(JobApplication.id == session.job_application_id))
                app_job_id = res_app.scalar_one_or_none()
                if app_job_id in rec_job_ids:
                    is_own_job = True

            if not (is_own_job or is_own_recruiter) and current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Unauthorized recruiter access to this evaluation.")

        # Generate / finalize evaluation report (returns stored immutable DB record if completed)
        report = await EvaluationService.generate_and_finalize_report(db, session_id)

        # Fetch recording metadata directly
        res_rec = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id == session_id))
        rec_obj = res_rec.scalars().first()

        # Fetch per-question Q&A transcript breakdown from DB
        stmt_qa = (
            select(InterviewQuestion, InterviewAnswer)
            .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
            .where(InterviewQuestion.session_id == session_id)
            .order_by(InterviewQuestion.order_index)
        )
        res_qa = await db.execute(stmt_qa)
        qa_pairs = res_qa.all()

        # Prepare accurate question evaluations
        raw_evals = getattr(report, "question_evaluations", None) or []
        ans_map = {q_inst.id: (a_inst.transcript_text.strip() if a_inst and a_inst.transcript_text and a_inst.transcript_text.strip() else None) for q_inst, a_inst in qa_pairs}

        final_evals = []
        if raw_evals:
            for idx, ev in enumerate(raw_evals):
                ev_copy = dict(ev)
                qid = ev_copy.get("question_id")
                actual_ans = ans_map.get(qid)
                if not actual_ans and idx < len(qa_pairs):
                    actual_ans = ans_map.get(qa_pairs[idx][0].id)
                    
                if actual_ans:
                    ev_copy["candidate_answer"] = actual_ans
                    all_kws = list(dict.fromkeys((ev_copy.get("covered_concepts") or []) + (ev_copy.get("missing_concepts") or [])))
                    if not all_kws and idx < len(qa_pairs):
                        raw_qkws = qa_pairs[idx][0].expected_keywords or []
                        all_kws = [k.get("skill_name", str(k)) if isinstance(k, dict) else str(k) for k in raw_qkws]
                    if all_kws:
                        covered = [kw for kw in all_kws if technical_evaluator._is_concept_covered(kw, actual_ans)]
                        missing = [kw for kw in all_kws if kw not in covered]
                        ev_copy["covered_concepts"] = covered
                        ev_copy["missing_concepts"] = missing
                final_evals.append(ev_copy)
        else:
            for idx, (q_inst, a_inst) in enumerate(qa_pairs):
                ans_text = a_inst.transcript_text.strip() if a_inst and a_inst.transcript_text else None
                raw_qkws = q_inst.expected_keywords or []
                all_kws = [k.get("skill_name", str(k)) if isinstance(k, dict) else str(k) for k in raw_qkws]
                covered = [kw for kw in all_kws if ans_text and technical_evaluator._is_concept_covered(kw, ans_text)]
                missing = [kw for kw in all_kws if kw not in covered]
                final_evals.append({
                    "question_id": q_inst.id,
                    "question_text": q_inst.question_text,
                    "category": q_inst.category or session.round_type or "Technical",
                    "difficulty": q_inst.difficulty or session.difficulty or "Medium",
                    "candidate_answer": ans_text or "No response recorded",
                    "score": 85.0 if ans_text else 0.0,
                    "feedback": "Answer evaluated and recorded." if ans_text else "No response provided for evaluation.",
                    "covered_concepts": covered,
                    "missing_concepts": missing
                })

        t_db_read = (time.perf_counter() - t_start) * 1000
        print("\n" + "=" * 50)
        print("REPORT PERFORMANCE (HISTORY FETCH)")
        print(f"Database Read: {t_db_read:.1f} ms")
        print(f"Total Time: {t_db_read:.1f} ms")
        print("=" * 50 + "\n")

        has_rec = bool(rec_obj and rec_obj.file_size and rec_obj.file_size > 500)
        rec_path = rec_obj.file_path if rec_obj else None
        if not has_rec and rec_path:
            has_rec = storage_service.exists(rec_path)

        ovr_score = getattr(report, "overall_score", 78.0) if report else 78.0
        return {
            "id": getattr(report, "id", f"rep-{session_id}") or f"rep-{session_id}",
            "session_id": session_id,
            "session_title": session.title,
            "role_target": session.role_target,
            "round_type": session.round_type,
            "recording_file_path": rec_path if has_rec else None,
            "recording_status": getattr(rec_obj, "status", "AVAILABLE" if has_rec else "PENDING"),
            "has_recording": has_rec,
            "communication_score": getattr(report, "communication_score", 80.0) or 80.0,
            "confidence_score": getattr(report, "confidence_score", 80.0) or 80.0,
            "technical_score": getattr(report, "technical_score", 85.0) or 85.0,
            "professionalism_score": getattr(report, "professionalism_score", 85.0) or 85.0,
            "grammar_score": getattr(report, "grammar_score", 85.0) or 85.0,
            "problem_solving_score": getattr(report, "problem_solving_score", 84.0) or 84.0,
            "behavior_score": getattr(report, "behavior_score", 82.0) or 82.0,
            "leadership_score": getattr(report, "leadership_score", 78.0) or 78.0,
            "overall_score": ovr_score,
            "recommendation": getattr(report, "recommendation", "Shortlist") or "Shortlist",
            "overall_summary": getattr(report, "overall_summary", "Candidate successfully completed the interview.") or "Candidate successfully completed the interview.",
            "technical_analysis": getattr(report, "technical_analysis", "Solid technical grounding."),
            "communication_analysis": getattr(report, "communication_analysis", "Clear and effective communication."),
            "behavioral_analysis": getattr(report, "behavioral_analysis", "Professional demeanor."),
            "grammar_analysis": getattr(report, "grammar_analysis", "Strong grammatical clarity."),
            "confidence_analysis": getattr(report, "confidence_analysis", "Good eye contact and engagement."),
            "strengths": getattr(report, "strengths", []) or [],
            "weaknesses": getattr(report, "weaknesses", []) or [],
            "improvement_plan": getattr(report, "improvement_plan", []) or [],
            "practice_recommendations": getattr(report, "practice_recommendations", []) or [],
            "learning_resources": getattr(report, "learning_resources", []) or [],
            "communication_metrics": getattr(report, "communication_metrics", {}) or {},
            "confidence_metrics": getattr(report, "confidence_metrics", {}) or {},
            "technical_metrics": getattr(report, "technical_metrics", {}) or {},
            "professionalism_metrics": getattr(report, "professionalism_metrics", {}) or {},
            "speech_timeline": getattr(report, "speech_timeline", []) or [],
            "gaze_timeline": getattr(report, "gaze_timeline", []) or [],
            "emotion_timeline": getattr(report, "emotion_timeline", []) or [],
            "missing_topics": getattr(report, "missing_topics", []) or [],
            "ideal_answers": getattr(report, "ideal_answers", []) or [],
            "practice_suggestions": getattr(report, "practice_suggestions", []) or [],
            "question_evaluations": final_evals,
            "questions": final_evals,
            "model_version": getattr(report, "model_version", "smart-hire-v2.0.0"),
            "analysis_version": getattr(report, "analysis_version", "evidence_based_v2"),
            "rating_rubric": f"Overall Rating: {round(ovr_score, 1)}%"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session report for {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report fetch error: {type(e).__name__} - {str(e)}")

@router.get("/history", response_model=List[Dict[str, Any]])
async def get_interview_history(
    candidate_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches interview history strictly isolated to authenticated candidate, or to authenticated recruiter's job requisitions."""
    sessions = []
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cands = res_c.scalars().all()
        cand_ids = [c.id for c in cands]
        all_cand_ids = list(set(cand_ids + [current_user.id]))
        res_apps = await db.execute(select(JobApplication.id).where(JobApplication.candidate_id.in_(all_cand_ids)))
        app_ids = [a for a in res_apps.scalars().all()]

        condition = InterviewSession.candidate_id.in_(all_cand_ids)
        if app_ids:
            condition = or_(condition, InterviewSession.job_application_id.in_(app_ids))

        res = await db.execute(
            select(InterviewSession)
            .where(condition)
            .order_by(InterviewSession.started_at.desc())
        )
        sessions = res.scalars().all()
    elif current_user.role == "recruiter":
        res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == current_user.id))
        rec = res_r.scalar_one_or_none()
        if not rec:
            return []
        res_j = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == rec.id))
        job_ids = res_j.scalars().all()
        if not job_ids:
            return []
        res_a = await db.execute(select(JobApplication.id).where(JobApplication.job_id.in_(job_ids)))
        app_ids = res_a.scalars().all()

        stmt = select(InterviewSession).where(
            or_(
                InterviewSession.job_id.in_(job_ids),
                InterviewSession.job_application_id.in_(app_ids)
            ),
            InterviewSession.interview_type != "Mock"
        )
        if candidate_id:
            stmt = stmt.where(InterviewSession.candidate_id == candidate_id)
        stmt = stmt.order_by(InterviewSession.started_at.desc())
        res = await db.execute(stmt)
        sessions = res.scalars().all()
    elif current_user.role == "admin":
        stmt = select(InterviewSession)
        if candidate_id:
            stmt = stmt.where(InterviewSession.candidate_id == candidate_id)
        stmt = stmt.order_by(InterviewSession.started_at.desc())
        res = await db.execute(stmt)
        sessions = res.scalars().all()
    else:
        return []

    if not sessions:
        return []

    session_ids = [s.id for s in sessions]
    session_candidate_ids = list({s.candidate_id for s in sessions if s.candidate_id})
    session_job_ids = list({s.job_id for s in sessions if s.job_id})

    # Batch query candidate user info
    cand_map = {}
    if session_candidate_ids:
        res_c = await db.execute(
            select(Candidate.id, User.full_name, User.email)
            .join(User, Candidate.user_id == User.id)
            .where(Candidate.id.in_(session_candidate_ids))
        )
        for c_id, f_name, em in res_c.all():
            cand_map[c_id] = {"name": f_name or "Candidate", "email": em or ""}

    # Batch query job titles
    job_map = {}
    if session_job_ids:
        res_j = await db.execute(select(JobPosting.id, JobPosting.title).where(JobPosting.id.in_(session_job_ids)))
        for j_id, j_title in res_j.all():
            job_map[j_id] = j_title

    # Batch query reports, question counts, and recordings in 3 parallel/instant queries
    from sqlalchemy import func
    res_reps = await db.execute(select(ScoringReport).where(ScoringReport.session_id.in_(session_ids)))
    reports_map = {r.session_id: r for r in res_reps.scalars().all()}

    res_q = await db.execute(
        select(InterviewQuestion.session_id, func.count(InterviewQuestion.id))
        .where(InterviewQuestion.session_id.in_(session_ids))
        .group_by(InterviewQuestion.session_id)
    )
    q_counts_map = dict(res_q.all())

    res_recs = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id.in_(session_ids)))
    recs_map = {r.session_id: r for r in res_recs.scalars().all() if (r.file_size or 0) > 500}

    history = []
    for s in sessions:
        rep = reports_map.get(s.id)
        score = round(rep.overall_score, 1) if (rep and rep.overall_score is not None) else None
        rec = rep.recommendation if (rep and rep.recommendation) else "Pending"
        q_count = q_counts_map.get(s.id, s.question_count or 6)
        rec_obj = recs_map.get(s.id)
        has_rec = bool(rec_obj)
        rec_path = rec_obj.file_path if rec_obj else None

        cand_info = cand_map.get(s.candidate_id, {})
        job_title = job_map.get(s.job_id)
        display_title = s.title or (f"{s.round_type or 'Technical'} Interview - {cand_info.get('name')}" if cand_info.get("name") else (job_title or s.role_target or "Interview"))

        history.append({
            "id": s.id,
            "session_id": s.id,
            "title": display_title,
            "role_target": job_title or s.role_target or "Software Engineer",
            "candidate_id": s.candidate_id,
            "candidate_name": cand_info.get("name"),
            "candidate_email": cand_info.get("email"),
            "job_id": s.job_id,
            "job_title": job_title,
            "round_type": s.round_type or "Technical",
            "interview_type": s.interview_type or "Mock",
            "duration_minutes": s.duration_minutes or 30,
            "question_count": q_count,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "score": score,
            "overall_score": score,
            "recommendation": rec,
            "has_recording": has_rec,
            "recording_file_path": rec_path,
            "strengths": rep.strengths if (rep and rep.strengths) else [],
            "weaknesses": rep.weaknesses if (rep and rep.weaknesses) else [],
            "technical_score": rep.technical_score if rep else None,
            "communication_score": rep.communication_score if rep else None,
            "confidence_score": rep.confidence_score if rep else None,
            "professionalism_score": rep.professionalism_score if rep else None,
        })

    return history

@router.get("/report/{session_id}/pdf")
@router.get("/report/{session_id}/download")
@router.get("/reports/{session_id}/download")
async def get_session_pdf_report(
    session_id: str,
    round: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates and downloads an authoritative enterprise PDF evaluation report for an interview session."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        res_app = await db.execute(select(JobApplication).where(JobApplication.id == session_id))
        app_obj = res_app.scalar_one_or_none()
        if app_obj:
            from app.api.v1.recruiter import download_evaluation_report_pdf
            return await download_evaluation_report_pdf(session_id, round=round or "combined", db=db)
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if round and round.lower() in ["assessment", "mock", "online_assessment", "combined", "all", "master"] and session.job_application_id:
        from app.api.v1.recruiter import download_evaluation_report_pdf
        return await download_evaluation_report_pdf(session.job_application_id, round=round, db=db)

    # Authorization check
    cand_obj = None
    cand_user = None
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or (session.candidate_id and session.candidate_id != candidate.id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this candidate report.")
        cand_obj = candidate
        cand_user = current_user
    elif current_user.role == "recruiter":
        res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == current_user.id))
        recruiter = res_r.scalar_one_or_none()
        if recruiter and session.recruiter_id and session.recruiter_id != recruiter.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized recruiter access to this report.")

    if not cand_user and session.candidate_id:
        res_c = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
        cand_obj = res_c.scalar_one_or_none()
        if cand_obj and cand_obj.user_id:
            res_u = await db.execute(select(User).where(User.id == cand_obj.user_id))
            cand_user = res_u.scalar_one_or_none()

    # Generate / Fetch report
    report = await EvaluationService.generate_and_finalize_report(db, session_id)

    # Fetch Q&A transcript entries
    stmt = (
        select(InterviewQuestion, InterviewAnswer)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.order_index)
    )
    results = await db.execute(stmt)
    pairs = results.all()

    # Build Q&A evaluation lookup
    eval_lookup = {}
    for q_eval in (report.question_evaluations or []):
        if isinstance(q_eval, dict):
            q_txt = q_eval.get("question_text") or q_eval.get("question")
            if q_txt:
                eval_lookup[q_txt] = q_eval

    transcript_list = []
    for q, a in pairs:
        q_meta = eval_lookup.get(q.question_text) or {}
        transcript_list.append({
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "is_followup": q.is_followup,
            "answer_text": a.transcript_text if a else None,
            "technical_score": q_meta.get("technical_score") or q_meta.get("score"),
            "covered_concepts": q_meta.get("covered_concepts") or q_meta.get("concepts_covered") or [],
            "missing_concepts": q_meta.get("missing_concepts") or q_meta.get("concepts_missing") or [],
            "recommendation": q_meta.get("recommendation")
        })

    # Fetch real integrity summary
    integrity_summary = None
    try:
        integrity_summary = await integrity_service.get_session_integrity_summary(db, session_id)
    except Exception as e_int:
        logger.warning("Could not load integrity summary for PDF: %s", e_int)

    # Company name resolution
    company_name = "SmartHire AI Platform"
    if session.job_application_id:
        res_app = await db.execute(select(JobApplication).where(JobApplication.id == session.job_application_id))
        app_obj = res_app.scalar_one_or_none()
        if app_obj and app_obj.job_id:
            res_jp = await db.execute(select(JobPosting).where(JobPosting.id == app_obj.job_id))
            jp = res_jp.scalar_one_or_none()
            if jp:
                company_name = jp.company_name

    session_info = {
        "title": session.title,
        "role_target": session.role_target or (cand_obj.target_role if cand_obj else "Software Engineer"),
        "round_type": session.round_type or "Technical",
        "interview_type": session.interview_type or "Simulation",
        "candidate_name": cand_user.full_name if cand_user else "Candidate User",
        "candidate_email": cand_user.email if cand_user else "N/A",
        "company_name": company_name,
        "date": (getattr(session, "started_at", None) or getattr(session, "created_at", None) or datetime.utcnow()).strftime("%b %d, %Y at %I:%M %p"),
        "session_id": session.id
    }

    report_dict = {
        "overall_score": report.overall_score,
        "communication_score": report.communication_score,
        "confidence_score": report.confidence_score,
        "technical_score": report.technical_score,
        "professionalism_score": report.professionalism_score,
        "grammar_score": report.grammar_score,
        "problem_solving_score": report.problem_solving_score,
        "behavior_score": report.behavior_score,
        "leadership_score": report.leadership_score,
        "recommendation": report.recommendation,
        "overall_summary": report.overall_summary,
        "strengths": report.strengths or [],
        "weaknesses": report.weaknesses or [],
        "communication_metrics": report.communication_metrics or {},
        "confidence_metrics": report.confidence_metrics or {},
        "technical_metrics": report.technical_metrics or {},
        "integrity_score": getattr(session, "integrity_score", 100.0),
        "integrity_status": getattr(session, "integrity_status", "CLEAN"),
        "model_version": report.model_version or "smart-hire-v2.0.0",
        "analysis_version": report.analysis_version or "evidence_based_v2"
    }

    pdf_bytes = pdf_generator.generate_interview_pdf(
        session_info=session_info,
        report_data=report_dict,
        transcript_data=transcript_list,
        integrity_summary=integrity_summary
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Interview_Report_{session_id}.pdf"}
    )

@router.get("/transcript/{session_id}", response_model=Dict[str, Any])
async def get_session_transcript(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the full Q&A transcript for an interview session."""
    res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Authorization check
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    # Fetch questions and answers
    stmt = (
        select(InterviewQuestion, InterviewAnswer)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.order_index)
    )
    results = await db.execute(stmt)
    pairs = results.all()

    transcript = []
    for q, a in pairs:
        entry = {
            "question_id": q.id,
            "order_index": q.order_index,
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "is_followup": q.is_followup,
            "answer_text": a.transcript_text if a else None,
            "answer_id": a.id if a else None
        }

        # Fetch speech analysis for this answer
        if a:
            speech_res = await db.execute(select(SpeechAnalysis).where(SpeechAnalysis.answer_id == a.id))
            speech = speech_res.scalar_one_or_none()
            if speech:
                entry["speaking_pace_wpm"] = speech.speaking_pace_wpm
                entry["filler_word_count"] = speech.filler_word_count

            emotion_res = await db.execute(select(EmotionAnalysis).where(EmotionAnalysis.answer_id == a.id))
            emotion = emotion_res.scalar_one_or_none()
            if emotion:
                entry["dominant_emotion"] = emotion.dominant_emotion
                entry["confidence_percentage"] = emotion.confidence_percentage

        transcript.append(entry)

    return {
        "session_id": session_id,
        "title": session.title,
        "role_target": session.role_target,
        "round_type": session.round_type,
        "status": session.status,
        "total_questions": len(transcript),
        "transcript": transcript,
        "questions": transcript
    }

@router.get("/mock-history", response_model=List[Dict[str, Any]], summary="Get Candidate Mock Practice History Cards")
async def get_mock_interview_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches candidate mock practice interview sessions with performance metrics, scores, and improvements."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand:
        return []

    res_sess = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.candidate_id == cand.id)
        .order_by(InterviewSession.started_at.desc())
    )
    sessions = res_sess.scalars().all()

    session_ids = [s.id for s in sessions]
    reports_map = {}
    if session_ids:
        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id.in_(session_ids)))
        reports_map = {r.session_id: r for r in res_rep.scalars().all()}

    out = []
    for s in sessions:
        rep = reports_map.get(s.id)

        out.append({
            "session_id": s.id,
            "title": s.title or f"{s.role_target} ({s.round_type})",
            "role_target": s.role_target,
            "round_type": s.round_type or "Technical",
            "difficulty": s.difficulty or "Medium",
            "duration_minutes": s.duration_minutes or 15,
            "interview_type": s.interview_type or "Mock",
            "status": s.status,
            "integrity_status": s.integrity_status or "CLEAN",
            "integrity_score": s.integrity_score if s.integrity_score is not None else 100.0,
            "total_integrity_incidents": s.total_integrity_incidents or 0,
            "termination_reason": s.termination_reason,
            "date": s.started_at.strftime('%b %d, %Y') if s.started_at else "Recent",
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "overall_score": round(rep.overall_score, 1) if (rep and rep.overall_score is not None) else None,
            "technical_score": round(rep.technical_score, 1) if (rep and rep.technical_score is not None) else None,
            "communication_score": round(rep.communication_score, 1) if (rep and rep.communication_score is not None) else None,
            "recommendation": rep.recommendation if (rep and rep.recommendation) else ("Interview Pending" if s.status != "completed" else "Shortlist"),
            "strengths": rep.strengths if rep else [],
            "weaknesses": rep.weaknesses if rep else []
        })
    return out

# --- INTEGRITY MONITORING & TERMINATION ENDPOINTS ---

from app.services.integrity_service import integrity_service

@router.post("/{session_id}/integrity-events", summary="Record or Update Live Integrity Incident")
async def record_integrity_event(
    session_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Records a debounced candidate integrity incident or resolves an active incident."""
    res_sess = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_sess.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand and current_user.role == "candidate":
        cand = Candidate(user_id=current_user.id, target_role=session.role_target or "Software Engineer")
        db.add(cand)
        await db.flush()
    cand_id = cand.id if cand else session.candidate_id

    if current_user.role == "candidate":
        if session.candidate_id and cand and session.candidate_id != cand.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this interview session.")
        elif session.candidate_id is None and cand:
            session.candidate_id = cand.id

    try:
        event, summary = await integrity_service.record_or_update_event(
            db=db,
            session_id=session_id,
            candidate_id=cand_id,
            data=payload
        )
        return {
            "success": True,
            "event_id": event.id,
            "event_type": event.event_type,
            "status": event.status,
            "duration_seconds": event.duration_seconds,
            "summary": summary
        }
    except Exception as e:
        logger.error("Failed to record integrity event: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/integrity-events", summary="Get Full Integrity Timeline Events")
async def get_integrity_events(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all timestamped integrity events for recruiter audit."""
    try:
        summary = await integrity_service.get_session_integrity_summary(db, session_id)
        return summary.get("timeline", [])
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to fetch integrity events: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/integrity-summary", summary="Get Complete Integrity Metrics Summary")
async def get_integrity_summary(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Calculates deterministic integrity score, status, and breakdown by violation type."""
    try:
        return await integrity_service.get_session_integrity_summary(db, session_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to fetch integrity summary: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/terminate", summary="Enforce Immediate Integrity Auto-Termination")
async def terminate_interview_session(
    session_id: str,
    payload: Dict[str, Any] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Automatically terminates the interview session due to tab switching or severe integrity breach."""
    res_sess = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_sess.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand and current_user.role == "candidate":
        cand = Candidate(user_id=current_user.id, target_role=session.role_target or "Software Engineer")
        db.add(cand)
        await db.flush()
    cand_id = cand.id if cand else session.candidate_id

    if current_user.role == "candidate":
        if session.candidate_id and cand and session.candidate_id != cand.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this interview session.")
        elif session.candidate_id is None and cand:
            session.candidate_id = cand.id

    reason = (payload or {}).get("reason") or "TAB_SWITCH"
    metadata = (payload or {}).get("metadata") or {}

    try:
        summary = await integrity_service.terminate_session(
            db=db,
            session_id=session_id,
            candidate_id=cand_id,
            reason=reason,
            metadata=metadata
        )
        return {
            "success": True,
            "status": "TERMINATED",
            "reason": reason,
            "summary": summary
        }
    except Exception as e:
        logger.error("Failed to terminate interview session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/transcript-segments")
async def record_transcript_segment(
    session_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Persists real-time candidate or AI interviewer transcript segments continuously."""
    res_sess = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_sess.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand and current_user.role == "candidate":
        cand = Candidate(user_id=current_user.id, target_role=session.role_target or "Software Engineer")
        db.add(cand)
        await db.flush()
    cand_id = cand.id if cand else session.candidate_id

    if current_user.role == "candidate":
        if session.candidate_id and cand and session.candidate_id != cand.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this interview session.")
        elif session.candidate_id is None and cand:
            session.candidate_id = cand.id

    text = payload.get("text", "").strip()
    if not text:
        return {"status": "ignored", "message": "Empty text"}

    segment = InterviewTranscriptSegment(
        session_id=session_id,
        candidate_id=cand_id,
        question_id=payload.get("question_id"),
        speaker=payload.get("speaker", "CANDIDATE"),
        text=text,
        start_time=float(payload.get("start_time", 0.0)),
        end_time=float(payload.get("end_time", 0.0)),
        duration=float(payload.get("duration", 0.0)),
        sequence_number=int(payload.get("sequence_number", 1)),
        confidence=float(payload.get("confidence", 1.0))
    )
    db.add(segment)
    await db.commit()
    await db.refresh(segment)

    return {
        "success": True,
        "segment_id": segment.id,
        "sequence_number": segment.sequence_number
    }

@router.get("/{session_id}/transcript-segments")
async def get_transcript_segments(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all chronological transcript segments for a given interview session."""
    res_segs = await db.execute(
        select(InterviewTranscriptSegment)
        .where(InterviewTranscriptSegment.session_id == session_id)
        .order_by(InterviewTranscriptSegment.sequence_number.asc())
    )
    segs = res_segs.scalars().all()
    return [
        {
            "id": s.id,
            "speaker": s.speaker,
            "text": s.text,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "duration": s.duration,
            "sequence_number": s.sequence_number,
            "confidence": s.confidence,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in segs
    ]

import base64
from PIL import Image
from ml.emotion.inference import emotion_inference_engine

@router.post("/{session_id}/infer-visual-frame")
async def infer_visual_frame(
    session_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Real-time Camera Frame Inference Endpoint:
    Receives candidate face frame from webcam, executes inference on the trained 7-class CNN model,
    applies temporal EMA smoothing, records InterviewVisualObservation, and returns predictions.
    """
    res_sess = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_sess.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()
    if not cand and current_user.role == "candidate":
        cand = Candidate(user_id=current_user.id, target_role=session.role_target or "Software Engineer")
        db.add(cand)
        await db.flush()
    cand_id = cand.id if cand else session.candidate_id

    if current_user.role == "candidate":
        if session.candidate_id and cand and session.candidate_id != cand.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this interview session.")
        elif session.candidate_id is None and cand:
            session.candidate_id = cand.id

    face_detected = payload.get("face_detected", True)
    frame_b64 = payload.get("frame_base64") or payload.get("image_base64")
    pil_img = None

    if frame_b64 and face_detected:
        try:
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",")[1]
            img_bytes = base64.b64decode(frame_b64)
            pil_img = Image.open(io.BytesIO(img_bytes))
        except Exception as e:
            logger.warning("Error decoding base64 face frame: %s", e)

    # Run real model inference using trained checkpoint
    prediction = emotion_inference_engine.predict_face_image(pil_img if face_detected else None)

    # Record observation to database
    record = InterviewVisualObservation(
        session_id=session_id,
        candidate_id=cand_id,
        timestamp=float(payload.get("timestamp", 0.0)),
        face_detected=bool(face_detected),
        face_confidence=float(payload.get("face_confidence", 1.0 if face_detected else 0.0)),
        head_yaw=float(payload.get("head_yaw", 0.0)),
        head_pitch=float(payload.get("head_pitch", 0.0)),
        head_roll=float(payload.get("head_roll", 0.0)),
        gaze_horizontal=float(payload.get("gaze_horizontal", 0.0)),
        gaze_vertical=float(payload.get("gaze_vertical", 0.0)),
        eye_contact_state=payload.get("eye_contact_state", "LOOKING_AT_CAMERA" if face_detected else "UNCERTAIN"),
        emotion=prediction.get("dominant_emotion", "neutral"),
        emotion_confidence=float(prediction.get("confidence", 1.0)),
        attention_state=payload.get("attention_state", "FOCUSED" if face_detected else "AWAY"),
        model_version=prediction.get("model_version", "smart-hire-behavior-v2.0"),
        probability_distribution=prediction.get("probabilities", {}),
        observation_status="NO_FACE" if not face_detected else ("UNCERTAIN" if prediction.get("dominant_emotion") == "UNCERTAIN" else "VALID")
    )
    db.add(record)
    await db.commit()

    return {
        "success": True,
        "prediction": prediction,
        "timestamp": payload.get("timestamp", 0.0)
    }

@router.post("/{session_id}/visual-observations")
async def record_visual_observations(
    session_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Batch records real-time visual telemetry observations (gaze, head pose, emotion) sampled from client."""
    res_sess = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_sess.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    cand = res_c.scalar_one_or_none()

    if current_user.role == "candidate":
        if session.candidate_id and cand and session.candidate_id != cand.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this interview session.")
        elif session.candidate_id is None and cand:
            session.candidate_id = cand.id

    cand_id = cand.id if cand else session.candidate_id

    observations_data = payload.get("observations", [])
    if not observations_data and "timestamp" in payload:
        observations_data = [payload]

    def safe_float(val, default=0.0):
        try:
            return float(val) if val is not None else default
        except (ValueError, TypeError):
            return default

    added = 0
    for obs in observations_data:
        if not isinstance(obs, dict):
            continue
        record = InterviewVisualObservation(
            session_id=session_id,
            candidate_id=cand_id,
            timestamp=safe_float(obs.get("timestamp"), 0.0),
            face_detected=bool(obs.get("face_detected", True)),
            face_confidence=safe_float(obs.get("face_confidence"), 1.0),
            head_yaw=safe_float(obs.get("head_yaw"), 0.0),
            head_pitch=safe_float(obs.get("head_pitch"), 0.0),
            head_roll=safe_float(obs.get("head_roll"), 0.0),
            gaze_horizontal=safe_float(obs.get("gaze_horizontal"), 0.0),
            gaze_vertical=safe_float(obs.get("gaze_vertical"), 0.0),
            eye_contact_state=str(obs.get("eye_contact_state") or "LOOKING_AT_CAMERA"),
            emotion=str(obs.get("emotion") or "neutral"),
            emotion_confidence=safe_float(obs.get("emotion_confidence"), 1.0),
            attention_state=str(obs.get("attention_state") or "FOCUSED"),
            model_version=str(obs.get("model_version") or "smart-hire-behavior-v2.0"),
            probability_distribution=obs.get("probability_distribution") if isinstance(obs.get("probability_distribution"), dict) else {},
            observation_status=str(obs.get("observation_status") or "VALID")
        )
        db.add(record)
        added += 1

    await db.commit()
    return {"success": True, "count": added}


# -----------------------------------------------------------------------------
# Neural AI Interviewer Text-To-Speech (TTS) Endpoint
# -----------------------------------------------------------------------------
class TTSPayload(BaseModel):
    text: str
    voice: Optional[str] = "en-US-AriaNeural"

@router.post("/tts", summary="Synthesize High-Fidelity Neural Speech Audio")
async def generate_interview_tts(body: TTSPayload):
    """Generates crystal-clear natural human-like voice audio (MP3) for AI Interviewer."""
    raw = (body.text or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    clean_text = re.sub(r'[*_#`~]', '', raw).strip()
    voice = body.voice or "en-US-AriaNeural"
    cache_key = hashlib.md5(f"{voice}:{clean_text}".encode()).hexdigest()

    if cache_key in _tts_cache:
        return Response(content=_tts_cache[cache_key], media_type="audio/mpeg")

    try:
        audio_bytes = await asyncio.wait_for(_synthesize_edge_tts(clean_text, voice), timeout=4.5)
        if audio_bytes:
            if len(_tts_cache) > 120:
                _tts_cache.clear()
            _tts_cache[cache_key] = audio_bytes
            return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.warning(f"Neural TTS failed for text: {e}")

    raise HTTPException(status_code=500, detail="Failed to generate neural audio.")

