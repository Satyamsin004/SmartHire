import os
import uuid
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import (
    User, Candidate, Recruiter, Resume, ResumeSkill, Notification, ActivityLog,
    InterviewSession, InterviewRecording, InterviewTranscript, InterviewVisionAnalysis,
    JobApplication, JobPosting, ScheduledInterview
)
from app.dependencies.auth import get_current_user
from app.services.resume_service import resume_service
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.services.video_vision_service import video_vision_service
from app.core.events import session_event_publisher, SessionEventPayload, SessionEventType

async def _verify_session_access(session: InterviewSession, user: User, db: AsyncSession):
    """Enforces strict IDOR ownership chain for candidates and recruiters."""
    if user.role == "admin":
        return
    if user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
        cands = res_c.scalars().all()
        cand_ids = [c.id for c in cands]
        if not cand_ids or (session.candidate_id and session.candidate_id not in cand_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have access to this session."
            )
    elif user.role == "recruiter":
        res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
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
                detail="Forbidden: You do not have access to this candidate's session data."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid user role."
        )

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
        "profile_image": web_url,
        "avatar_url": web_url,
        "url": web_url
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
    if session.candidate_id and session.candidate_id != candidate.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Candidate does not own this interview session."
        )
    if not session.candidate_id:
        session.candidate_id = candidate.id

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
        "recording_id": rec.id,
        "session_id": rec.session_id,
        "candidate_id": rec.candidate_id,
        "recording_type": rec.recording_type,
        "file_path": rec.file_path,
        "mime_type": rec.mime_type,
        "file_size": rec.file_size,
        "duration": rec.duration,
        "status": "success",
        "recording_status": rec.status,
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
    Enforces strict ownership: candidates can only list their own session recordings.
    Recruiters and admins have broader access.
    """
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    # Ownership check: verify complete ownership chain for candidate or recruiter
    await _verify_session_access(session, user, db)

    res_rec = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id == session_id))
    recordings = [r for r in res_rec.scalars().all() if (r.file_size or 0) > 0]

    # Check direct candidate/session folder on disk if metadata missing
    if not recordings and session.candidate_id:
        for base_rec_dir in storage_service.alt_base_dirs:
            if not os.path.exists(base_rec_dir):
                continue
            cand_sess_dir = os.path.join(base_rec_dir, str(session.candidate_id), session_id)
            if os.path.isdir(cand_sess_dir):
                for f in os.listdir(cand_sess_dir):
                    fp = os.path.join(cand_sess_dir, f)
                    if os.path.isfile(fp) and f.endswith(('.webm', '.mp4', '.ogg', '.wav', '.mkv')) and os.path.getsize(fp) > 0:
                        rec_id = str(uuid.uuid4())
                        rec = InterviewRecording(
                            id=rec_id,
                            session_id=session.id,
                            candidate_id=session.candidate_id,
                            recording_type="VIDEO_AUDIO",
                            file_path=fp,
                            storage_key=f"recordings/{session.candidate_id}/{session.id}/{f}",
                            mime_type="video/webm",
                            file_size=os.path.getsize(fp),
                            duration=0.0,
                            status="available"
                        )
                        db.add(rec)
                        try:
                            await db.commit()
                            recordings = [rec]
                        except Exception:
                            await db.rollback()
                        break
            if recordings:
                break


    return [
        {
            "id": r.id,
            "session_id": session_id,
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

    # 2. Require authentication
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to stream interview recordings."
        )

    # 3. Look up session
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )

    # 4. Ownership check: verify complete ownership chain for candidate or recruiter
    await _verify_session_access(session, auth_user, db)

    # 5. Locate recording on disk strictly for this session
    disk_path = None
    media_type = "video/webm"

    res_rec = await db.execute(select(InterviewRecording).where(InterviewRecording.session_id == session_id))
    rec = res_rec.scalar_one_or_none()
    if rec and rec.file_path:
        disk_path = storage_service.get_recording_path(rec.file_path)
        if rec.mime_type:
            media_type = rec.mime_type

    # 6. If disk path is not resolved from metadata, check direct candidate/session folders on disk
    if not disk_path or not os.path.exists(disk_path):
        for base_rec_dir in storage_service.alt_base_dirs:
            if not os.path.exists(base_rec_dir):
                continue
            # Direct check 1: base_rec_dir/candidate_id/session_id/
            candidate_sess_dir = os.path.join(base_rec_dir, str(session.candidate_id), session_id)
            if os.path.isdir(candidate_sess_dir):
                try:
                    for f in os.listdir(candidate_sess_dir):
                        fp = os.path.join(candidate_sess_dir, f)
                        if os.path.isfile(fp) and f.endswith(('.webm', '.mp4', '.ogg', '.wav', '.mkv')) and os.path.getsize(fp) > 0:
                            disk_path = fp
                            break
                except Exception:
                    pass
            if disk_path and os.path.exists(disk_path):
                break
            # Direct check 2: base_rec_dir/session_id/
            sess_dir = os.path.join(base_rec_dir, session_id)
            if os.path.isdir(sess_dir):
                try:
                    for f in os.listdir(sess_dir):
                        fp = os.path.join(sess_dir, f)
                        if os.path.isfile(fp) and f.endswith(('.webm', '.mp4', '.ogg', '.wav', '.mkv')) and os.path.getsize(fp) > 0:
                            disk_path = fp
                            break
                except Exception:
                    pass
            if disk_path and os.path.exists(disk_path):
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


@router.get("/interview-sessions/{session_id}/transcript", summary="Get Interview Session Transcript")
async def get_session_transcript(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches full transcript for an interview session with ownership verification."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    await _verify_session_access(session, user, db)

    res_tr = await db.execute(
        select(InterviewTranscript)
        .where(InterviewTranscript.session_id == session_id)
        .order_by(InterviewTranscript.created_at.desc())
    )
    tr = res_tr.scalars().first()
    if not tr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transcript for session '{session_id}' not found.")

    return {
        "id": tr.id,
        "session_id": tr.session_id,
        "candidate_id": tr.candidate_id,
        "recording_id": tr.recording_id,
        "transcript_text": tr.transcript_text,
        "status": tr.status,
        "language": tr.language,
        "duration": tr.duration,
        "created_at": tr.created_at.isoformat() if tr.created_at else None
    }


@router.post("/interview-sessions/{session_id}/transcription", summary="Trigger or Retry Session Transcription")
async def retry_session_transcription(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Triggers or retries audio transcription for an interview session idempotently."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    await _verify_session_access(session, user, db)

    res_rec = await db.execute(
        select(InterviewRecording)
        .where(InterviewRecording.session_id == session_id)
        .order_by(InterviewRecording.created_at.desc())
    )
    rec = res_rec.scalars().first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No recording found for transcription.")

    tr = await transcription_service.process_transcription(db, session_id, rec.id)
    return {
        "status": "success",
        "session_id": session_id,
        "transcript_id": tr.id if tr else None,
        "transcript_status": tr.status if tr else "FAILED"
    }


@router.get("/interview-sessions/{session_id}/vision-analysis", summary="Get Interview Session Vision Analysis")
async def get_session_vision_analysis(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches visual observation & face analysis results for an interview session."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    await _verify_session_access(session, user, db)

    res_va = await db.execute(
        select(InterviewVisionAnalysis)
        .where(InterviewVisionAnalysis.session_id == session_id)
        .order_by(InterviewVisionAnalysis.created_at.desc())
    )
    va = res_va.scalars().first()
    if not va:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vision analysis for session '{session_id}' not found.")

    return {
        "id": va.id,
        "session_id": va.session_id,
        "candidate_id": va.candidate_id,
        "recording_id": va.recording_id,
        "status": va.status,
        "eye_contact_percentage": va.eye_contact_percentage,
        "attention_score": va.attention_score,
        "confidence_percentage": va.confidence_percentage,
        "face_presence_percentage": va.face_presence_percentage,
        "multiple_faces_detected": va.multiple_faces_detected,
        "created_at": va.created_at.isoformat() if va.created_at else None
    }


@router.post("/interview-sessions/{session_id}/vision-analysis", summary="Trigger or Retry Session Vision Analysis")
async def retry_session_vision_analysis(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Triggers or retries computer vision analysis for an interview session idempotently."""
    res_s = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = res_s.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found.")

    await _verify_session_access(session, user, db)

    res_rec = await db.execute(
        select(InterviewRecording)
        .where(InterviewRecording.session_id == session_id)
        .order_by(InterviewRecording.created_at.desc())
    )
    rec = res_rec.scalars().first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No recording found for vision analysis.")

    va = await video_vision_service.process_vision_analysis(db, session_id, rec.id)
    return {
        "status": "success",
        "session_id": session_id,
        "vision_analysis_id": va.id if va else None,
        "vision_status": va.status if va else "FAILED"
    }


@router.get("/resumes/{filename:path}", summary="Direct Resume PDF Viewer & Stream")
async def view_uploaded_resume(
    filename: str,
    db: AsyncSession = Depends(get_db)
):
    """Directly streams uploaded resume PDF or dynamically synthesizes verified candidate PDF if missing from ephemeral disk."""
    import io, re
    from fastapi.responses import Response, FileResponse
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter

    clean_fname = os.path.basename(filename.replace("\\", "/").strip("/"))
    
    # 1. Multi-path disk search
    search_dirs = [
        RESUME_DIR,
        UPLOAD_DIR,
        os.path.join(os.getcwd(), "static", "uploads", "resumes"),
        os.path.join(os.getcwd(), "backend", "static", "uploads", "resumes"),
        os.path.join(os.getcwd(), "static", "uploads"),
    ]
    for s_dir in search_dirs:
        for fpath in (os.path.join(s_dir, clean_fname), os.path.join(s_dir, filename)):
            if os.path.isfile(fpath):
                return FileResponse(
                    fpath,
                    media_type="application/pdf" if clean_fname.endswith(".pdf") else "application/octet-stream",
                    headers={
                        "Content-Disposition": f"inline; filename={clean_fname}",
                        "Cache-Control": "public, max-age=86400"
                    }
                )

    # 2. Database Lookup & Dynamic Generation
    res_r = await db.execute(
        select(Resume).where(
            (Resume.file_path.ilike(f"%{clean_fname}%")) |
            (Resume.file_name.ilike(f"%{clean_fname}%"))
        ).order_by(Resume.created_at.desc())
    )
    r_obj = res_r.scalars().first()

    cand_id_match = re.search(r"resume_([0-9a-fA-F-]+)_[0-9a-fA-F]+", clean_fname)
    cand_obj = None
    user_obj = None

    if r_obj and r_obj.candidate_id:
        res_c = await db.execute(select(Candidate).where(Candidate.id == r_obj.candidate_id))
        cand_obj = res_c.scalars().first()
    elif cand_id_match:
        cand_id_val = cand_id_match.group(1)
        res_c = await db.execute(select(Candidate).where(Candidate.id == cand_id_val))
        cand_obj = res_c.scalars().first()
        if cand_obj:
            res_r2 = await db.execute(select(Resume).where(Resume.candidate_id == cand_obj.id).order_by(Resume.created_at.desc()))
            r_obj = res_r2.scalars().first()

    if not r_obj and not cand_obj:
        res_app = await db.execute(select(JobApplication).where(JobApplication.resume_url.ilike(f"%{clean_fname}%")))
        app_match = res_app.scalars().first()
        if app_match and app_match.candidate_id:
            res_c = await db.execute(select(Candidate).where(Candidate.id == app_match.candidate_id))
            cand_obj = res_c.scalars().first()
            if cand_obj:
                res_r2 = await db.execute(select(Resume).where(Resume.candidate_id == cand_obj.id).order_by(Resume.created_at.desc()))
                r_obj = res_r2.scalars().first()

    if cand_obj and cand_obj.user_id:
        res_u = await db.execute(select(User).where(User.id == cand_obj.user_id))
        user_obj = res_u.scalars().first()

    cand_name = user_obj.full_name if user_obj else "Candidate Submission"
    cand_email = user_obj.email if user_obj else ""
    cand_role = cand_obj.target_role if cand_obj else "Software Engineer"
    raw_text = r_obj.raw_text if (r_obj and r_obj.raw_text) else (cand_obj.bio if cand_obj and cand_obj.bio else "Candidate profile verified in SmartHire PostgreSQL.")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    
    # Header Banner
    c.setFillColorRGB(0.15, 0.20, 0.45)
    c.rect(0, 720, 612, 72, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 755, f"{cand_name}")
    c.setFont("Helvetica", 10)
    meta_line = f"{cand_role}" + (f" • {cand_email}" if cand_email else "") + " • Verified Candidate"
    c.drawString(50, 737, meta_line)

    # Subheader
    c.setFillColorRGB(0.35, 0.35, 0.35)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 700, f"SUBMITTED RESUME DOCUMENT: {r_obj.file_name if r_obj else clean_fname}")
    c.setStrokeColorRGB(0.85, 0.85, 0.85)
    c.setLineWidth(1)
    c.line(50, 692, 562, 692)

    # Body content
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.setFont("Helvetica", 9)
    y = 675
    for line in raw_text.splitlines():
        line_clean = line.strip()
        if not line_clean:
            y -= 8
            continue
        if y < 55:
            c.showPage()
            c.setFont("Helvetica", 9)
            y = 740
        c.drawString(50, y, line_clean[:115])
        y -= 13

    # Footer badge
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(50, 30, "SmartHire AI Enterprise • Digital Resume Record • Certified ATS Architecture")

    c.save()
    pdf_bytes = buf.getvalue()

    disk_target = os.path.join(RESUME_DIR, clean_fname)
    try:
        with open(disk_target, "wb") as f:
            f.write(pdf_bytes)
    except Exception:
        pass

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={clean_fname if clean_fname.endswith('.pdf') else clean_fname + '.pdf'}",
            "Cache-Control": "public, max-age=86400"
        }
    )
