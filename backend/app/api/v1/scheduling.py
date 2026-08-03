from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid

from app.core.db import get_db
from app.models.domain import ScheduledInterview, Notification, User, Candidate, Recruiter, JobDescription, InterviewTemplate, JobApplication, JobPosting, Resume
from app.api.v1.websocket import ws_manager
from app.dependencies.auth import get_current_user, require_role
from app.services.interview_service import PipelineManager

router = APIRouter(prefix="/scheduling", tags=["Interview Scheduling"])

class CreateScheduleRequest(BaseModel):
    candidate_id: Optional[str] = None
    candidate_ids: Optional[List[str]] = []
    round_type: str = "Technical" # HR, Technical, Behavioral, Aptitude, Coding
    scheduled_date: str # ISO String
    duration_minutes: int = 30
    difficulty: str = "Medium"
    job_description_id: Optional[str] = None
    instructions: Optional[str] = "Please be present 5 minutes early in a quiet environment."

@router.get("/candidates-list")
async def get_candidates_list(
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns all registered candidates for recruiters to choose from in the scheduling modal."""
    # Query all users with role 'candidate' or any candidate profiles
    res_users = await db.execute(select(User).where(User.role == "candidate", User.deleted_at == None))
    cand_users = res_users.scalars().all()
    
    out = []
    for u in cand_users:
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == u.id))
        c = res_c.scalar_one_or_none()
        if not c:
            c = Candidate(user_id=u.id, target_role="Full Stack Engineer", experience_level="Mid-Level")
            db.add(c)
            await db.flush()
            
        out.append({
            "candidate_id": c.id,
            "user_id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "target_role": c.target_role or "Full Stack Engineer",
            "experience_level": c.experience_level or "Mid-Level"
        })
        
    await db.commit()
    return out

@router.post("/create")
async def create_scheduled_interview(
    body: CreateScheduleRequest,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Schedules interviews for one or multiple selected candidates in PostgreSQL and dispatches real-time WebSocket notifications."""
    raw_target_ids = body.candidate_ids if (body.candidate_ids and len(body.candidate_ids) > 0) else ([body.candidate_id] if body.candidate_id else [])

    candidates_db: List[Candidate] = []

    if raw_target_ids:
        for tid in raw_target_ids:
            # 1. Try finding by Candidate.id
            res_c = await db.execute(select(Candidate).where(Candidate.id == tid))
            cand = res_c.scalar_one_or_none()
            
            # 2. Try finding by Candidate.user_id or User.id
            if not cand:
                res_u = await db.execute(select(User).where((User.id == tid) | (User.email == tid)))
                u = res_u.scalar_one_or_none()
                if u:
                    res_c2 = await db.execute(select(Candidate).where(Candidate.user_id == u.id))
                    cand = res_c2.scalar_one_or_none()
                    if not cand:
                        cand = Candidate(user_id=u.id, target_role="Full Stack Engineer", experience_level="Mid-Level")
                        db.add(cand)
                        await db.flush()
            
            if cand and cand not in candidates_db:
                candidates_db.append(cand)
    else:
        # Fallback to all candidates in DB
        res = await db.execute(select(Candidate))
        candidates_db = res.scalars().all()

    if not candidates_db:
        # Auto-provision a candidate user if database has candidate users without profiles
        res_u = await db.execute(select(User).where(User.role == "candidate"))
        u = res_u.scalars().first()
        if u:
            cand = Candidate(user_id=u.id, target_role="Full Stack Engineer", experience_level="Mid-Level")
            db.add(cand)
            await db.flush()
            candidates_db.append(cand)

    if not candidates_db:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No registered candidate selected or found to schedule interview.")

    parsed_date = datetime.fromisoformat(body.scheduled_date.replace('Z', '+00:00')).replace(tzinfo=None) if body.scheduled_date else datetime.utcnow()
    created_schedules = []

    for candidate_db in candidates_db:
        res_u = await db.execute(select(User).where(User.id == candidate_db.user_id))
        cand_user = res_u.scalar_one_or_none()

        # Fetch candidate's active JobApplication, JobPosting, and Resume
        res_app = await db.execute(
            select(JobApplication)
            .where(JobApplication.candidate_id == candidate_db.id)
            .order_by(JobApplication.applied_at.desc())
        )
        cand_app = res_app.scalars().first()

        job_inst = None
        resume_inst = None
        if cand_app:
            if cand_app.job_id:
                res_j = await db.execute(select(JobPosting).where(JobPosting.id == cand_app.job_id))
                job_inst = res_j.scalar_one_or_none()
            if cand_app.resume_id:
                res_r = await db.execute(select(Resume).where(Resume.id == cand_app.resume_id))
                resume_inst = res_r.scalar_one_or_none()

        recruiter_id = None
        res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
        rec = res_rec.scalar_one_or_none()
        if rec:
            recruiter_id = rec.id

        dur = body.duration_minutes or 30
        q_count = 4 if dur <= 15 else (6 if dur <= 30 else 8)

        config_data = {
            "job_title": job_inst.title if job_inst else (candidate_db.target_role or "Software Engineer"),
            "job_description": job_inst.description if job_inst else "",
            "required_skills": job_inst.required_skills if (job_inst and job_inst.required_skills) else [],
            "resume_text": resume_inst.raw_text if resume_inst else "",
            "round_type": body.round_type,
            "difficulty": body.difficulty,
            "duration_minutes": body.duration_minutes,
            "question_count": q_count,
            "recruiter_name": user.full_name,
            "company_name": job_inst.company_name if job_inst else "SmartHire AI Platform"
        }

        new_schedule = ScheduledInterview(
            candidate_id=candidate_db.id,
            recruiter_id=recruiter_id,
            job_application_id=cand_app.id if cand_app else None,
            job_id=cand_app.job_id if cand_app else None,
            resume_id=cand_app.resume_id if cand_app else None,
            round_type=body.round_type,
            scheduled_date=parsed_date,
            duration_minutes=body.duration_minutes,
            difficulty=body.difficulty,
            question_count=q_count,
            job_description_id=body.job_description_id,
            instructions=body.instructions or "Be present in a well-lit room with your camera enabled.",
            config_json=config_data,
            status="Scheduled"
        )
        db.add(new_schedule)
        await db.flush()

        # Automatically update Application Pipeline Stage to "Interview Scheduled"
        await PipelineManager.update_pipeline_stage(db, candidate_db.id, "Interview Scheduled")

        # Create Notification in DB
        new_notif = Notification(
            user_id=candidate_db.user_id,
            title=f"New Interview Scheduled: {body.round_type} Round",
            message=f"Recruiter scheduled your {body.round_type} round for {parsed_date.strftime('%b %d, %Y at %I:%M %p')}.",
            notification_type="interview_scheduled"
        )
        db.add(new_notif)

        # Send Real-Time WebSocket Event to Candidate User
        ws_payload = {
            "event": "INTERVIEW_SCHEDULED",
            "data": {
                "interview_id": new_schedule.id,
                "round_type": new_schedule.round_type,
                "scheduled_date": new_schedule.scheduled_date.isoformat(),
                "duration_minutes": new_schedule.duration_minutes,
                "difficulty": new_schedule.difficulty,
                "status": new_schedule.status,
                "instructions": new_schedule.instructions,
                "candidate_name": cand_user.full_name if cand_user else "Candidate User",
                "recruiter_name": "Recruiter Manager",
                "company_name": "SmartHire AI Platform"
            }
        }
        await ws_manager.send_personal_message(ws_payload, candidate_db.user_id)
        await ws_manager.broadcast(ws_payload)

        created_schedules.append({
            "id": new_schedule.id,
            "candidate_id": new_schedule.candidate_id,
            "candidate_name": cand_user.full_name if cand_user else "Candidate User",
            "round_type": new_schedule.round_type,
            "scheduled_date": new_schedule.scheduled_date.isoformat(),
            "status": new_schedule.status
        })

    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully scheduled interviews for {len(created_schedules)} candidate(s).",
        "schedules": created_schedules
    }

@router.get("/candidate")
@router.get("/candidate-schedules")
async def get_candidate_schedule(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches real scheduled interviews for authenticated candidate from PostgreSQL."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    cand = res_c.scalar_one_or_none()
    if not cand:
        return []

    # Auto-sync completed status from interview sessions
    from app.models.domain import InterviewSession
    res_sess = await db.execute(select(InterviewSession).where(
        InterviewSession.candidate_id == cand.id,
        InterviewSession.status == "completed"
    ))
    completed_sessions = res_sess.scalars().all()

    res = await db.execute(
        select(ScheduledInterview)
        .where(ScheduledInterview.candidate_id == cand.id)
        .order_by(ScheduledInterview.scheduled_date.desc())
    )
    schedules = res.scalars().all()
    
    out = []
    for s in schedules:
        if completed_sessions and s.status.lower() != "completed":
            s.status = "Completed"
            await db.commit()

        if s.status.lower() == "completed":
            continue

        out.append({
            "id": s.id,
            "candidate_id": s.candidate_id,
            "candidate_name": user.full_name,
            "round_type": s.round_type,
            "scheduled_date": s.scheduled_date.isoformat(),
            "duration_minutes": s.duration_minutes,
            "difficulty": s.difficulty,
            "status": s.status,
            "instructions": s.instructions,
            "recruiter_name": "Recruiter Manager",
            "company_name": "SmartHire AI Platform"
        })
    return out

@router.get("/detail/{schedule_id}")
async def get_schedule_detail(
    schedule_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns single scheduled interview details for direct candidate interview entry."""
    res = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == schedule_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduled interview not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.id == s.candidate_id))
    cand = res_c.scalar_one_or_none()
    
    cfg = s.config_json or {}
    job_title = cfg.get("job_title") or (cand.target_role if (cand and cand.target_role) else "Software Engineer")

    return {
        "id": s.id,
        "schedule_id": s.id,
        "candidate_id": s.candidate_id,
        "recruiter_id": s.recruiter_id,
        "job_application_id": s.job_application_id,
        "job_id": s.job_id,
        "resume_id": s.resume_id,
        "round_type": s.round_type or cfg.get("round_type", "Technical"),
        "scheduled_date": s.scheduled_date.isoformat() if s.scheduled_date else None,
        "duration_minutes": s.duration_minutes or cfg.get("duration_minutes", 30),
        "difficulty": s.difficulty or cfg.get("difficulty", "Medium"),
        "question_count": s.question_count or cfg.get("question_count", 6),
        "instructions": s.instructions,
        "job_title": job_title,
        "role_target": job_title,
        "config_json": cfg,
        "status": s.status
    }

@router.get("/recruiter")
async def get_recruiter_schedule(
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Fetches recruiter schedule breakdown from PostgreSQL."""
    res = await db.execute(
        select(ScheduledInterview)
        .order_by(ScheduledInterview.scheduled_date.desc())
    )
    schedules = res.scalars().all()
    out = []
    for s in schedules:
        res_c = await db.execute(select(Candidate).where(Candidate.id == s.candidate_id))
        cand = res_c.scalar_one_or_none()
        cand_name = "Candidate User"
        if cand:
            res_u = await db.execute(select(User).where(User.id == cand.user_id))
            u = res_u.scalar_one_or_none()
            if u:
                cand_name = u.full_name

        out.append({
            "id": s.id,
            "candidate_id": s.candidate_id,
            "candidate_name": cand_name,
            "round_type": s.round_type,
            "scheduled_date": s.scheduled_date.isoformat(),
            "duration_minutes": s.duration_minutes,
            "difficulty": s.difficulty,
            "status": s.status,
            "instructions": s.instructions
        })
    return out

@router.post("/{interview_id}/status")
async def update_interview_status(
    interview_id: str,
    new_status: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Updates interview status (Upcoming, In Progress, Completed, Cancelled)."""
    res = await db.execute(select(ScheduledInterview).where(ScheduledInterview.id == interview_id))
    interview = res.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Scheduled interview not found.")

    interview.status = new_status
    await db.commit()

    # Emit socket event
    res_c = await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))
    cand = res_c.scalar_one_or_none()
    if cand:
        await ws_manager.send_personal_message({
            "event": "STATUS_CHANGED",
            "data": {"interview_id": interview.id, "status": new_status}
        }, cand.user_id)

    return {"status": "success", "interview_id": interview.id, "new_status": new_status}
