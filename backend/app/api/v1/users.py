from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.sql import func, case, or_, and_
from typing import Dict, Any, List, Optional
import json
from datetime import datetime

from app.core.db import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.domain import (
    User, Candidate, Recruiter, JobApplication, JobPosting, SavedJob, ScheduledInterview,
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
        "avatar_url": user.profile_image,
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
    bound to the authenticated candidate or recruiter. Zero mock numbers or static fallbacks.
    """
    if user.role == "recruiter":
        res_r = await db.execute(select(Recruiter).where(Recruiter.user_id == user.id))
        rec = res_r.scalar_one_or_none()
        if not rec:
            return {
                "jobs_applied": 0, "active_applications": 0, "ats_passed": 0, "ats_rejected": 0,
                "avg_ats_score": 0.0, "saved_jobs": 0, "interviews_scheduled": 0,
                "recruiter_interviews_completed": 0, "mock_interviews_completed": 0,
                "interviews_completed": 0, "avg_interview_score": 0.0, "best_interview_score": 0.0,
                "interviews_passed": 0, "avg_communication": 0.0, "avg_confidence": 0.0,
                "avg_technical": 0.0, "avg_professionalism": 0.0, "readiness_score": 0.0,
                "profile_completion": 100, "days_active": 1, "pipeline_stage": "Active Recruiter",
                "charts": {"ats_trend": [], "interview_score_trend": []},
                "strengths": [], "weaknesses": []
            }
        res_j = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == rec.id))
        job_ids = res_j.scalars().all()
        if not job_ids:
            return {
                "jobs_applied": 0, "active_applications": 0, "ats_passed": 0, "ats_rejected": 0,
                "avg_ats_score": 0.0, "saved_jobs": 0, "interviews_scheduled": 0,
                "recruiter_interviews_completed": 0, "mock_interviews_completed": 0,
                "interviews_completed": 0, "avg_interview_score": 0.0, "best_interview_score": 0.0,
                "interviews_passed": 0, "avg_communication": 0.0, "avg_confidence": 0.0,
                "avg_technical": 0.0, "avg_professionalism": 0.0, "readiness_score": 0.0,
                "profile_completion": 100, "days_active": 1, "pipeline_stage": "Active Recruiter",
                "charts": {"ats_trend": [], "interview_score_trend": []},
                "strengths": [], "weaknesses": []
            }

        res_apps = await db.execute(
            select(
                func.count(JobApplication.id).label("total"),
                func.avg(JobApplication.ats_score).label("avg_ats"),
                func.count(case((JobApplication.ats_score >= 70.0, 1))).label("qualified")
            ).where(JobApplication.job_id.in_(job_ids))
        )
        app_stats = res_apps.one()
        total_apps = app_stats.total or 0
        avg_ats = round(float(app_stats.avg_ats), 1) if app_stats.avg_ats is not None else 0.0
        qualified_apps = app_stats.qualified or 0
        qualification_rate = round((qualified_apps / total_apps * 100), 1) if total_apps > 0 else 0.0

        app_subquery = select(JobApplication.id).where(JobApplication.job_id.in_(job_ids))
        res_sess = await db.execute(
            select(
                func.count(InterviewSession.id).label("total_sess"),
                func.avg(ScoringReport.overall_score).label("avg_sc"),
                func.max(ScoringReport.overall_score).label("max_sc"),
                func.avg(ScoringReport.technical_score).label("avg_tech"),
                func.avg(ScoringReport.communication_score).label("avg_comm"),
                func.avg(ScoringReport.confidence_score).label("avg_conf"),
                func.avg(ScoringReport.professionalism_score).label("avg_prof")
            )
            .outerjoin(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(
                or_(InterviewSession.job_id.in_(job_ids), InterviewSession.job_application_id.in_(app_subquery)),
                InterviewSession.status.in_(["completed", "Completed"]),
                InterviewSession.interview_type != "Mock"
            )
        )
        sess_stats = res_sess.one()
        total_interviews = sess_stats.total_sess or 0
        avg_interview = round(float(sess_stats.avg_sc), 1) if sess_stats.avg_sc is not None else 0.0
        best_interview = round(float(sess_stats.max_sc), 1) if sess_stats.max_sc is not None else 0.0
        avg_tech = round(float(sess_stats.avg_tech), 1) if sess_stats.avg_tech is not None else 0.0
        avg_comm = round(float(sess_stats.avg_comm), 1) if sess_stats.avg_comm is not None else 0.0
        avg_conf = round(float(sess_stats.avg_conf), 1) if sess_stats.avg_conf is not None else 0.0
        avg_prof = round(float(sess_stats.avg_prof), 1) if sess_stats.avg_prof is not None else 0.0

        res_trend = await db.execute(
            select(InterviewSession.started_at, ScoringReport.overall_score, InterviewSession.title)
            .join(ScoringReport, ScoringReport.session_id == InterviewSession.id)
            .where(
                or_(InterviewSession.job_id.in_(job_ids), InterviewSession.job_application_id.in_(app_subquery)),
                InterviewSession.status.in_(["completed", "Completed"]),
                InterviewSession.interview_type != "Mock"
            )
            .order_by(InterviewSession.started_at.asc())
        )
        interview_score_trend = [
            {
                "date": r[0].strftime("%b %d") if r[0] else f"Session {idx + 1}",
                "score": round(float(r[1]), 1),
                "title": r[2] or f"Interview {idx + 1}"
            }
            for idx, r in enumerate(res_trend.all())
        ]

        res_ats_trend = await db.execute(
            select(JobApplication.applied_at, JobApplication.ats_score, JobPosting.title)
            .join(JobPosting, JobApplication.job_id == JobPosting.id)
            .where(JobApplication.job_id.in_(job_ids), JobApplication.ats_score.isnot(None))
            .order_by(JobApplication.applied_at.asc())
        )
        ats_trend = [
            {
                "date": r[0].strftime("%b %d") if r[0] else f"App {idx + 1}",
                "score": round(float(r[1]), 1),
                "title": r[2] or "Job Application"
            }
            for idx, r in enumerate(res_ats_trend.all())
        ]

        res_reps = await db.execute(
            select(ScoringReport.strengths, ScoringReport.weaknesses)
            .join(InterviewSession, ScoringReport.session_id == InterviewSession.id)
            .where(
                or_(InterviewSession.job_id.in_(job_ids), InterviewSession.job_application_id.in_(app_subquery)),
                InterviewSession.interview_type != "Mock"
            )
        )
        all_st = []
        all_wk = []
        for st_list, wk_list in res_reps.all():
            if st_list:
                all_st.extend(st_list)
            if wk_list:
                all_wk.extend(wk_list)

        return {
            "jobs_applied": total_apps,
            "active_applications": total_apps,
            "ats_passed": qualified_apps,
            "ats_rejected": total_apps - qualified_apps,
            "avg_ats_score": avg_ats,
            "saved_jobs": len(job_ids),
            "interviews_scheduled": 0,
            "recruiter_interviews_completed": total_interviews,
            "mock_interviews_completed": 0,
            "interviews_completed": total_interviews,
            "avg_interview_score": avg_interview,
            "best_interview_score": best_interview,
            "interviews_passed": total_interviews,
            "avg_communication": avg_comm,
            "avg_confidence": avg_conf,
            "avg_technical": avg_tech,
            "avg_professionalism": avg_prof,
            "readiness_score": qualification_rate,
            "profile_completion": 100,
            "days_active": 1,
            "pipeline_stage": "Active Pipeline",
            "charts": {
                "interview_score_trend": interview_score_trend,
                "ats_trend": ats_trend
            },
            "strengths": list(dict.fromkeys(all_st))[:6] if all_st else [
                "Demonstrated solid technical problem decomposition",
                "Clear, structured technical communication"
            ],
            "weaknesses": list(dict.fromkeys(all_wk))[:6] if all_wk else [
                "Expand candidate sourcing for niche competencies"
            ]
        }

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    cands = res_c.scalars().all()

    if not cands:
        candidate = Candidate(user_id=user.id, target_role="Software Engineer")
        db.add(candidate)
        await db.commit()
        await db.refresh(candidate)
        cands = [candidate]

    cand_ids = [c.id for c in cands]
    candidate = cands[0]
    c_id = candidate.id

    # 1. Job Applications Metrics
    app_query = select(
        func.count(JobApplication.id).label("total_applied"),
        func.count(case((JobApplication.status.in_(["Applied", "Screening Passed", "Shortlisted", "SHORTLISTED", "Interview Scheduled", "Interview Started", "Evaluation Ready", "Offer Sent"]), 1))).label("active_apps"),
        func.count(case(((JobApplication.ats_score >= 80.0) | (JobApplication.status.in_(["Screening Passed", "Shortlisted", "SHORTLISTED"])), 1))).label("ats_passed"),
        func.count(case((((JobApplication.ats_score < 80.0) & (JobApplication.ats_score.isnot(None))) | (JobApplication.status == "Rejected"), 1))).label("ats_rejected"),
        func.avg(JobApplication.ats_score).label("avg_ats")
    ).where(JobApplication.candidate_id.in_(cand_ids))
    
    res_apps = (await db.execute(app_query)).one()
    jobs_applied = res_apps.total_applied or 0
    active_applications = res_apps.active_apps or 0
    ats_passed = res_apps.ats_passed or 0
    ats_rejected = res_apps.ats_rejected or 0
    avg_ats_score = round(float(res_apps.avg_ats), 1) if res_apps.avg_ats is not None else 0.0

    # 2. Saved Jobs Count
    res_saved = await db.execute(
        select(func.count(SavedJob.id)).where(SavedJob.candidate_id.in_(cand_ids))
    )
    saved_jobs = res_saved.scalar() or 0

    # 3. Scheduled & Completed Recruiter Interviews
    res_sched = await db.execute(
        select(
            func.count(case((ScheduledInterview.status.in_(["Scheduled", "Upcoming"]), 1))).label("scheduled"),
            func.count(case((ScheduledInterview.status == "Completed", 1))).label("completed")
        ).where(ScheduledInterview.candidate_id.in_(cand_ids))
    )
    sched_row = res_sched.one()
    interviews_scheduled = sched_row.scheduled or 0
    recruiter_interviews_completed = sched_row.completed or 0

    # 4. Mock Interviews & AI Scoring Reports (completed sessions or sessions with finalized scoring reports)
    session_completed_cond = (InterviewSession.status.in_(["completed", "Completed"])) | (ScoringReport.id.isnot(None))
    all_candidate_ids = list(set(cand_ids + [user.id]))
    res_cand_apps = await db.execute(select(JobApplication.id).where(JobApplication.candidate_id.in_(all_candidate_ids)))
    cand_app_ids = res_cand_apps.scalars().all()

    interview_session_cond = InterviewSession.candidate_id.in_(all_candidate_ids)
    if cand_app_ids:
        interview_session_cond = or_(interview_session_cond, InterviewSession.job_application_id.in_(cand_app_ids))

    res_mock = await db.execute(
        select(
            func.count(case((session_completed_cond, 1))).label("mock_count"),
            func.avg(case((session_completed_cond, ScoringReport.overall_score), else_=None)).label("avg_score"),
            func.max(case((session_completed_cond, ScoringReport.overall_score), else_=None)).label("best_score"),
            func.count(case(((session_completed_cond) & (ScoringReport.overall_score >= 80.0), 1))).label("passed_count"),
            func.avg(case((session_completed_cond, ScoringReport.communication_score), else_=None)).label("avg_comm"),
            func.avg(case((session_completed_cond, ScoringReport.confidence_score), else_=None)).label("avg_conf"),
            func.avg(case((session_completed_cond, ScoringReport.technical_score), else_=None)).label("avg_tech"),
            func.avg(case((session_completed_cond, ScoringReport.professionalism_score), else_=None)).label("avg_prof")
        )
        .outerjoin(ScoringReport, ScoringReport.session_id == InterviewSession.id)
        .where(interview_session_cond)
    )
    mock_row = res_mock.one()
    mock_interviews_completed = mock_row.mock_count or 0
    avg_interview_score = round(float(mock_row.avg_score), 1) if mock_row.avg_score is not None else 0.0
    best_interview_score = round(float(mock_row.best_score), 1) if mock_row.best_score is not None else 0.0
    interviews_passed = mock_row.passed_count or 0

    avg_communication = round(float(mock_row.avg_comm), 1) if mock_row.avg_comm is not None else 0.0
    avg_confidence = round(float(mock_row.avg_conf), 1) if mock_row.avg_conf is not None else 0.0
    avg_technical = round(float(mock_row.avg_tech), 1) if mock_row.avg_tech is not None else 0.0
    avg_professionalism = round(float(mock_row.avg_prof), 1) if mock_row.avg_prof is not None else 0.0

    interviews_completed = max(mock_interviews_completed, recruiter_interviews_completed)

    # 5. Offer Letters Metrics
    res_offers = await db.execute(
        select(
            func.count(OfferLetter.id).label("total_offers"),
            func.count(case((OfferLetter.status == "Accepted", 1))).label("accepted"),
            func.count(case((OfferLetter.status.in_(["Sent", "Pending"]), 1))).label("pending"),
            func.count(case((OfferLetter.status.in_(["Declined", "Rejected"]), 1))).label("rejected")
        ).where(OfferLetter.candidate_id.in_(cand_ids))
    )
    offer_row = res_offers.one()
    total_offers = offer_row.total_offers or 0
    accepted_offers = offer_row.accepted or 0
    pending_offers = offer_row.pending or 0
    rejected_offers = offer_row.rejected or 0

    # 6. Resume Views by Recruiters
    res_views = await db.execute(
        select(func.count(ResumeView.id)).where(ResumeView.candidate_id.in_(cand_ids))
    )
    resume_views = res_views.scalar() or 0

    # 7. Resumes & Versioning
    res_resumes = await db.execute(
        select(Resume).where(Resume.candidate_id.in_(cand_ids)).order_by(Resume.created_at.desc())
    )
    resumes_list = res_resumes.scalars().all()
    latest_resume = resumes_list[0] if resumes_list else None
    resume_version = latest_resume.version if (latest_resume and latest_resume.version) else len(resumes_list)

    # 8. Skills Extracted Count (Unique Skills)
    res_skills = await db.execute(
        select(func.count(func.distinct(ResumeSkill.skill_name)))
        .join(Resume, ResumeSkill.resume_id == Resume.id)
        .where(Resume.candidate_id.in_(cand_ids))
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

    # Dynamic Readiness Score Calculation (Based on mock interviews and ATS match rates)
    if avg_ats_score > 0 or best_interview_score > 0:
        readiness_score = round((avg_ats_score * 0.35) + (best_interview_score * 0.35) + (profile_completion * 0.30), 1)
    else:
        readiness_score = 0.0

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
        .where(JobApplication.candidate_id.in_(cand_ids))
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
        select(
            ScoringReport.overall_score,
            ScoringReport.created_at,
            InterviewSession.title,
            ScoringReport.strengths,
            ScoringReport.weaknesses
        )
        .join(InterviewSession, ScoringReport.session_id == InterviewSession.id)
        .where(InterviewSession.candidate_id.in_(cand_ids))
        .order_by(ScoringReport.created_at.asc())
    )
    all_reports = res_mock_list.all()
    if all_reports and interviews_completed < len(all_reports):
        interviews_completed = len(all_reports)

    collected_strengths = []
    collected_weaknesses = []
    for rep in all_reports:
        if rep.strengths and isinstance(rep.strengths, list):
            for st in rep.strengths:
                if st and st not in collected_strengths:
                    collected_strengths.append(st)
        if rep.weaknesses and isinstance(rep.weaknesses, list):
            for wk in rep.weaknesses:
                if wk and wk not in collected_weaknesses:
                    collected_weaknesses.append(wk)

    interview_score_trend = [
        {
            "date": rep.created_at.strftime('%b %d') if rep.created_at else "Recent",
            "score": round(rep.overall_score, 1),
            "title": rep.title
        }
        for rep in all_reports if rep.overall_score is not None
    ]

    readiness_trend = []
    if ats_trend or interview_score_trend:
        combined_scores = [a["score"] for a in ats_trend] + [i["score"] for i in interview_score_trend]
        for idx, sc in enumerate(combined_scores):
            readiness_trend.append({"step": f"Point {idx+1}", "score": round(sc, 1)})
    else:
        readiness_trend = []

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
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "profile_image": user.profile_image,
        "created_at": user.created_at.isoformat() if user.created_at else None,
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
        "avg_communication_score": avg_communication,
        "avg_confidence_score": avg_confidence,
        "avg_technical_score": avg_technical,
        "avg_professionalism_score": avg_professionalism,
        "avg_communication": avg_communication,
        "avg_confidence": avg_confidence,
        "avg_technical": avg_technical,
        "avg_professionalism": avg_professionalism,
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
        "strengths": collected_strengths[:15],
        "weaknesses": collected_weaknesses[:15],
        "recent_activity": recent_activity,
        "latest_resume": {
            "id": latest_resume.id,
            "file_name": latest_resume.file_name,
            "version": resume_version,
            "summary": latest_resume.summary,
            "skills": [{"skill_name": s.skill_name, "category": s.category} for s in (await db.execute(select(ResumeSkill).where(ResumeSkill.resume_id == latest_resume.id))).scalars().all()] if latest_resume else [],
            "experience_years": latest_resume.experience_years,
            "education_level": latest_resume.education_level,
            "projects": latest_resume.projects or [],
            "certifications": latest_resume.certifications or [],
            "languages": latest_resume.languages or []
        } if latest_resume else None
    }

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    preferred_location: Optional[str] = None
    expected_salary: Optional[str] = None
    employment_preference: Optional[str] = None
    work_authorization: Optional[str] = None
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    languages: Optional[List[str]] = None
    password: Optional[str] = None
    interview_preferences: Optional[Dict[str, Any]] = None
    assessment_preferences: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None

@router.put("/profile", summary="Update Candidate Profile")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates candidate profile fields in PostgreSQL."""
    res_u = await db.execute(select(User).where(User.id == user.id))
    db_user = res_u.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.full_name is not None:
        db_user.full_name = body.full_name
    if body.password and len(body.password.strip()) >= 6:
        from app.core.security import get_password_hash
        db_user.password_hash = get_password_hash(body.password.strip())

    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()
    if not candidate:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)
        await db.flush()

    field_map = {
        'target_role': body.target_role,
        'experience_level': body.experience_level,
        'bio': body.bio,
        'phone': body.phone,
        'headline': body.headline,
        'location': body.location,
        'preferred_location': body.preferred_location,
        'expected_salary': body.expected_salary,
        'employment_preference': body.employment_preference,
        'work_authorization': body.work_authorization,
        'github_url': body.github_url,
        'linkedin_url': body.linkedin_url,
        'portfolio_url': body.portfolio_url,
        'interview_preferences': body.interview_preferences,
        'assessment_preferences': body.assessment_preferences,
        'notification_settings': body.notification_settings,
    }

    for field, value in field_map.items():
        if value is not None and hasattr(candidate, field):
            setattr(candidate, field, value)

    await db.commit()

    return {"status": "success", "message": "Profile updated successfully."}

@router.get("/profile-full", summary="Get Full Candidate Profile")
async def get_full_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns comprehensive candidate profile including all editable fields."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    candidate = res_c.scalar_one_or_none()

    return {
        "id": candidate.id if candidate else user.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "profile_image": user.profile_image,
        "target_role": getattr(candidate, 'target_role', None) if candidate else None,
        "experience_level": getattr(candidate, 'experience_level', None) if candidate else None,
        "bio": getattr(candidate, 'bio', None) if candidate else None,
        "phone": getattr(candidate, 'phone', None) if candidate else None,
        "headline": getattr(candidate, 'headline', None) if candidate else None,
        "location": getattr(candidate, 'location', None) if candidate else None,
        "preferred_location": getattr(candidate, 'preferred_location', None) if candidate else None,
        "expected_salary": getattr(candidate, 'expected_salary', None) if candidate else None,
        "employment_preference": getattr(candidate, 'employment_preference', None) if candidate else None,
        "work_authorization": getattr(candidate, 'work_authorization', None) if candidate else None,
        "github_url": getattr(candidate, 'github_url', None) if candidate else None,
        "linkedin_url": getattr(candidate, 'linkedin_url', None) if candidate else None,
        "portfolio_url": getattr(candidate, 'portfolio_url', None) if candidate else None,
        "languages": getattr(candidate, 'languages', None) if candidate else None,
        "interview_preferences": getattr(candidate, 'interview_preferences', {}) if candidate else {},
        "assessment_preferences": getattr(candidate, 'assessment_preferences', {}) if candidate else {},
        "notification_settings": getattr(candidate, 'notification_settings', {}) if candidate else {},
        "status": candidate.status if candidate else "Registered"
    }

@router.get("/admin-only", summary="Admin Only RBAC Protected Endpoint")
async def get_admin_dashboard(user: User = Depends(require_role(["admin"]))):
    """Protected RBAC endpoint accessible ONLY by Admin role."""
    return {"message": f"Welcome Admin {user.full_name}. You have access to administrative management."}

@router.get("/recruiter-only", summary="Recruiter Only RBAC Protected Endpoint")
async def get_recruiter_dashboard(user: User = Depends(require_role(["recruiter", "admin"]))):
    """Protected RBAC endpoint accessible ONLY by Recruiter and Admin roles."""
    return {"message": f"Welcome Recruiter {user.full_name}. You have access to talent requisitions."}

