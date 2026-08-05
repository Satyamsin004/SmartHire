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

# Regex extraction functions removed, now entirely powered by AI Engine.
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

def _extract_docx_text(content: bytes) -> str:
    """Extracts text from DOCX files using pure Python zipfile & ElementTree."""
    try:
        import zipfile, io
        import xml.etree.ElementTree as ET
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            texts = [elem.text for elem in tree.iter() if elem.tag.endswith('}t') and elem.text]
            return "\n".join(texts)
    except Exception as e:
        import logging
        logging.error(f"Failed to parse DOCX: {e}")
        return ""

@router.post("/resume", summary="Upload & Parse PDF/DOCX Resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filename = (file.filename or "resume.pdf").lower()
    is_pdf = filename.endswith(".pdf") or file.content_type in ["application/pdf", "application/x-pdf"]
    is_docx = filename.endswith(".docx") or file.content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if not (is_pdf or is_docx):
        raise HTTPException(status_code=400, detail="Only PDF (.pdf) and Word (.docx) files are supported.")

    content = await file.read()
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 10 MB.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)
        await db.flush()

    ext = ".docx" if is_docx else ".pdf"
    unique_filename = f"resume_{candidate.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(RESUME_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    web_url = f"/uploads/resumes/{unique_filename}"
    candidate.resume_url = web_url

    # Calculate next version for candidate resumes
    res_existing = await db.execute(select(Resume).where(Resume.candidate_id == candidate.id))
    existing_resumes = res_existing.scalars().all()
    next_version = len(existing_resumes) + 1

    raw_text = ""
    if is_docx:
        raw_text = _extract_docx_text(content)
    else:
        # Try pdfplumber first, then pypdf, then raw string decode
        try:
            import pdfplumber, io
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages_text = [p.extract_text() for p in pdf.pages if p.extract_text()]
                if pages_text:
                    raw_text = "\n".join(pages_text)
        except Exception:
            pass

        if not raw_text.strip():
            try:
                from pypdf import PdfReader
                import io
                reader = PdfReader(io.BytesIO(content))
                pages_text = [page.extract_text() for page in reader.pages if page.extract_text()]
                if pages_text:
                    raw_text = "\n".join(pages_text)
            except Exception:
                pass

    if not raw_text.strip():
        try:
            raw_text = content.decode("utf-8", errors="ignore")
        except Exception:
            raw_text = ""

    # Delegate to resume_service to parse, normalize, version, store in PostgreSQL, and sync candidate profile
    full_parsed_resume = await resume_service.parse_and_store_resume(
        db=db,
        candidate=candidate,
        file_name=file.filename or f"resume{ext}",
        file_path=web_url,
        raw_text=raw_text
    )

    # Activity Log & Notification
    notif = Notification(
        user_id=user.id,
        title="Resume Uploaded & Parsed",
        message=f"Resume '{file.filename}' (v{full_parsed_resume.get('version', 1)}) uploaded and parsed successfully.",
        notification_type="resume_updated"
    )
    db.add(notif)
    db.add(ActivityLog(user_id=user.id, action=f"Uploaded Resume v{full_parsed_resume.get('version', 1)}", endpoint="/uploads/resume"))
    await db.commit()

    return full_parsed_resume


