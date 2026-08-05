from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.domain import User
from app.dependencies.auth import get_current_user, require_role
from app.api.v1.jobs import apply_for_job, get_my_applications, ApplyJobRequest
from app.api.v1.recruiter import get_job_applications, get_job_applications_by_id

router = APIRouter(prefix="/applications", tags=["Applications Gateway"])

class DirectApplyRequest(ApplyJobRequest):
    job_id: Optional[str] = None

@router.post("/apply", summary="Global Application Submission Gateway")
async def global_apply(
    body: DirectApplyRequest,
    job_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Global alias routing endpoint for submitting job applications."""
    target_job_id = job_id or body.job_id
    if not target_job_id:
        raise HTTPException(status_code=400, detail="Missing required job_id field.")
    return await apply_for_job(job_id=target_job_id, body=body, user=user, db=db)

@router.get("/my", summary="Get Current Candidate Applications")
async def global_my_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Global alias routing endpoint for candidate's submitted job applications."""
    return await get_my_applications(user=user, db=db)

@router.get("/recruiter", summary="Get Recruiter Job Applications")
async def global_recruiter_applications(
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Global alias routing endpoint for recruiter's job applications."""
    return await get_job_applications(user=user, db=db)

@router.get("/recruiter/{job_id}", summary="Get Specific Job Applications")
async def global_recruiter_job_applications(
    job_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Global alias routing endpoint for specific job applications."""
    return await get_job_applications_by_id(job_id=job_id, user=user, db=db)
