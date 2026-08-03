import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, Resume, Notification, InterviewSession, OfferLetter
from app.dependencies.auth import get_current_user, require_role
from app.services.resume_service import resume_service
from app.services.interview_service import PipelineManager
from app.api.v1.websocket import ws_manager

router = APIRouter(prefix="/jobs", tags=["Jobs & Applications"])

class CreateJobRequest(BaseModel):
    title: str
    company_name: Optional[str] = "SmartHire Corporate"
    company_logo: Optional[str] = None
    department: str = "Engineering"
    employment_type: str = "Full Time" # Full Time, Part Time, Internship, Contract
    work_mode: str = "Remote" # Remote, Hybrid, On-site
    experience_required: str = "3-5 Years"
    location: str = "San Francisco, CA / Remote"
    salary_range: str = "$120,000 - $160,000"
    description: Optional[str] = None
    education_required: Optional[str] = "Bachelor's Degree in CS or equivalent"
    required_skills: List[str] = ["React", "TypeScript", "FastAPI", "PostgreSQL"]
    preferred_skills: Optional[List[str]] = ["Docker", "Kubernetes", "Redis"]
    responsibilities: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    perks: Optional[str] = None
    openings: int = 2
    selection_process: Optional[str] = "Resume Screening -> Technical Interview -> HR Round"
    recruiter_contact: Optional[str] = None
    recruiter_email: Optional[str] = None
    recruiter_phone: Optional[str] = None
    interview_rounds: Optional[List[str]] = ["Resume Screening", "Technical Interview", "HR Round"]
    hiring_timeline: Optional[str] = "2 Weeks"
    status: str = "Published" # Draft or Published

class ApplyJobRequest(BaseModel):
    cover_letter: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    expected_salary: Optional[str] = None
    notice_period: Optional[str] = None
    current_company: Optional[str] = None
    work_authorization: Optional[str] = "Authorized to work in US"
    availability: Optional[str] = "Immediate"
    declaration: bool = True

@router.post("/create", summary="Create New Job Posting (LinkedIn/Naukri Enterprise Style)")
async def create_job(
    body: CreateJobRequest,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Allows recruiter/admin to create a professional hiring requisition. Published jobs appear automatically on candidate portals."""
    res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    recruiter = res_r.scalar_one_or_none()
    if not recruiter:
        recruiter = Recruiter(user_id=user.id, company_name=body.company_name or "SmartHire Corporate")
        db.add(recruiter)
        await db.flush()

    new_job = JobPosting(
        recruiter_id=recruiter.id,
        company_name=body.company_name or recruiter.company_name or "SmartHire Corporate",
        company_logo=body.company_logo or getattr(recruiter, "company_logo", None),
        title=body.title,
        department=body.department,
        employment_type=body.employment_type,
        work_mode=body.work_mode,
        experience_required=body.experience_required,
        location=body.location,
        salary_range=body.salary_range,
        description=body.description or body.responsibilities or f"{body.title} opportunity at {body.company_name}",
        education_required=body.education_required,
        required_skills=body.required_skills,
        preferred_skills=body.preferred_skills or [],
        responsibilities=body.responsibilities,
        requirements=body.requirements,
        benefits=body.benefits,
        perks=body.perks,
        openings=body.openings,
        selection_process=body.selection_process,
        recruiter_contact=body.recruiter_contact or user.full_name,
        recruiter_email=body.recruiter_email or user.email,
        recruiter_phone=body.recruiter_phone,
        interview_rounds=body.interview_rounds or ["Resume Screening", "Technical Interview"],
        hiring_timeline=body.hiring_timeline,
        status=body.status
    )
    db.add(new_job)

    # Broadcast notification to candidates if Published
    if body.status == "Published":
        res_candidates = await db.execute(select(User).where(User.role == "candidate"))
        candidates = res_candidates.scalars().all()
        for cand_user in candidates:
            notif = Notification(
                user_id=cand_user.id,
                title=f"New Job Opportunity: {new_job.title}",
                message=f"{new_job.company_name} posted a new position: {new_job.title} in {new_job.location}.",
                notification_type="new_job_posted"
            )
            db.add(notif)

        await ws_manager.broadcast({
            "event": "NEW_JOB_POSTED",
            "data": {
                "job_id": new_job.id,
                "title": new_job.title,
                "company_name": new_job.company_name,
                "department": new_job.department,
                "location": new_job.location
            }
        })

    await db.commit()

    return {
        "status": "success",
        "message": f"Job posting created as '{new_job.status}'.",
        "job": {
            "id": new_job.id,
            "title": new_job.title,
            "company_name": new_job.company_name,
            "department": new_job.department,
            "work_mode": new_job.work_mode,
            "status": new_job.status,
            "created_at": new_job.created_at.isoformat()
        }
    }

@router.get("/my-jobs", response_model=Dict[str, Any], summary="Get Recruiter Requisitions & Analytics")
async def get_my_jobs(
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Returns ONLY the authenticated recruiter's posted jobs with real database analytics."""
    res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    recruiter = res_r.scalar_one_or_none()
    if not recruiter and user.role != "admin":
        return {
            "jobs": [],
            "analytics": {"total_jobs": 0, "active_jobs": 0, "draft_jobs": 0, "closed_jobs": 0, "total_applications": 0}
        }

    if user.role == "admin":
        res = await db.execute(select(JobPosting).order_by(JobPosting.created_at.desc()))
    else:
        res = await db.execute(select(JobPosting).where(JobPosting.recruiter_id == recruiter.id).order_by(JobPosting.created_at.desc()))

    jobs = res.scalars().all()

    out = []
    active_cnt = 0
    draft_cnt = 0
    closed_cnt = 0
    total_apps_cnt = 0

    for j in jobs:
        if j.status == "Published": active_cnt += 1
        elif j.status == "Draft": draft_cnt += 1
        elif j.status == "Closed": closed_cnt += 1

        res_apps = await db.execute(select(JobApplication).where(JobApplication.job_id == j.id))
        apps = res_apps.scalars().all()
        app_cnt = len(apps)
        total_apps_cnt += app_cnt

        out.append({
            "id": j.id,
            "title": j.title,
            "company_name": j.company_name,
            "company_logo": j.company_logo,
            "department": j.department,
            "employment_type": j.employment_type,
            "work_mode": j.work_mode,
            "experience_required": j.experience_required,
            "location": j.location,
            "salary_range": j.salary_range,
            "description": j.description,
            "education_required": j.education_required,
            "required_skills": j.required_skills,
            "preferred_skills": j.preferred_skills,
            "responsibilities": j.responsibilities,
            "requirements": j.requirements,
            "benefits": j.benefits,
            "perks": j.perks,
            "openings": j.openings,
            "interview_rounds": j.interview_rounds,
            "status": j.status,
            "applicant_count": app_cnt,
            "created_at": j.created_at.isoformat()
        })

    return {
        "jobs": out,
        "analytics": {
            "total_jobs": len(jobs),
            "active_jobs": active_cnt,
            "draft_jobs": draft_cnt,
            "closed_jobs": closed_cnt,
            "total_applications": total_apps_cnt
        }
    }

@router.get("/public", response_model=List[Dict[str, Any]], summary="Browse Published Job Postings")
@router.get("/published", response_model=List[Dict[str, Any]])
async def get_public_jobs(db: AsyncSession = Depends(get_db)):
    """Returns ONLY published job postings for candidates to browse and apply."""
    res = await db.execute(select(JobPosting).where(JobPosting.status == "Published").order_by(JobPosting.created_at.desc()))
    jobs = res.scalars().all()

    out = []
    for j in jobs:
        res_apps = await db.execute(select(JobApplication).where(JobApplication.job_id == j.id))
        app_count = len(res_apps.scalars().all())

        out.append({
            "id": j.id,
            "title": j.title,
            "company_name": j.company_name,
            "company_logo": j.company_logo,
            "department": j.department,
            "employment_type": j.employment_type,
            "work_mode": j.work_mode,
            "experience_required": j.experience_required,
            "location": j.location,
            "salary_range": j.salary_range,
            "description": j.description,
            "education_required": j.education_required,
            "required_skills": j.required_skills,
            "preferred_skills": j.preferred_skills,
            "responsibilities": j.responsibilities,
            "requirements": j.requirements,
            "benefits": j.benefits,
            "perks": j.perks,
            "openings": j.openings,
            "selection_process": j.selection_process,
            "recruiter_contact": j.recruiter_contact,
            "recruiter_email": j.recruiter_email,
            "interview_rounds": j.interview_rounds,
            "applicant_count": app_count,
            "created_at": j.created_at.isoformat()
        })
    return out

@router.post("/{job_id}/apply", summary="Submit Application with Real AI Screening")
async def apply_for_job(
    job_id: str,
    body: ApplyJobRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submits job application and performs AI Resume Screening against Job Description."""
    res_job = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id, phone=body.phone, target_role=job.title)
        db.add(candidate)
        await db.flush()
    else:
        # Dynamically set target role from applied job!
        candidate.target_role = job.title

    # Check duplicate application
    res_exist = await db.execute(select(JobApplication).where(
        JobApplication.job_id == job.id,
        JobApplication.candidate_id == candidate.id
    ))
    if res_exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already submitted an application for this job.")

    # Get candidate's uploaded resume
    res_resume = await db.execute(select(Resume).where(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc()))
    resume = res_resume.scalars().first()

    candidate_skills = list(resume.keyword_density.keys()) if (resume and resume.keyword_density) else ["React", "Python", "FastAPI"]
    req_skills = job.required_skills if isinstance(job.required_skills, list) else []
    match_result = resume_service.match_job_description(
        candidate_skills=candidate_skills,
        job_description=f"{job.title} {job.description or ''} {' '.join(req_skills)}"
    )
    ats_score = match_result.get("match_score", 85.0)
    matching_skills = match_result.get("matching_skills", [])
    missing_skills = match_result.get("missing_skills", [])
    candidate.readiness_score = ats_score

    # Process Automatic ATS Decision (<80% Auto-Reject, >=80% Shortlist)
    decision = await PipelineManager.process_ats_decision(
        db=db,
        job=job,
        candidate=candidate,
        cand_user=user,
        ats_score=ats_score
    )

    new_app = JobApplication(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_id=resume.id if resume else None,
        cover_letter=body.cover_letter,
        phone=body.phone or candidate.phone,
        address=body.address,
        linkedin_url=body.linkedin_url,
        github_url=body.github_url,
        portfolio_url=body.portfolio_url,
        current_ctc=body.current_ctc,
        expected_ctc=body.expected_ctc,
        expected_salary=body.expected_salary or body.expected_ctc,
        notice_period=body.notice_period,
        current_company=body.current_company,
        work_authorization=body.work_authorization,
        availability=body.availability,
        declaration=body.declaration,
        ats_score=ats_score,
        matching_skills=matching_skills,
        missing_skills=missing_skills,
        ai_recommendation=decision["ai_recommendation"],
        status=decision["status"]
    )
    db.add(new_app)
    await db.commit()
    # Candidate notification
    notif_cand = Notification(
        user_id=user.id,
        title=f"Application Submitted: {job.title}",
        message=f"Your application for {job.title} at {job.company_name} was submitted successfully.",
        notification_type="application_submitted"
    )
    db.add(notif_cand)

    # Recruiter notification
    res_r = await db.execute(select(Recruiter).where(Recruiter.id == job.recruiter_id))
    rec = res_r.scalar_one_or_none()
    if rec and rec.user_id:
        notif_rec = Notification(
            user_id=rec.user_id,
            title=f"New Application Received: {job.title}",
            message=f"{user.full_name} submitted an application for {job.title}.",
            notification_type="new_application"
        )
        db.add(notif_rec)
        await ws_manager.send_personal_message({
            "event": "NEW_APPLICATION_RECEIVED",
            "data": {"application_id": new_app.id, "job_title": job.title, "candidate_name": user.full_name}
        }, rec.user_id)

    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully applied for {job.title}.",
        "application_id": new_app.id,
        "ats_score": ats_score,
        "ai_recommendation": decision["ai_recommendation"]
    }

@router.get("/my-applications", response_model=List[Dict[str, Any]], summary="Get Candidate Submitted Applications")
async def get_my_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all job applications submitted by the authenticated candidate."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return []

    res = await db.execute(select(JobApplication).where(JobApplication.candidate_id == candidate.id).order_by(JobApplication.applied_at.desc()))
    apps = res.scalars().all()

    out = []
    for app in apps:
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == app.job_id))
        job = res_j.scalar_one_or_none()

        # Check interview status
        res_s = await db.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate.id))
        sess = res_s.scalars().first()
        int_status = sess.status.capitalize() if sess else ("Scheduled" if "Scheduled" in app.status else "Not Scheduled")

        # Check offer status
        res_o = await db.execute(select(OfferLetter).where(OfferLetter.job_application_id == app.id))
        off = res_o.scalar_one_or_none()
        offer_stat = off.status if off else "N/A"

        out.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title if job else "Software Position",
            "company_name": job.company_name if job else "SmartHire Corporate",
            "location": job.location if job else "Remote",
            "work_mode": job.work_mode if job else "Remote",
            "ats_score": round(app.ats_score, 1) if app.ats_score is not None else None,
            "ai_recommendation": app.ai_recommendation or "Pending Review",
            "status": app.status,
            "interview_status": int_status,
            "offer_status": offer_stat,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None
        })
    return out

from app.models.domain import SavedJob

async def verify_job_ownership(job: JobPosting, user: User, db: AsyncSession):
    if user.role == "admin":
        return
    res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    recruiter = res_r.scalar_one_or_none()
    if not recruiter or job.recruiter_id != recruiter.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only edit, close, or delete your own job requisitions."
        )

@router.put("/{job_id}", summary="Edit Job Posting")
@router.patch("/{job_id}", summary="Edit Job Posting Partial")
async def edit_job(
    job_id: str,
    body: CreateJobRequest,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Allows recruiters to update an existing job posting they own."""
    res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    await verify_job_ownership(job, user, db)

    for field, val in body.dict(exclude_unset=True).items():
        if hasattr(job, field) and val is not None:
            setattr(job, field, val)

    await db.commit()
    return {"status": "success", "message": f"Job posting '{job.title}' updated successfully."}

@router.patch("/{job_id}/close", summary="Close Job Posting")
@router.post("/{job_id}/close", summary="Close Job Posting")
async def close_job(
    job_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Changes job posting status to Closed."""
    res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    await verify_job_ownership(job, user, db)

    job.status = "Closed"
    await db.commit()
    return {"status": "success", "message": f"Job posting '{job.title}' closed successfully."}

@router.patch("/{job_id}/unpublish", summary="Unpublish Job Posting")
@router.post("/{job_id}/unpublish", summary="Unpublish Job Posting")
async def unpublish_job(
    job_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Changes job posting status to Draft."""
    res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    await verify_job_ownership(job, user, db)

    job.status = "Draft"
    await db.commit()
    return {"status": "success", "message": f"Job posting '{job.title}' moved to Drafts."}

@router.post("/{job_id}/duplicate", summary="Duplicate Job Posting Requisition")
async def duplicate_job(
    job_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Duplicates an existing job posting as a new draft."""
    res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    await verify_job_ownership(job, user, db)

    new_job = JobPosting(
        recruiter_id=job.recruiter_id,
        company_name=job.company_name,
        company_logo=job.company_logo,
        title=f"Copy of {job.title}",
        department=job.department,
        employment_type=job.employment_type,
        work_mode=job.work_mode,
        experience_required=job.experience_required,
        location=job.location,
        salary_range=job.salary_range,
        description=job.description,
        education_required=job.education_required,
        required_skills=job.required_skills,
        preferred_skills=job.preferred_skills,
        responsibilities=job.responsibilities,
        requirements=job.requirements,
        benefits=job.benefits,
        perks=job.perks,
        openings=job.openings,
        selection_process=job.selection_process,
        recruiter_contact=job.recruiter_contact,
        recruiter_email=job.recruiter_email,
        recruiter_phone=job.recruiter_phone,
        interview_rounds=job.interview_rounds,
        hiring_timeline=job.hiring_timeline,
        status="Draft"
    )
    db.add(new_job)
    await db.commit()
    return {"status": "success", "message": f"Job requisition duplicated as '{new_job.title}'.", "job_id": new_job.id}

@router.delete("/{job_id}", summary="Delete Job Posting")
async def delete_job(
    job_id: str,
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Deletes job posting record from database."""
    res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    await verify_job_ownership(job, user, db)

    await db.delete(job)
    await db.commit()
    return {"status": "success", "message": "Job posting deleted successfully."}

@router.post("/{job_id}/bookmark", summary="Save / Bookmark Job for Candidate")
async def bookmark_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows candidates to save/bookmark jobs."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)
        await db.flush()

    res_b = await db.execute(select(SavedJob).where(SavedJob.candidate_id == candidate.id, SavedJob.job_id == job_id))
    existing = res_b.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"status": "success", "bookmarked": False, "message": "Job removed from saved list."}

    new_bookmark = SavedJob(candidate_id=candidate.id, job_id=job_id)
    db.add(new_bookmark)
    await db.commit()
    return {"status": "success", "bookmarked": True, "message": "Job saved successfully."}

@router.get("/bookmarks", response_model=List[Dict[str, Any]], summary="Get Candidate Saved Jobs")
async def get_saved_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns candidate's bookmarked jobs."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        return []

    res_b = await db.execute(select(SavedJob).where(SavedJob.candidate_id == candidate.id))
    bookmarks = res_b.scalars().all()

    out = []
    for b in bookmarks:
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == b.job_id))
        job = res_j.scalar_one_or_none()
        if job:
            out.append({
                "id": job.id,
                "title": job.title,
                "company_name": job.company_name,
                "company_logo": job.company_logo,
                "location": job.location,
                "work_mode": job.work_mode,
                "salary_range": job.salary_range,
                "status": job.status
            })
    return out

