import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Response
import pdfplumber
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from app.core.db import get_db
from datetime import datetime
from app.models.domain import InterviewSession, InterviewQuestion, InterviewAnswer, SpeechAnalysis, EyeTracking, EmotionAnalysis, ScoringReport, Candidate, User, ScheduledInterview, JobApplication, JobPosting, Resume, ResumeSkill
from app.services.ai_engine import ai_engine
from app.services.speech_service import speech_service
from app.services.vision_service import vision_service
from app.services.scoring_engine import scoring_engine
from app.services.interview_service import (
    PipelineManager, QuestionGeneratorService, EvaluationService, InterviewStateMachine
)
from app.services.pdf_service import pdf_generator
from app.schemas.domain import (
    StartInterviewRequest, QuestionResponse, SubmitAnswerRequest, AnswerEvaluationResponse, ScoringReportResponse
)
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/interview", tags=["AI Interview Engine"])
logger = logging.getLogger("smarthire.interview")

from app.services.resume_service import ResumeService

resume_service = ResumeService()

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
            config_json={"parsed_resume": body.parsed_resume, "resume_text": body.resume_text},
            status="active"
        )
        db.add(new_session)
        await db.flush()

    # Automatically advance candidate pipeline status to 'Interview Started'
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
    resume_projects_val = (db_resume.projects if db_resume and db_resume.projects else None) or (body.parsed_resume.get("projects", []) if body.parsed_resume else [])

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
        "role_target": new_session.role_target,
        "round_type": new_session.round_type,
        "difficulty": new_session.difficulty,
        "duration_minutes": new_session.duration_minutes,
        "question_count": new_session.question_count,
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

    # Determine if interview should continue or terminate based on timer and question count
    next_q_response = None
    
    # Calculate elapsed seconds (prefer frontend elapsed_seconds if sent, otherwise fallback to server time)
    started_at = session.started_at or datetime.utcnow()
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
            # If current question was ALREADY a follow-up (question.is_followup == True),
            # MUST transition to the next MAIN question (is_followup = False).
            is_transition = False
            if question.is_followup:
                # Ask NEXT MAIN QUESTION
                main_q_list = await QuestionGeneratorService.generate_unique_session_questions(
                    db=db,
                    session=session,
                    context=context_payload,
                    num_questions=1
                )
                if main_q_list:
                    main_q_data = main_q_list[0]
                    next_q_db = InterviewQuestion(
                        session_id=session.id,
                        order_index=question.order_index + 1,
                        question_text=main_q_data.get("question_text", "Let's move on to our next technical topic."),
                        category=main_q_data.get("category", "Technical"),
                        difficulty=main_q_data.get("difficulty", question.difficulty),
                        expected_keywords=main_q_data.get("expected_keywords", []),
                        is_followup=False
                    )
                else:
                    next_q_db = InterviewQuestion(
                        session_id=session.id,
                        order_index=question.order_index + 1,
                        question_text="Thank you for explaining that. Let's move on to our next key technical topic.",
                        category="Technical",
                        difficulty=question.difficulty,
                        expected_keywords=[],
                        is_followup=False
                    )
                is_transition = True
            else:
                # Candidate answered a MAIN question -> Ask ONLY ONE follow-up (is_followup = True)
                next_q_data = await QuestionGeneratorService.generate_dynamic_followup_question(
                    context=context_payload
                )
                next_q_db = InterviewQuestion(
                    session_id=session.id,
                    order_index=question.order_index + 1,
                    question_text=next_q_data.get("question_text", "Could you elaborate further on that?"),
                    category=next_q_data.get("category", "Follow-up"),
                    difficulty=next_q_data.get("difficulty", question.difficulty),
                    expected_keywords=next_q_data.get("expected_keywords", []),
                    is_followup=True
                )

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
        except Exception as dynamic_q_err:
            logger.error(f"Dynamic Question Error: {dynamic_q_err}")
            next_q_response = None

    # If interview is ending, finalize session state and generate report
    if not next_q_response:
        session.status = "completed"
        await db.commit()
        await EvaluationService.generate_and_finalize_report(db, session.id)

    # FEATURE 1: Generate natural, human-like verbal evaluation feedback (no numeric score exposed)
    evaluation_feedback = await ai_engine.evaluate_candidate_answer(
        question_text=question.question_text,
        candidate_answer=body.transcript_text,
        role=session.role_target,
        is_transition=(question.is_followup or is_transition or (next_q_response is not None and not next_q_response.get("is_followup"))),
        next_topic=next_q_response.get("category") if next_q_response else None
    )

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
    res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    session.status = "completed"
    await db.commit()
    report = await EvaluationService.generate_and_finalize_report(db, session_id)

    return {
        "status": "completed",
        "session_id": session_id,
        "overall_score": report.overall_score,
        "recommendation": report.recommendation
    }

@router.get("/report/{session_id}")
async def get_session_report(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import time
    t_start = time.perf_counter()

    res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to another candidate's interview session.")

    # Generate / finalize evaluation report (returns stored immutable DB record if completed)
    report = await EvaluationService.generate_and_finalize_report(db, session_id)

    # Fetch per-question Q&A transcript breakdown from DB
    stmt_qa = (
        select(InterviewQuestion, InterviewAnswer)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.order_index)
    )
    res_qa = await db.execute(stmt_qa)
    qa_pairs = res_qa.all()

    question_evaluations = []
    for q_inst, a_inst in qa_pairs:
        question_evaluations.append({
            "question_id": q_inst.id,
            "order_index": q_inst.order_index,
            "question_text": q_inst.question_text,
            "category": q_inst.category,
            "difficulty": q_inst.difficulty,
            "is_followup": q_inst.is_followup,
            "candidate_answer": a_inst.transcript_text if a_inst else "No verbal response submitted",
            "interviewer_response": "Evaluation completed",
            "score": round(report.overall_score, 1)
        })

    t_db_read = (time.perf_counter() - t_start) * 1000
    print("\n" + "=" * 50)
    print("REPORT PERFORMANCE (HISTORY FETCH)")
    print(f"Database Read: {t_db_read:.1f} ms")
    print(f"Total Time: {t_db_read:.1f} ms")
    print("=" * 50 + "\n")

    logger.info("REPORT PERFORMANCE (HISTORY FETCH) | Database Read: %.1fms | Total: %.1fms", t_db_read, t_db_read)

    return {
        "id": report.id or f"rep-{session_id}",
        "session_id": session_id,
        "session_title": session.title,
        "role_target": session.role_target,
        "round_type": session.round_type,
        "communication_score": report.communication_score,
        "confidence_score": report.confidence_score,
        "technical_score": report.technical_score,
        "professionalism_score": report.professionalism_score,
        "grammar_score": report.grammar_score or 85.0,
        "problem_solving_score": report.problem_solving_score or 84.0,
        "behavior_score": report.behavior_score or 82.0,
        "leadership_score": report.leadership_score or 78.0,
        "overall_score": report.overall_score,
        "recommendation": report.recommendation or "Shortlist",
        "overall_summary": report.overall_summary,
        "technical_analysis": report.technical_analysis,
        "communication_analysis": report.communication_analysis,
        "behavioral_analysis": report.behavioral_analysis,
        "grammar_analysis": report.grammar_analysis,
        "confidence_analysis": report.confidence_analysis,
        "strengths": report.strengths or [],
        "weaknesses": report.weaknesses or [],
        "improvement_plan": report.improvement_plan or [],
        "learning_resources": report.learning_resources or [],
        "communication_metrics": report.communication_metrics or {},
        "confidence_metrics": report.confidence_metrics or {},
        "technical_metrics": report.technical_metrics or {},
        "professionalism_metrics": report.professionalism_metrics or {},
        "missing_topics": report.missing_topics or [],
        "ideal_answers": report.ideal_answers or [],
        "practice_suggestions": report.practice_suggestions or [],
        "question_evaluations": question_evaluations,
        "questions": question_evaluations,
        "rating_rubric": f"Overall Rating: {round(report.overall_score, 1)}%"
    }

@router.get("/transcript/{session_id}")
async def get_session_transcript(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    res_qa = await db.execute(
        select(InterviewQuestion, InterviewAnswer)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.order_index)
    )
    qa_list = res_qa.all()

    questions = []
    for q_inst, a_inst in qa_list:
        questions.append({
            "question_id": q_inst.id,
            "order_index": q_inst.order_index,
            "question_text": q_inst.question_text,
            "category": q_inst.category,
            "difficulty": q_inst.difficulty,
            "is_followup": q_inst.is_followup,
            "candidate_answer": a_inst.transcript_text if a_inst else "No verbal response submitted",
            "interviewer_response": "Evaluation completed"
        })

    return {
        "session_id": session_id,
        "title": session.title,
        "role_target": session.role_target,
        "total_questions": len(questions),
        "questions": questions
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
        res = await db.execute(select(InterviewSession).order_by(InterviewSession.started_at.desc()))
        sessions = res.scalars().all()
    else:
        res = await db.execute(
            select(InterviewSession)
            .where(InterviewSession.candidate_id.in_(cand_ids))
            .order_by(InterviewSession.started_at.desc())
        )
        sessions = res.scalars().all()

    history = []
    for s in sessions:
        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id == s.id))
        rep = res_rep.scalars().first()

        score = round(rep.overall_score, 1) if (rep and rep.overall_score is not None) else None
        rec = rep.recommendation if (rep and rep.recommendation) else "Pending"

        # Count questions asked in this session
        res_qc = await db.execute(select(InterviewQuestion).where(InterviewQuestion.session_id == s.id))
        q_count = len(res_qc.scalars().all())

        history.append({
            "id": s.id,
            "session_id": s.id,
            "title": s.title,
            "role_target": s.role_target or "Software Engineer",
            "round_type": s.round_type or "Technical",
            "interview_type": s.interview_type or "Mock",
            "duration_minutes": s.duration_minutes or 30,
            "question_count": q_count or s.question_count or 6,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "score": score,
            "overall_score": score,
            "recommendation": rec
        })

    return history

@router.get("/report/{session_id}/pdf")
async def get_session_pdf_report(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates and downloads a complete enterprise PDF evaluation report for an interview session."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    # Authorization check
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate or session.candidate_id != candidate.id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

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

    transcript_list = []
    for q, a in pairs:
        transcript_list.append({
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "is_followup": q.is_followup,
            "answer_text": a.transcript_text if a else None
        })

    session_info = {
        "title": session.title,
        "role_target": session.role_target,
        "round_type": session.round_type,
        "interview_type": session.interview_type
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
        "weaknesses": report.weaknesses or []
    }

    pdf_bytes = pdf_generator.generate_interview_pdf(
        session_info=session_info,
        report_data=report_dict,
        transcript_data=transcript_list
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
        "transcript": transcript
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

    out = []
    for s in sessions:
        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id == s.id))
        rep = res_rep.scalars().first()

        out.append({
            "session_id": s.id,
            "title": s.title or f"{s.role_target} ({s.round_type})",
            "role_target": s.role_target,
            "round_type": s.round_type or "Technical",
            "difficulty": s.difficulty or "Medium",
            "duration_minutes": s.duration_minutes or 15,
            "interview_type": s.interview_type or "Mock",
            "status": s.status,
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
