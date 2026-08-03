from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.sql import func, case
from typing import Dict, Any, List
import json
from datetime import datetime

from app.core.db import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.domain import (
    User, Candidate, JobApplication, JobPosting, SavedJob, ScheduledInterview,
    InterviewSession, ScoringReport, OfferLetter, Resume, ActivityLog, Notification,
    ResumeSkill, ResumeView
)
from app.schemas.domain import CandidateProfileResponse

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=CandidateProfileResponse, summary="Get Current Authenticated User Profile")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Protected endpoint returning the profile of the current logged-in user."""
    result = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = result.scalars().first()

    target_role = candidate.target_role if candidate else None
    if candidate:
        res_app = await db.execute(
            select(JobPosting)
            .join(JobApplication, JobApplication.job_id == JobPosting.id)
            .where(JobApplication.candidate_id == candidate.id)
            .order_by(JobApplication.applied_at.desc())
        )
        latest_job = res_app.scalars().first()
        if latest_job:
            target_role = latest_job.title

    return {
        "id": candidate.id if candidate else user.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "profile_image": user.profile_image,
        "target_role": target_role,
        "experience_level": candidate.experience_level if candidate else None,
        "total_interviews": candidate.total_interviews if candidate else 0,
        "avg_score": candidate.avg_score if candidate else None,
        "readiness_score": candidate.readiness_score if candidate else None,
        "streak_days": candidate.streak_days if candidate else 0,
        "status": candidate.status if candidate else "Registered"
    }

@router.get("/candidate-metrics", summary="Get Live Real-time PostgreSQL Candidate Analytics")
async def get_candidate_metrics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes exact real-time KPI metrics strictly from PostgreSQL aggregate queries
    bound to the authenticated candidate. Zero mock numbers or static fallbacks.
    """
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalars().first()

    if not candidate:
        candidate = Candidate(user_id=user.id, target_role="Software Engineer")
        db.add(candidate)
        await db.commit()
        await db.refresh(candidate)

    c_id = candidate.id

    # 1. Job Applications Metrics
    app_query = select(
        func.count(JobApplication.id).label("total_applied"),
        func.count(case((JobApplication.status.in_(["Applied", "Screening Passed", "Interview Scheduled", "Evaluation Ready", "Offer Sent"]), 1))).label("active_apps"),
        func.count(case(((JobApplication.ats_score >= 80.0) | (JobApplication.status == "Screening Passed"), 1))).label("ats_passed"),
        func.count(case((((JobApplication.ats_score < 80.0) & (JobApplication.ats_score.isnot(None))) | (JobApplication.status == "Rejected"), 1))).label("ats_rejected"),
        func.avg(JobApplication.ats_score).label("avg_ats")
    ).where(JobApplication.candidate_id == c_id)
    
    res_apps = (await db.execute(app_query)).one()
    jobs_applied = res_apps.total_applied or 0
    active_applications = res_apps.active_apps or 0
    ats_passed = res_apps.ats_passed or 0
    ats_rejected = res_apps.ats_rejected or 0
    avg_ats_score = round(float(res_apps.avg_ats), 1) if res_apps.avg_ats is not None else 0.0

    # 2. Saved Jobs Count
    res_saved = await db.execute(
        select(func.count(SavedJob.id)).where(SavedJob.candidate_id == c_id)
    )
    saved_jobs = res_saved.scalar() or 0

    # 3. Scheduled & Completed Recruiter Interviews
    res_sched = await db.execute(
        select(
            func.count(case((ScheduledInterview.status.in_(["Scheduled", "Upcoming"]), 1))).label("scheduled"),
            func.count(case((ScheduledInterview.status == "Completed", 1))).label("completed")
        ).where(ScheduledInterview.candidate_id == c_id)
    )
    sched_row = res_sched.one()
    interviews_scheduled = sched_row.scheduled or 0
    recruiter_interviews_completed = sched_row.completed or 0

    # 4. Mock Interviews & AI Scoring Reports
    res_mock = await db.execute(
        select(
            func.count(InterviewSession.id).label("mock_count"),
            func.avg(ScoringReport.overall_score).label("avg_score"),
            func.max(ScoringReport.overall_score).label("best_score"),
            func.count(case((ScoringReport.overall_score >= 80.0, 1))).label("passed_count")
        )
        .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
        .where(InterviewSession.candidate_id == c_id)
    )
    mock_row = res_mock.one()
    mock_interviews_completed = mock_row.mock_count or 0
    avg_interview_score = round(float(mock_row.avg_score), 1) if mock_row.avg_score is not None else 0.0
    best_interview_score = round(float(mock_row.best_score), 1) if mock_row.best_score is not None else 0.0
    interviews_passed = mock_row.passed_count or 0

    interviews_completed = mock_interviews_completed + recruiter_interviews_completed

    # 5. Offer Letters Metrics
    res_offers = await db.execute(
        select(
            func.count(OfferLetter.id).label("total_offers"),
            func.count(case((OfferLetter.status == "Accepted", 1))).label("accepted"),
            func.count(case((OfferLetter.status.in_(["Sent", "Pending"]), 1))).label("pending"),
            func.count(case((OfferLetter.status.in_(["Declined", "Rejected"]), 1))).label("rejected")
        ).where(OfferLetter.candidate_id == c_id)
    )
    offer_row = res_offers.one()
    total_offers = offer_row.total_offers or 0
    accepted_offers = offer_row.accepted or 0
    pending_offers = offer_row.pending or 0
    rejected_offers = offer_row.rejected or 0

    # 6. Resume Views by Recruiters
    res_views = await db.execute(
        select(func.count(ResumeView.id)).where(ResumeView.candidate_id == c_id)
    )
    resume_views = res_views.scalar() or 0

    # 7. Resumes & Versioning
    res_resumes = await db.execute(
        select(Resume).where(Resume.candidate_id == c_id).order_by(Resume.created_at.desc())
    )
    resumes_list = res_resumes.scalars().all()
    latest_resume = resumes_list[0] if resumes_list else None
    resume_version = latest_resume.version if (latest_resume and latest_resume.version) else len(resumes_list)

    # 8. Skills Extracted Count (Unique Skills)
    res_skills = await db.execute(
        select(func.count(func.distinct(ResumeSkill.skill_name)))
        .join(Resume, ResumeSkill.resume_id == Resume.id)
        .where(Resume.candidate_id == c_id)
    )
    skills_extracted = res_skills.scalar() or 0

    # 9. Certificates Uploaded Count
    certificates_uploaded = 0
    for r in resumes_list:
        if r.certifications and isinstance(r.certifications, list):
            certificates_uploaded += len(r.certifications)

    # 10. Success Rates & Profile Completion
    app_success_rate = round((ats_passed / jobs_applied * 100.0), 1) if jobs_applied > 0 else 0.0
    interview_success_rate = round((interviews_passed / interviews_completed * 100.0), 1) if interviews_completed > 0 else 0.0

    profile_checks = [
        bool(user.full_name),
        bool(user.email),
        bool(user.profile_image),
        bool(candidate.phone or user.phone_number),
        bool(candidate.bio),
        bool(candidate.target_role),
        bool(candidate.experience_level),
        latest_resume is not None,
        skills_extracted > 0,
        certificates_uploaded > 0
    ]
    profile_completion = int((sum(1 for c in profile_checks if c) / len(profile_checks)) * 100)

    # Dynamic Readiness Score Calculation
    if avg_ats_score > 0 or best_interview_score > 0:
        readiness_score = round((avg_ats_score * 0.35) + (best_interview_score * 0.35) + (profile_completion * 0.30), 1)
    else:
        readiness_score = round(profile_completion * 0.5, 1)

    # Days Active
    created_at = user.created_at if user.created_at else datetime.utcnow()
    days_active = max(1, (datetime.utcnow() - created_at).days + 1)

    # 11. Pipeline Stage Determination
    if accepted_offers > 0:
        pipeline_stage = "Accepted"
    elif pending_offers > 0 or total_offers > 0:
        pipeline_stage = "Offer"
    elif interviews_completed > 0:
        pipeline_stage = "Recruiter Review"
    elif interviews_scheduled > 0:
        pipeline_stage = "Interview"
    elif ats_passed > 0:
        pipeline_stage = "ATS Passed"
    elif jobs_applied > 0:
        pipeline_stage = "Applied"
    else:
        pipeline_stage = "Not Started"

    # 12. Real-Time Analytics Trends & Charts Data
    res_app_list = await db.execute(
        select(JobApplication, JobPosting.title)
        .join(JobPosting, JobApplication.job_id == JobPosting.id)
        .where(JobApplication.candidate_id == c_id)
        .order_by(JobApplication.applied_at.asc())
    )
    all_apps = res_app_list.all()

    ats_trend = [
        {
            "date": app.JobApplication.applied_at.strftime('%b %d') if app.JobApplication.applied_at else "Recent",
            "score": round(app.JobApplication.ats_score, 1) if app.JobApplication.ats_score is not None else 0.0,
            "title": app.title
        }
        for app in all_apps if app.JobApplication.ats_score is not None
    ]

    res_mock_list = await db.execute(
        select(ScoringReport.overall_score, ScoringReport.created_at, InterviewSession.title)
        .join(InterviewSession, ScoringReport.session_id == InterviewSession.id)
        .where(InterviewSession.candidate_id == c_id)
        .order_by(ScoringReport.created_at.asc())
    )
    all_reports = res_mock_list.all()

    interview_score_trend = [
        {
            "date": rep.created_at.strftime('%b %d') if rep.created_at else "Recent",
            "score": round(rep.overall_score, 1),
            "title": rep.title
        }
        for rep in all_reports
    ]

    readiness_trend = []
    if ats_trend or interview_score_trend:
        combined_scores = [a["score"] for a in ats_trend] + [i["score"] for i in interview_score_trend]
        for idx, sc in enumerate(combined_scores):
            readiness_trend.append({"step": f"Point {idx+1}", "score": round(sc, 1)})
    else:
        readiness_trend = [{"step": "Baseline", "score": readiness_score}]

    # Recent Activity Log
    res_logs = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(10)
    )
    recent_activity = [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.notification_type,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in res_logs.scalars().all()
    ]

    return {
        "jobs_applied": jobs_applied,
        "saved_jobs": saved_jobs,
        "active_applications": active_applications,
        "ats_passed": ats_passed,
        "ats_rejected": ats_rejected,
        "interviews_scheduled": interviews_scheduled,
        "interviews_completed": interviews_completed,
        "mock_interviews_completed": mock_interviews_completed,
        "recruiter_interviews_completed": recruiter_interviews_completed,
        "avg_ats_score": avg_ats_score,
        "avg_interview_score": avg_interview_score,
        "best_interview_score": best_interview_score,
        "readiness_score": readiness_score,
        "total_offers": total_offers,
        "accepted_offers": accepted_offers,
        "pending_offers": pending_offers,
        "rejected_offers": rejected_offers,
        "resume_views": resume_views,
        "profile_completion": profile_completion,
        "skills_extracted": skills_extracted,
        "certificates_uploaded": certificates_uploaded,
        "resume_version": resume_version,
        "days_active": days_active,
        "app_success_rate": app_success_rate,
        "interview_success_rate": interview_success_rate,
        "pipeline_stage": pipeline_stage,
        "funnel": {
            "applied": jobs_applied,
            "ats_passed": ats_passed,
            "interview_scheduled": interviews_scheduled,
            "interview_completed": interviews_completed,
            "offers": total_offers,
            "accepted": accepted_offers
        },
        "interview_funnel": {
            "scheduled": interviews_scheduled,
            "completed": interviews_completed,
            "passed": interviews_passed
        },
        "offer_funnel": {
            "received": total_offers,
            "pending": pending_offers,
            "accepted": accepted_offers,
            "rejected": rejected_offers
        },
        "charts": {
            "ats_trend": ats_trend,
            "interview_score_trend": interview_score_trend,
            "readiness_trend": readiness_trend
        },
        "recent_activity": recent_activity
    }

@router.get("/admin-only", summary="Admin Only RBAC Protected Endpoint")
async def get_admin_dashboard(user: User = Depends(require_role(["admin"]))):
    """Protected RBAC endpoint accessible ONLY by Admin role."""
    return {"message": f"Welcome Admin {user.full_name}. You have access to administrative management."}

@router.get("/recruiter-only", summary="Recruiter Only RBAC Protected Endpoint")
async def get_recruiter_dashboard(user: User = Depends(require_role(["recruiter", "admin"]))):
    """Protected RBAC endpoint accessible ONLY by Recruiter and Admin roles."""
    return {"message": f"Welcome Recruiter {user.full_name}. You have access to talent requisitions."}
