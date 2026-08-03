from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import Optional
from app.services.resume_service import resume_service
from app.schemas.domain import ResumeParseResponse, JDMatchRequest, JDMatchResponse

from app.dependencies.auth import get_current_user
from app.models.domain import User

router = APIRouter(prefix="/resume", tags=["Resume & ATS"])

@router.post("/parse", response_model=ResumeParseResponse)
async def parse_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    filename = file.filename or "resume.pdf"
    content = await file.read()
    
    # Extract text from PDF using pdfplumber for accurate parsing
    raw_text = ""
    try:
        import pdfplumber, io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    raw_text += t + "\n"
    except Exception:
        # Fallback: try UTF-8 decode for plain text files
        try:
            raw_text = content.decode("utf-8", errors="ignore")
        except Exception:
            raw_text = ""

    if not raw_text.strip():
        raw_text = "Unable to extract text from uploaded file."

    parsed = resume_service.parse_resume_text(raw_text)
    
    return {
        "id": "res-9901-abc",
        "file_name": filename,
        "ats_score": parsed["ats_score"],
        "summary": parsed["summary"],
        "skills": parsed["skills"],
        "keyword_density": parsed["keyword_density"],
        "missing_skills": parsed["missing_skills"]
    }

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.models.domain import Candidate, Resume, ResumeSkill

@router.get("/my-resume", summary="Get Stored Candidate Resume")
async def get_my_resume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves stored PDF resume record and extracted skills for candidate."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return None

    res_r = await db.execute(
        select(Resume).where(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc())
    )
    resume = res_r.scalars().first()
    if not resume:
        return None

    res_sk = await db.execute(select(ResumeSkill).where(ResumeSkill.resume_id == resume.id))
    skills = res_sk.scalars().all()

    from app.api.v1.uploads import _extract_education
    education_val = _extract_education(resume.raw_text) if resume.raw_text else resume.education_level
    if not education_val or education_val == "Master's Degree":
        education_val = _extract_education(resume.raw_text or "")

    return {
        "id": resume.id,
        "file_name": resume.file_name,
        "file_path": resume.file_path,
        "summary": resume.summary,
        "skills": [{"skill_name": s.skill_name, "category": s.category} for s in skills],
        "experience_years": resume.experience_years or "3+ Years Professional Experience",
        "education_level": education_val or "Not Available",
        "projects": resume.projects or [],
        "certifications": resume.certifications or [],
        "languages": resume.languages or [],
        "ats_score": None
    }

@router.delete("/my-resume", summary="Delete Stored Resume")
async def delete_my_resume(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes stored candidate resume record from database."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return {"message": "No resume found."}

    from app.models.domain import JobApplication
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

    return {"message": "Resume deleted successfully."}
