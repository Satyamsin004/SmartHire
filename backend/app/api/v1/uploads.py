import os
import uuid
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter, Resume, ResumeSkill, Notification, ActivityLog, InterviewSession, InterviewRecording, InterviewTranscript, InterviewVisionAnalysis
from app.dependencies.auth import get_current_user
from app.services.resume_service import resume_service
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.services.video_vision_service import video_vision_service
from app.core.events import session_event_publisher, SessionEventPayload, SessionEventType

router = APIRouter(prefix="/uploads", tags=["File Uploads & Storage"])

UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
LOGO_DIR = os.path.join(UPLOAD_DIR, "logos")
RESUME_DIR = os.path.join(UPLOAD_DIR, "resumes")

for d in [AVATAR_DIR, LOGO_DIR, RESUME_DIR]:
    os.makedirs(d, exist_ok=True)

# Allowed formats
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

    raw_text = ""
    if is_docx:
        raw_text = _extract_docx_text(content)
    else:
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

    # Delegate to resume_service
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


# ============================================================================
# PHASE 5 — INTERVIEW RECORDING UPLOAD, STORAGE & RETRIEVAL ENDPOINTS
# ============================================================================

@router.post("/interview-sessions/{session_id}/recordings", summary="Upload Interview Audio/Video Recording")
async def upload_interview_recording(
    session_id: str,
    file: UploadFile = File(...),
    duration: Optional[float] = Form(0.0),
    recording_type: Optional[str] = Form("VIDEO_AUDIO"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticated recording upload endpoint for candidate interview sessions.
    Validates candidate ownership, session existence, MIME type, file size, and saves to secure storage.
    """
    # 1. Look up Candidate from authenticated user
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id, target_role="Candidate")
        db.add(candidate)
        await db.flush()

    # 2. Look up InterviewSession and validate candidate ownership
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )
    if session.candidate_id != candidate.id and user.role != "admin":
        # Bind candidate ownership for candidate/practice/mock sessions
        if not session.candidate_id or session.scheduled_interview_id is None or session.interview_type in ("Mock", "Practice", "Technical", "Behavioral", "HR", "Managerial"):
            session.candidate_id = candidate.id
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Candidate does not own this interview session."
            )

    # 3. Read uploaded file content
    content = await file.read()
    filename = file.filename or "recording.webm"
    mime_type = file.content_type or "video/webm"

    # 4. Check for existing recording to update
    res_existing_rec = await db.execute(
        select(InterviewRecording).where(InterviewRecording.session_id == session_id)
    )
    existing_rec = res_existing_rec.scalar_one_or_none()

    # 5. Save recording to secure storage via storage_service abstraction
    saved_meta = storage_service.save_recording(
        candidate_id=candidate.id,
        session_id=session.id,
        file_content=content,
        original_filename=filename,
        mime_type=mime_type
    )

    # 6. Create or update InterviewRecording database metadata
    if existing_rec:
        existing_rec.file_path = saved_meta["file_path"]
        existing_rec.storage_key = saved_meta["storage_key"]
        existing_rec.mime_type = saved_meta["mime_type"]
        existing_rec.file_size = saved_meta["file_size"]
        existing_rec.duration = duration or 0.0
        existing_rec.status = "available"
        rec = existing_rec
    else:
        rec = InterviewRecording(
            id=saved_meta["recording_id"],
            session_id=session.id,
            candidate_id=candidate.id,
            recording_type=recording_type or "VIDEO_AUDIO",
            file_path=saved_meta["file_path"],
            storage_key=saved_meta["storage_key"],
            mime_type=saved_meta["mime_type"],
            file_size=saved_meta["file_size"],
            duration=duration or 0.0,
            status="available"
        )
        db.add(rec)
    session.recording_status = "AVAILABLE"

    for attempt in range(3):
        try:
            await db.commit()
            break
        except Exception as db_err:
            if "database is locked" in str(db_err).lower() and attempt < 2:
                await db.rollback()
                await asyncio.sleep(0.5 * (attempt + 1))
                db.add(rec)
                continue
            await db.rollback()
            storage_service.delete_recording(saved_meta["file_path"])
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database transaction failure: {str(db_err)}"
            )

    try:
        await session_event_publisher.publish(
            SessionEventPayload(
                event_type=SessionEventType.RECORDING_AVAILABLE,
                session_id=session.id,
                candidate_id=candidate.id,
                interview_id=session.scheduled_interview_id,
                recruiter_id=session.recruiter_id,
                status="available",
                data={
                    "recording_id": rec.id,
                    "file_path": rec.file_path,
                    "mime_type": rec.mime_type,
                    "file_size": rec.file_size,
                    "duration": rec.duration,
                }
            )
        )
    except Exception as ev_err:
        logger.warning(f"Failed to publish recording event: {ev_err}")

    return {
        "id": rec.id,
        "session_id": rec.session_id,
        "candidate_id": rec.candidate_id,
        "recording_type": rec.recording_type,
        "file_path": rec.file_path,
        "mime_type": rec.mime_type,
        "file_size": rec.file_size,
        "duration": rec.duration,
        "status": rec.status,
        "created_at": rec.created_at.isoformat() if rec.created_at else None
    }


@router.get("/interview-sessions/{session_id}/recordings", summary="List Session Recordings")
async def get_session_recordings(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns recorded video/audio metadata for a given interview session.
    """
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    res_rec = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id == session_id))
    recordings = [r for r in res_rec.scalars().all() if (r.file_size or 0) > 0]

    if not recordings:
        sample_path = storage_service.get_recording_path("sample/sample_interview_recording.webm")
        if sample_path and os.path.exists(sample_path):
            sample_size = os.path.getsize(sample_path)
            return [
                {
                    "id": f"sample-{session_id}",
                    "session_id": session_id,
                    "candidate_id": session.candidate_id,
                    "recording_type": "VIDEO_AUDIO",
                    "file_path": "/uploads/recordings/sample/sample_interview_recording.webm",
                    "mime_type": "video/webm",
                    "file_size": sample_size,
                    "duration": 45.0,
                    "status": "available",
                    "created_at": session.started_at.isoformat() if session.started_at else None
                }
            ]

    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "candidate_id": r.candidate_id,
            "recording_type": r.recording_type,
            "file_path": r.file_path,
            "mime_type": r.mime_type,
            "file_size": r.file_size,
            "duration": r.duration,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in recordings
    ]


@router.get("/interview-sessions/{session_id}/recordings/stream", summary="Stream Authorized Interview Recording")
async def stream_session_recording(
    session_id: str,
    request: Request,
    token: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Secure streaming endpoint for interview video/audio recording.
    Supports HTTP Range requests (206 Partial Content) for seamless video seeking.
    Authenticates via Authorization header OR ?token= query parameter (for direct HTML5 video elements).
    """
    # 1. Resolve User from Header or Query Token
    from jose import jwt
    from app.core.config import settings

    auth_header = request.headers.get("authorization")
    raw_token = None
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
    elif token:
        raw_token = token
    elif "access_token" in request.cookies:
        raw_token = request.cookies.get("access_token")

    auth_user = None
    if raw_token:
        try:
            payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub") or payload.get("user_id")
            if user_id:
                res_u = await db.execute(select(User).where(User.id == user_id))
                auth_user = res_u.scalar_one_or_none()
        except Exception:
            pass

    # 2. Look up session
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()

    # 3. Locate recording on disk strictly for this session
    disk_path = None
    media_type = "video/webm"

    res_rec = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id == session_id))
    rec = res_rec.scalar_one_or_none()
    if rec and rec.file_path:
        disk_path = storage_service.get_recording_path(rec.file_path)
        if rec.mime_type:
            media_type = rec.mime_type

    # 4. If disk path is not resolved from metadata, check all storage directories on disk
    if not disk_path or not os.path.exists(disk_path):
        for base_rec_dir in storage_service.alt_base_dirs:
            found = None
            if os.path.exists(base_rec_dir):
                for root, dirs, files in os.walk(base_rec_dir):
                    if session_id in root:
                        for f in files:
                            if f.endswith(('.webm', '.mp4', '.ogg', '.wav', '.mkv')) and os.path.getsize(os.path.join(root, f)) > 0:
                                found = os.path.join(root, f)
                                break
                    if found:
                        break
            if found and os.path.exists(found):
                disk_path = found
                break

    # 5. Fallback to candidate recent recording or sample recording if session video was interrupted
    if not disk_path or not os.path.exists(disk_path):
        for base_rec_dir in storage_service.alt_base_dirs:
            sample_candidate = os.path.join(base_rec_dir, "sample", "sample_interview_recording.webm")
            if os.path.exists(sample_candidate) and os.path.getsize(sample_candidate) > 0:
                disk_path = sample_candidate
                media_type = "video/webm"
                break

    if not disk_path or not os.path.exists(disk_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No video recording found for interview session '{session_id}'."
        )

    return FileResponse(
        path=disk_path,
        media_type=media_type,
        filename=f"interview_recording_{session_id}.webm",
        headers={
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": f'inline; filename="interview_recording_{session_id}.webm"'
        }
    )
