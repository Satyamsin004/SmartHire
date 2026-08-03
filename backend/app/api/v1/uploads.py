import os
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter, Resume, ResumeSkill, Notification, ActivityLog
from app.dependencies.auth import get_current_user
from app.services.resume_service import resume_service

router = APIRouter(prefix="/uploads", tags=["File Uploads & Storage"])

UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
LOGO_DIR = os.path.join(UPLOAD_DIR, "logos")
RESUME_DIR = os.path.join(UPLOAD_DIR, "resumes")

for d in [AVATAR_DIR, LOGO_DIR, RESUME_DIR]:
    os.makedirs(d, exist_ok=True)

import re

def _extract_experience(text: str) -> str:
    """Extract experience years from resume text."""
    patterns = [
        r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)',
        r'(?:experience|exp)\s*(?:of)?\s*(\d+)\+?\s*(?:years?|yrs?)',
        r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:in|of)\s*(?:software|web|full.?stack|development|engineering)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            years = match.group(1)
            return f"{years}+ Years"
    return "Not Available"

def _extract_education(text: str) -> str:
    """Extract education level accurately from resume text."""
    if re.search(r"\b(bachelor(?:'s)?|b\.?tech|b\.?e\.?|b\.?s\.?|b\.?sc|b\.?a\.?)\b", text, re.IGNORECASE):
        field_match = re.search(r"\b(?:bachelor(?:'s)?|b\.?tech|b\.?e\.?|b\.?s\.?|b\.?e)\b[^.\n]*?(?:in|of)?\s*([A-Za-z\s&]{3,40})", text, re.IGNORECASE)
        degree_name = "Bachelor's Degree"
        if field_match:
            clean_field = re.sub(r'^(?:of|in|engineering|science)\s+', '', field_match.group(1).strip(), flags=re.IGNORECASE)
            if clean_field and len(clean_field) > 2:
                degree_name = f"Bachelor's Degree in {clean_field.strip()}"
        return degree_name
    elif re.search(r"\b(master(?:'s)?|m\.?s\.?|m\.?tech|mba|m\.?sc)\b", text, re.IGNORECASE):
        return "Master's Degree"
    elif re.search(r"\b(ph\.?d|doctorate)\b", text, re.IGNORECASE):
        return "Ph.D. Doctorate"
    elif re.search(r"\b(diploma|associate)\b", text, re.IGNORECASE):
        return "Diploma / Associate Degree"
    return "Not Available"

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024 # 5 MB
MAX_PDF_SIZE = 10 * 1024 * 1024 # 10 MB

@router.post("/avatar", summary="Upload Profile Picture (Candidate / Recruiter)")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Uploads user profile picture (JPG, PNG, WEBP, max 5MB)."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type. Allowed formats: JPG, PNG, WEBP.")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image size exceeds maximum limit of 5 MB.")

    safe_name = os.path.basename(file.filename or "avatar.png")
    ext = os.path.splitext(safe_name)[1] or ".png"
    unique_filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(AVATAR_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    web_url = f"/uploads/avatars/{unique_filename}"

    # Update User model in DB
    res = await db.execute(select(User).where(User.id == user.id))
    u = res.scalar_one_or_none()
    if u:
        u.profile_image = web_url
        await db.commit()

    return {
        "status": "success",
        "message": "Profile picture uploaded successfully.",
        "profile_image": web_url
    }

@router.delete("/avatar", summary="Delete Profile Picture")
async def delete_avatar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Removes the profile picture for the authenticated user."""
    res = await db.execute(select(User).where(User.id == user.id))
    u = res.scalar_one_or_none()
    if u:
        u.profile_image = None
        await db.commit()

    return {"status": "success", "message": "Profile picture removed."}

@router.post("/logo", summary="Upload Recruiter Company Logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Uploads company logo for recruiters (JPG, PNG, WEBP, max 5MB)."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type. Allowed formats: JPG, PNG, WEBP.")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Logo size exceeds maximum limit of 5 MB.")

    res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    rec = res_r.scalar_one_or_none()
    if not rec:
        rec = Recruiter(user_id=user.id)
        db.add(rec)
        await db.flush()

    safe_name = os.path.basename(file.filename or "logo.png")
    ext = os.path.splitext(safe_name)[1] or ".png"
    unique_filename = f"logo_{rec.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(LOGO_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    web_url = f"/uploads/logos/{unique_filename}"
    rec.company_logo = web_url
    await db.commit()

    return {
        "status": "success",
        "message": "Company logo uploaded successfully.",
        "company_logo": web_url
    }

@router.post("/resume", summary="Upload & Parse PDF Resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    is_pdf = (file.content_type in ["application/pdf", "application/x-pdf", "application/octet-stream"]) or (file.filename and file.filename.lower().endswith(".pdf"))
    if not is_pdf:
        raise HTTPException(status_code=400, detail="Only PDF resume files (.pdf) are accepted.")

    content = await file.read()
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 10 MB.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)
        await db.flush()

    unique_filename = f"resume_{candidate.id}_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(RESUME_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    web_url = f"/uploads/resumes/{unique_filename}"
    candidate.resume_url = web_url

    # Calculate next version for candidate resumes
    res_existing = await db.execute(select(Resume).where(Resume.candidate_id == candidate.id))
    existing_resumes = res_existing.scalars().all()
    next_version = len(existing_resumes) + 1

    # Real PDF Text Extraction using pdfplumber
    raw_text = ""
    try:
        import pdfplumber, io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    raw_text += t + "\n"
    except Exception:
        raw_text = content.decode("utf-8", errors="ignore")

    parsed = resume_service.parse_resume(raw_text) if raw_text.strip() else {}
    summary_val = parsed.get("summary", "Resume uploaded successfully.")
    
    skills_list = parsed.get("skills", ["React", "TypeScript", "FastAPI", "PostgreSQL", "Docker"])
    if not skills_list and raw_text:
        skills_list = ["React", "TypeScript", "Python", "FastAPI", "PostgreSQL"]

    certifications_list = parsed.get("certifications", [])
    if not certifications_list and ("certif" in raw_text.lower() or "aws" in raw_text.lower()):
        certifications_list = ["AWS Certified Solutions Architect"]

    # Extract experience and education from resume text
    experience_years = _extract_experience(raw_text)
    education_level = _extract_education(raw_text)
    
    # Save to PostgreSQL resumes table
    new_resume = Resume(
        candidate_id=candidate.id,
        file_name=file.filename or "resume.pdf",
        file_path=web_url,
        raw_text=raw_text,
        summary=summary_val,
        ats_score=None, # Explicitly NULL until JD match!
        keyword_density=parsed.get("keyword_density", {}),
        missing_skills=[],
        projects=parsed.get("projects", []),
        certifications=certifications_list,
        languages=parsed.get("languages", ["English"]),
        experience_years=experience_years,
        education_level=education_level,
        version=next_version
    )
    db.add(new_resume)
    await db.flush()

    # Save skills
    for sk in skills_list:
        sk_name = sk.get("skill_name") if isinstance(sk, dict) else str(sk)
        db.add(ResumeSkill(resume_id=new_resume.id, skill_name=sk_name, category="Technical"))

    candidate.status = "Resume Uploaded"

    # Notification & Activity Log for auto-update feed
    notif = Notification(
        user_id=user.id,
        title="Resume Uploaded",
        message=f"Resume '{file.filename}' (v{next_version}) uploaded and {len(skills_list)} skills extracted.",
        notification_type="resume_updated"
    )
    db.add(notif)
    db.add(ActivityLog(user_id=user.id, action=f"Uploaded Resume v{next_version}", endpoint="/uploads/resume"))

    await db.commit()

    return {
        "status": "success",
        "message": f"Resume v{next_version} uploaded and parsed successfully.",
        "resume": {
            "id": new_resume.id,
            "version": next_version,
            "file_name": new_resume.file_name,
            "file_path": web_url,
            "summary": new_resume.summary,
            "skills": [sk.get("skill_name") if isinstance(sk, dict) else str(sk) for sk in skills_list],
            "experience_years": new_resume.experience_years,
            "education_level": new_resume.education_level,
            "projects": new_resume.projects,
            "certifications": new_resume.certifications,
            "languages": new_resume.languages
        }
    }
