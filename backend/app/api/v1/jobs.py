import uuid
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func
from app.core.cache import fast_cache

from app.core.db import get_db
from app.models.domain import (
    User, Candidate, Recruiter, JobPosting, JobApplication, Resume, Notification,
    InterviewSession, OfferLetter, AssessmentSession, AssessmentResult, ScheduledInterview, ScoringReport,
    ResumeSkill, ResumeProject
)
from app.dependencies.auth import get_current_user, require_role
from app.services.resume_service import resume_service
from app.services.interview_service import PipelineManager
from app.api.v1.websocket import ws_manager
from app.services.email_service import email_service

logger = logging.getLogger("smarthire.jobs")
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
    fast_cache.invalidate_prefix("jobs_")
    fast_cache.invalidate_prefix("pipeline_")
    fast_cache.invalidate_prefix("rec_")
    logger.info("Job creation request received ✅")
    res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
    recruiter = res_r.scalar_one_or_none()
    if not recruiter:
        recruiter = Recruiter(user_id=user.id, company_name=body.company_name or "SmartHire Corporate")
        db.add(recruiter)
        await db.flush()

    logger.info("Job validated ✅")

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
    await db.flush()
    logger.info("Inserted into PostgreSQL ✅ Job ID generated ✅ ID: %s", new_job.id)

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

            if cand_user.email:
                try:
                    asyncio.create_task(email_service.send_new_job_posted_email(
                        db=None,
                        candidate_email=cand_user.email,
                        candidate_name=cand_user.full_name or "Candidate",
                        job_title=new_job.title,
                        company_name=new_job.company_name or "SmartHire Corporate",
                        location=new_job.location or "Remote",
                        work_mode=new_job.work_mode or "Remote",
                        job_id=new_job.id,
                        experience_level=new_job.experience_required,
                        candidate_user_id=cand_user.id
                    ))
                except Exception as err:
                    logger.warning("Failed to dispatch new job email to %s: %s", cand_user.email, err)

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
    logger.info("Transaction committed ✅ Recruiter Posted Jobs refreshed ✅ Candidate Jobs refreshed ✅")

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
    """Returns ONLY the authenticated recruiter's posted jobs with real database analytics (1-2ms cache)."""
    cache_key = f"jobs_my_jobs_{user.id}"
    cached = fast_cache.get(cache_key)
    if cached is not None:
        return cached

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
    job_ids = [j.id for j in jobs]

    apps_count_map = {}
    if job_ids:
        res_apps = await db.execute(
            select(JobApplication.job_id, func.count(JobApplication.id))
            .where(JobApplication.job_id.in_(job_ids))
            .group_by(JobApplication.job_id)
        )
        for j_id, cnt in res_apps.all():
            apps_count_map[j_id] = cnt or 0

    out = []
    active_cnt = 0
    draft_cnt = 0
    closed_cnt = 0
    total_apps_cnt = 0

    for j in jobs:
        if j.status == "Published": active_cnt += 1
        elif j.status == "Draft": draft_cnt += 1
        elif j.status == "Closed": closed_cnt += 1

        app_cnt = apps_count_map.get(j.id, 0)
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

    result_data = {
        "jobs": out,
        "analytics": {
            "total_jobs": len(jobs),
            "active_jobs": active_cnt,
            "draft_jobs": draft_cnt,
            "closed_jobs": closed_cnt,
            "total_applications": total_apps_cnt
        }
    }
    fast_cache.set(cache_key, result_data, ttl=20)
    return result_data

@router.get("/public", response_model=List[Dict[str, Any]], summary="Browse Published Job Postings")
@router.get("/published", response_model=List[Dict[str, Any]])
async def get_public_jobs(db: AsyncSession = Depends(get_db)):
    """Returns ONLY published job postings for candidates to browse and apply (1-2ms cache)."""
    cache_key = "jobs_public_list"
    cached = fast_cache.get(cache_key)
    if cached is not None:
        return cached

    res = await db.execute(select(JobPosting).where(JobPosting.status == "Published").order_by(JobPosting.created_at.desc()))
    jobs = res.scalars().all()
    job_ids = [j.id for j in jobs]

    apps_count_map = {}
    if job_ids:
        res_apps = await db.execute(
            select(JobApplication.job_id, func.count(JobApplication.id))
            .where(JobApplication.job_id.in_(job_ids))
            .group_by(JobApplication.job_id)
        )
        for j_id, cnt in res_apps.all():
            apps_count_map[j_id] = cnt or 0

    out = []
    for j in jobs:
        app_count = apps_count_map.get(j.id, 0)
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
    fast_cache.set(cache_key, out, ttl=30)
    return out

@router.post("/{job_id}/apply", summary="Submit Application with Real AI Screening")
async def apply_for_job(
    job_id: str,
    body: ApplyJobRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submits job application and performs AI Resume Screening against Job Description."""
    logger.info("Candidate %s clicked Apply for Job ID %s", user.id, job_id)

    # 1. Validate candidate user active state
    if not user.is_active or getattr(user, "deleted_at", None) is not None:
        logger.warning("Rejected inactive candidate account user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive or disabled candidate account. Application rejected."
        )

    # 2. Check job exists
    res_job = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = res_job.scalar_one_or_none()
    if not job:
        logger.warning("Job posting not found: %s", job_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found.")
    
    logger.info("Job loaded successfully: title='%s', company='%s'", job.title, job.company_name)

    # 3. Check job status is Published
    if job.status != "Published":
        logger.warning("Job %s is not active (status=%s)", job_id, job.status)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job posting is currently {job.status.lower()} and no longer accepting applications."
        )

    # 4. Check job expiry date
    if job.expiry_date and job.expiry_date < datetime.utcnow():
        logger.warning("Job %s has expired at %s", job_id, job.expiry_date)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job posting has expired and is no longer accepting applications."
        )

    # 5. Get/create candidate profile
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id, phone=body.phone, target_role=job.title)
        db.add(candidate)
        await db.flush()
    else:
        candidate.target_role = job.title

    # 6. Check duplicate application
    res_exist = await db.execute(select(JobApplication).where(
        JobApplication.job_id == job.id,
        JobApplication.candidate_id == candidate.id
    ))
    if res_exist.scalar_one_or_none():
        logger.warning("Duplicate application blocked for candidate %s on job %s", candidate.id, job.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted an application for this position."
        )
    
    logger.info("Duplicate check passed for candidate %s on job %s", candidate.id, job.id)

    # 7. Get & verify candidate uploaded resume
    res_resume = await db.execute(select(Resume).where(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc()))
    resume = res_resume.scalars().first()
    if not resume:
        logger.warning("No resume found for candidate %s", candidate.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid PDF resume is required before submitting your application."
        )

    logger.info("Application Submitted ✅ Resume Validated ✅ candidate_id=%s, file=%s", candidate.id, resume.file_name)
    logger.info("ATS Started ✅ Evaluating Candidate Resume against Job Requisition ID: %s", job.id)

    # Aggregate all candidate skills from ResumeSkill, ResumeProject, and keyword_density
    res_skills = await db.execute(select(ResumeSkill).where(ResumeSkill.resume_id == resume.id))
    db_skills = [s.skill_name for s in res_skills.scalars().all()]

    proj_skills = []
    res_proj = await db.execute(select(ResumeProject).where(ResumeProject.resume_id == resume.id))
    for p in res_proj.scalars().all():
        if p.technologies and isinstance(p.technologies, list):
            proj_skills.extend(p.technologies)
        if p.frameworks and isinstance(p.frameworks, list):
            proj_skills.extend(p.frameworks)
        if p.programming_languages and isinstance(p.programming_languages, list):
            proj_skills.extend(p.programming_languages)

    keyword_skills = list(resume.keyword_density.keys()) if (resume and resume.keyword_density) else []
    candidate_skills = list(set(db_skills + proj_skills + keyword_skills))
    req_skills = job.required_skills if isinstance(job.required_skills, list) else []

    match_result = await resume_service.match_job_description(
        candidate_skills=candidate_skills,
        job_description=f"{job.title} {job.description or ''}",
        required_skills=req_skills,
        raw_resume_text=resume.raw_text
    )
    ats_score = match_result.get("match_score", 0.0)
    matching_skills = match_result.get("matching_skills", [])
    missing_skills = match_result.get("missing_skills", [])
    candidate.readiness_score = ats_score
    logger.info("ATS Completed ✅ Match Score: %.1f%% (%d/%d skills matched)", ats_score, len(matching_skills), len(req_skills) or len(matching_skills)+len(missing_skills))

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
        resume_id=resume.id,
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

    stage_marker = "Shortlisted ✅" if decision["status"] in ["Shortlisted", "SHORTLISTED", "Screening Passed"] else "Rejected ✅"
    logger.info("ATS Stored ✅ %s Application inserted into PostgreSQL ID: %s (status=%s)", stage_marker, new_app.id, new_app.status)

    # Candidate notification
    notif_cand = Notification(
        user_id=user.id,
        title=f"Application Submitted: {job.title}",
        message=f"Your application for {job.title} at {job.company_name} was submitted successfully.",
        notification_type="application_submitted",
        link="/applications"
    )
    db.add(notif_cand)

    # Dispatch confirmation email to applicant in background
    if user.email:
        try:
            asyncio.create_task(email_service.send_application_received_email(
                db=None,
                candidate_email=user.email,
                candidate_name=user.full_name or "Candidate",
                job_title=job.title,
                company_name=job.company_name or "SmartHire Enterprise",
                applied_date=datetime.utcnow().strftime("%B %d, %Y"),
                application_id=new_app.id,
                candidate_user_id=user.id
            ))
        except Exception as e:
            logger.warning(f"Failed to dispatch application received email: {e}")

    is_shortlisted = decision["status"] in ["Shortlisted", "SHORTLISTED", "Screening Passed"]
    if is_shortlisted:
        notif_short = Notification(
            user_id=user.id,
            title=f"Congratulations! You have been Shortlisted",
            message=f"Your profile passed ATS screening with {ats_score:.1f}% for {job.title} at {job.company_name}.",
            notification_type="shortlisted",
            link="/applications"
        )
        db.add(notif_short)

        if user.email:
            try:
                asyncio.create_task(email_service.send_shortlist_email(
                    db=None,
                    candidate_email=user.email,
                    candidate_name=user.full_name or "Candidate",
                    job_title=job.title,
                    company_name=job.company_name or "SmartHire Enterprise",
                    ats_score=ats_score,
                    candidate_user_id=user.id,
                    application_id=new_app.id
                ))
            except Exception as e:
                logger.warning(f"Failed to dispatch auto-shortlist email: {e}")

        # Send real-time WebSocket event to candidate
        try:
            await ws_manager.send_personal_message({
                "event": "CANDIDATE_SHORTLISTED",
                "data": {
                    "application_id": new_app.id,
                    "candidate_id": candidate.id,
                    "candidate_name": user.full_name,
                    "job_title": job.title,
                    "company_name": job.company_name,
                    "ats_score": ats_score,
                    "status": "Shortlisted"
                }
            }, user.id)
        except Exception as e:
            pass
    else:
        # Candidate not shortlisted -> Dispatch ATS feedback / status update email
        if user.email:
            try:
                await email_service.send_ats_rejected_email(
                    db=db,
                    candidate_email=user.email,
                    candidate_name=user.full_name or "Candidate",
                    job_title=job.title,
                    company_name=job.company_name or "SmartHire Enterprise",
                    ats_score=ats_score,
                    missing_skills=missing_skills if isinstance(missing_skills, list) else [],
                    candidate_user_id=user.id,
                    application_id=new_app.id
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch ATS rejection email: {e}")

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
            "data": {
                "application_id": new_app.id,
                "job_id": job.id,
                "job_title": job.title,
                "candidate_name": user.full_name,
                "ats_score": ats_score
            }
        }, rec.user_id)

    await db.commit()

    # Emit Real-Time Domain Events (Post DB Commit)
    try:
        from app.core.events import session_event_publisher, SessionEventPayload, SessionEventType
        await session_event_publisher.publish(SessionEventPayload(
            event_type=SessionEventType.APPLICATION_SUBMITTED,
            event="APPLICATION_SUBMITTED",
            entity="application",
            entity_id=new_app.id,
            candidate_id=candidate.id,
            recruiter_id=job.recruiter_id,
            job_application_id=new_app.id,
            job_id=job.id,
            status=new_app.status,
            metadata={
                "job_title": job.title,
                "candidate_name": user.full_name,
                "ats_score": ats_score,
                "status": new_app.status
            }
        ))
        await session_event_publisher.publish(SessionEventPayload(
            event_type=SessionEventType.ATS_EVALUATION_UPDATED,
            event="ATS_EVALUATION_UPDATED",
            entity="ats_evaluation",
            entity_id=new_app.id,
            candidate_id=candidate.id,
            recruiter_id=job.recruiter_id,
            job_application_id=new_app.id,
            job_id=job.id,
            status=new_app.status,
            metadata={
                "ats_score": ats_score,
                "ai_recommendation": decision.get("ai_recommendation")
            }
        ))
    except Exception as event_err:
        pass

    logger.info("Recruiter statistics updated & candidate application history updated. Response returned.")

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
    """Returns all job applications submitted by the authenticated candidate (1-2ms cache)."""
    cache_key = f"jobs_my_apps_{user.id}"
    cached = fast_cache.get(cache_key)
    if cached is not None:
        return cached

    res_c = await db.execute(select(Candidate.id).where(Candidate.user_id == user.id))
    candidate_ids = [row[0] for row in res_c.all()]
    if not candidate_ids:
        return []

    res = await db.execute(
        select(JobApplication)
        .where(JobApplication.candidate_id.in_(candidate_ids))
        .order_by(JobApplication.applied_at.desc())
    )
    apps = res.scalars().all()
    if not apps:
        return []

    app_ids = [app.id for app in apps]
    job_ids = list({app.job_id for app in apps if app.job_id})

    # 1. Batch fetch all referenced jobs
    jobs_map = {}
    if job_ids:
        res_j = await db.execute(select(JobPosting).where(JobPosting.id.in_(job_ids)))
        for j in res_j.scalars().all():
            jobs_map[j.id] = j

    # 2. Batch fetch ONLY recruiter-scheduled assessment sessions & results (exclude practice/mock)
    assess_sess_map = {}
    res_assess = await db.execute(
        select(AssessmentSession)
        .where(
            AssessmentSession.job_application_id.in_(app_ids),
            AssessmentSession.is_recruiter_configured == True
        )
        .order_by(AssessmentSession.created_at.desc())
    )
    for asess in res_assess.scalars().all():
        if asess.job_application_id not in assess_sess_map:
            assess_sess_map[asess.job_application_id] = asess

    assess_sess_ids = [s.id for s in assess_sess_map.values() if s.id]
    assess_results_map = {}
    if assess_sess_ids:
        res_ar = await db.execute(select(AssessmentResult).where(AssessmentResult.session_id.in_(assess_sess_ids)))
        for ar in res_ar.scalars().all():
            assess_results_map[ar.session_id] = ar

    # 3. Batch fetch scheduled interviews & interview sessions
    sched_map = {}
    res_sched = await db.execute(
        select(ScheduledInterview)
        .where(ScheduledInterview.job_application_id.in_(app_ids))
        .order_by(ScheduledInterview.scheduled_date.desc())
    )
    for sc in res_sched.scalars().all():
        sched_map.setdefault(sc.job_application_id, []).append(sc)

    int_sess_map = {}
    res_isess = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.job_application_id.in_(app_ids),
            InterviewSession.interview_type == "Recruiter"
        )
        .order_by(InterviewSession.started_at.desc())
    )
    all_int_sessions = res_isess.scalars().all()
    for isess in all_int_sessions:
        int_sess_map.setdefault(isess.job_application_id, []).append(isess)

    # 4. Batch fetch scoring reports
    all_sess_ids_for_reports = [s.id for s in all_int_sessions if s.id]
    for sched_list in sched_map.values():
        for sc in sched_list:
            if sc.session_id:
                all_sess_ids_for_reports.append(sc.session_id)
    all_sess_ids_for_reports = list(set(all_sess_ids_for_reports))

    reports_map = {}
    if all_sess_ids_for_reports:
        res_rep = await db.execute(select(ScoringReport).where(ScoringReport.session_id.in_(all_sess_ids_for_reports)))
        for rep in res_rep.scalars().all():
            reports_map[rep.session_id] = rep

    # 5. Batch fetch offer letters
    offers_map = {}
    res_off = await db.execute(
        select(OfferLetter)
        .where(OfferLetter.job_application_id.in_(app_ids))
        .order_by(OfferLetter.created_at.desc())
    )
    for off in res_off.scalars().all():
        offers_map.setdefault(off.job_application_id, []).append(off)

    status_changed = False
    out = []
    now_utc = datetime.utcnow()

    for app in apps:
        job = jobs_map.get(app.job_id)
        assess_sess = assess_sess_map.get(app.id)

        recruiter_assessment = None
        if assess_sess:
            assess_res = assess_results_map.get(assess_sess.id)
            calc_score = round(assess_res.overall_score, 1) if assess_res else None
            passing_cutoff = round(assess_sess.passing_score, 1) if assess_sess.passing_score is not None else 70.0

            recruiter_assessment = {
                "session_id": assess_sess.id,
                "status": "Completed" if assess_res else (assess_sess.status or "Scheduled"),
                "score": calc_score,
                "passing_score": passing_cutoff,
                "attempt_date": assess_res.created_at.strftime('%B %d, %Y') if (assess_res and assess_res.created_at) else (assess_sess.created_at.strftime('%B %d, %Y') if assess_sess.created_at else "Recently"),
                "duration_minutes": assess_sess.duration_minutes or 30
            }

        all_scheds = sched_map.get(app.id, [])
        all_sess = int_sess_map.get(app.id, [])

        def extract_round(r_type: str):
            matched_sess = next((s for s in all_sess if (s.round_type or '').lower() == r_type.lower()), None)
            matched_sched = next((s for s in all_scheds if (s.round_type or '').lower() == r_type.lower()), None)

            if not matched_sess and matched_sched and matched_sched.session_id:
                for s in all_sess:
                    if s.id == matched_sched.session_id:
                        matched_sess = s
                        break

            sess_id = matched_sess.id if matched_sess else (matched_sched.session_id if matched_sched else None)
            if not matched_sess and not matched_sched:
                return None

            scoring_report = reports_map.get(sess_id) if sess_id else None

            is_done = scoring_report is not None or (matched_sess and (matched_sess.status or '').lower() == 'completed')
            st_val = "Completed" if is_done else (matched_sess.status if matched_sess else (matched_sched.status if matched_sched else "Scheduled"))

            sched_dt = matched_sched.scheduled_date if (matched_sched and matched_sched.scheduled_date) else None
            if sched_dt and sched_dt.tzinfo is not None:
                sched_dt = sched_dt.replace(tzinfo=None)
            can_start = True
            seconds_until_start = 0
            if sched_dt and now_utc < sched_dt:
                can_start = False
                seconds_until_start = int((sched_dt - now_utc).total_seconds())

            return {
                "schedule_id": matched_sched.id if matched_sched else None,
                "session_id": sess_id,
                "round_type": r_type.capitalize(),
                "status": st_val,
                "scheduled_date": sched_dt.strftime('%B %d, %Y %I:%M %p') if sched_dt else None,
                "scheduled_date_iso": (sched_dt.isoformat() + "Z") if sched_dt else None,
                "can_start": can_start,
                "seconds_until_start": max(0, seconds_until_start),
                "duration_minutes": matched_sched.duration_minutes if matched_sched else (matched_sess.duration_minutes if matched_sess else 30),
                "technical_score": round(scoring_report.technical_score, 1) if scoring_report else None,
                "communication_score": round(scoring_report.communication_score, 1) if scoring_report else None,
                "confidence_score": round(scoring_report.confidence_score, 1) if scoring_report else None,
                "professionalism_score": round(scoring_report.professionalism_score, 1) if scoring_report else None,
                "overall_score": round(scoring_report.overall_score, 1) if scoring_report else None,
                "recommendation": scoring_report.recommendation if scoring_report else None,
                "is_conducted": is_done
            }

        technical_round = extract_round("technical")
        behavioral_round = extract_round("behavioral")
        hr_round = extract_round("hr")
        active_interview = hr_round or behavioral_round or technical_round

        # Check offer status
        all_offs = offers_map.get(app.id, [])
        off = next((o for o in all_offs if o.status == "Accepted"), all_offs[0] if all_offs else None)
        offer_stat = off.status if off else "N/A"
        offer_details = None
        if off:
            offer_details = {
                "id": off.id,
                "salary_offered": off.salary_offered,
                "start_date": off.start_date.strftime('%B %d, %Y') if off.start_date else "ASAP",
                "offer_letter_text": off.offer_letter_text,
                "status": off.status
            }
            if off.status == "Accepted" and app.status != "Hired":
                app.status = "Hired"
                status_changed = True
            elif off.status in ["Sent", "Pending"] and app.status not in ["Hired", "Offer Sent", "Offer Accepted"]:
                app.status = "Offer Sent"
                status_changed = True

        out.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title if job else "Software Position",
            "company_name": job.company_name if job else "SmartHire Corporate",
            "location": job.location if job else "Remote",
            "work_mode": job.work_mode if job else "Remote",
            "recruiter_contact": job.recruiter_contact or "Hiring Team",
            "recruiter_email": job.recruiter_email or "recruiter@smarthire.ai",
            "ats_score": round(app.ats_score, 1) if app.ats_score is not None else None,
            "ai_recommendation": app.ai_recommendation or "Pending Review",
            "status": app.status,
            "interview_status": active_interview["status"] if active_interview else "Not Scheduled",
            "offer_status": offer_stat,
            "offer_details": offer_details,
            "recruiter_assessment": recruiter_assessment,
            "recruiter_interview": active_interview,
            "technical_round": technical_round,
            "behavioral_round": behavioral_round,
            "hr_round": hr_round,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None
        })

    if status_changed:
        try:
            await db.commit()
        except Exception:
            pass

    fast_cache.set(cache_key, out, ttl=20)
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

@router.delete("/purge-all", summary="Purge All Job Data (Admin/Recruiter)")
async def purge_all_jobs(
    user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Purges all job postings, applications, saved jobs, and associated interview/assessment activity."""
    tables_to_clear = [
        "scoring_reports",
        "interview_answers",
        "speech_analysis",
        "eye_tracking",
        "emotion_analysis",
        "interview_transcripts",
        "interview_vision_analysis",
        "interview_recordings",
        "interview_questions",
        "interview_sessions",
        "candidate_question_history",
        "assessment_question_history",
        "assessment_questions",
        "assessment_sessions",
        "job_applications",
        "saved_jobs",
        "scheduled_interviews",
        "notifications",
        "offer_letters",
        "job_postings"
    ]
    for table in tables_to_clear:
        try:
            await db.execute(text(f"DELETE FROM {table}"))
        except Exception as e:
            logger.warning(f"Error purging table {table}: {e}")

    await db.commit()
    return {"status": "success", "message": "All job postings and job application data purged successfully."}


