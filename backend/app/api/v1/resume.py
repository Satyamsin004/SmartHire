import os
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.domain import User, Candidate, Resume, ResumeSkill, JobApplication
from app.services.resume_service import resume_service

router = APIRouter(prefix="/resume", tags=["Resume & ATS Pipeline"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/parse")
@router.post("/upload")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Production-ready endpoint to upload, validate, extract, parse, version, and store resume in normalized PostgreSQL tables."""
    filename = file.filename or "resume.pdf"
    content = await file.read()

    # 1. Validate File & Extract Clean Text (Supports PDF & DOCX)
    raw_text = resume_service.extract_text_from_file_bytes(content, filename, max_size_mb=10)

    # 2. Get or Create Candidate Profile
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(
            id=f"cand-{uuid.uuid4().hex[:8]}",
            user_id=user.id,
            target_role="Full Stack Engineer",
            experience_level="Mid-Level"
        )
        db.add(candidate)
        await db.flush()

    # 3. Save File to Disk
    safe_filename = f"{candidate.id}_v{uuid.uuid4().hex[:6]}_{filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception:
        file_path = f"/uploads/resumes/{safe_filename}"

    # 4. Parse, Normalize into PostgreSQL, Version & Auto-Sync Candidate Profile
    full_parsed_resume = await resume_service.parse_and_store_resume(
        db=db,
        candidate=candidate,
        file_name=filename,
        file_path=file_path,
        raw_text=raw_text
    )

    return full_parsed_resume

@router.get("/my-resume", summary="Get Active Candidate Resume & Profile Data")
async def get_my_resume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves active normalized resume and full parsed structure for current candidate."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return None

    res_r = await db.execute(
        select(Resume)
        .where(Resume.candidate_id == candidate.id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
    )
    resume = res_r.scalars().first()
    
    if not resume:
        # Fallback to most recent resume if no active flag set
        res_r2 = await db.execute(
            select(Resume).where(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc())
        )
        resume = res_r2.scalars().first()

    if not resume:
        return None

    return await resume_service.get_full_parsed_resume(db, resume.id)

@router.get("/versions", summary="Get Candidate Resume Upload Versions")
async def get_resume_versions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves list of all resume upload versions for candidate history."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return []

    return await resume_service.get_resume_versions(db, candidate.id)

@router.get("/recruiter-view/{candidate_id}", summary="Get Full Parsed Resume for Recruiter View")
async def get_recruiter_candidate_view(
    candidate_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns normalized parsed resume data, experience, education, projects, skills, and ATS breakdown for recruiter view."""
    res_r = await db.execute(
        select(Resume)
        .where(Resume.candidate_id == candidate_id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
    )
    resume = res_r.scalars().first()

    if not resume:
        res_r2 = await db.execute(
            select(Resume).where(Resume.candidate_id == candidate_id).order_by(Resume.created_at.desc())
        )
        resume = res_r2.scalars().first()

    if not resume:
        raise HTTPException(status_code=404, detail="Candidate resume not found.")

    return await resume_service.get_full_parsed_resume(db, resume.id)

@router.get("/interview-context/{candidate_id}", summary="Get Candidate Resume AI Interview Context")
async def get_interview_resume_context(
    candidate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns formatted context payload (skills, projects, ATS missing skills) for AI Question Generator."""
    res_r = await db.execute(
        select(Resume)
        .where(Resume.candidate_id == candidate_id, Resume.is_active == True)
        .order_by(Resume.created_at.desc())
    )
    resume = res_r.scalars().first()
    if not resume:
        return {"skills": [], "projects": [], "missing_skills": [], "summary": ""}

    full_data = await resume_service.get_full_parsed_resume(db, resume.id)
    skills = [s["skill_name"] for s in full_data.get("skills", [])]
    projects = [p["project_name"] for p in full_data.get("projects", [])]
    missing = full_data.get("ats_analysis", {}).get("missing_keywords", [])

    return {
        "resume_id": resume.id,
        "summary": resume.summary,
        "skills": skills,
        "projects": projects,
        "missing_skills": missing,
        "experience_years": resume.experience_years
    }

@router.delete("/my-resume", summary="Delete Stored Resume")
async def delete_my_resume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes stored candidate resume records from database."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return {"message": "No candidate profile found."}

    res_apps = await db.execute(select(JobApplication).where(JobApplication.candidate_id == candidate.id))
    apps = res_apps.scalars().all()
    for app in apps:
        app.resume_id = None

    res_r = await db.execute(select(Resume).where(Resume.candidate_id == candidate.id))
    resumes = res_r.scalars().all()
    for r in resumes:
        await db.delete(r)

    candidate.resume_url = None
    candidate.status = "Registered"
    await db.commit()

    return {"message": "Resume and associated versions deleted successfully."}
