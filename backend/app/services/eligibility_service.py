import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    JobApplication, JobPosting, Candidate, Recruiter, User, ScheduledInterview
)

logger = logging.getLogger(__name__)

class ApplicationEligibilityService:
    """Single Source of Truth for Application Eligibility & Status Rules.

    Used across Recruiter Dashboard, Shortlisted Candidates, Interview Scheduler,
    Applications, Analytics, and Reports.
    """

    ELIGIBLE_STATUSES = [
        "Shortlisted", "SHORTLISTED", "Screening Passed",
        "Move to Next Round", "Interview Scheduled", "Evaluation Ready"
    ]

    REJECTED_STATUSES = ["Rejected", "REJECTED", "ATS Rejected", "Interview Rejected"]

    MINIMUM_ATS_SCORE = 80.0

    @staticmethod
    def is_eligible(ats_score: Optional[float], status: Optional[str]) -> bool:
        """Determines if an application meets minimum ATS threshold (>= 80%) and is in a shortlisted stage."""
        if ats_score is None or ats_score < ApplicationEligibilityService.MINIMUM_ATS_SCORE:
            return False
        if not status or status in ApplicationEligibilityService.REJECTED_STATUSES or status == "Applied":
            return False
        return any(status.lower() == s.lower() for s in ApplicationEligibilityService.ELIGIBLE_STATUSES)

    @staticmethod
    async def get_eligible_candidates_for_job(
        db: AsyncSession,
        job_id: str,
        recruiter_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Queries candidates eligible for interview scheduling for a SPECIFIC job posting.

        SQL Logic:
        SELECT candidate.*, application.*
        FROM job_applications application
        JOIN candidates candidate ON candidate.id = application.candidate_id
        JOIN users user ON user.id = candidate.user_id
        JOIN job_postings job ON job.id = application.job_id
        WHERE application.job_id = :job_id
          AND application.ats_score >= 80.0
          AND application.status IN ('Shortlisted', 'SHORTLISTED', 'Screening Passed', 'Move to Next Round', 'Interview Scheduled', 'Evaluation Ready')
          AND NOT EXISTS (
              SELECT 1 FROM scheduled_interviews interview
              WHERE interview.candidate_id = application.candidate_id
                AND interview.job_id = application.job_id
                AND interview.status IN ('Scheduled', 'Upcoming', 'In Progress')
          )
        """
        logger.info("[ApplicationEligibilityService] Querying eligible candidates for Job ID: %s", job_id)

        # 1. Fetch Job Posting Requisition
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
        job = res_j.scalar_one_or_none()
        if not job:
            logger.warning("[ApplicationEligibilityService] Job ID %s not found.", job_id)
            return []

        # Optional Recruiter ownership check
        if recruiter_id and job.recruiter_id and job.recruiter_id != recruiter_id:
            logger.warning("[ApplicationEligibilityService] Job %s does not belong to recruiter %s.", job_id, recruiter_id)
            return []

        # 2. Fetch Shortlisted Applications for Job ID
        res_apps = await db.execute(
            select(JobApplication)
            .where(
                JobApplication.job_id == job_id,
                JobApplication.ats_score >= ApplicationEligibilityService.MINIMUM_ATS_SCORE,
                JobApplication.status.in_(ApplicationEligibilityService.ELIGIBLE_STATUSES)
            )
            .order_by(JobApplication.applied_at.desc())
        )
        apps = res_apps.scalars().all()
        logger.info("[ApplicationEligibilityService] Found %d shortlisted application(s) for Job ID %s", len(apps), job_id)

        eligible_list = []
        for app in apps:
            # 3. Exclude if candidate already has an active scheduled interview for this job
            res_pending = await db.execute(
                select(ScheduledInterview)
                .where(
                    ScheduledInterview.candidate_id == app.candidate_id,
                    ScheduledInterview.job_id == app.job_id,
                    ScheduledInterview.status.in_(["Scheduled", "Upcoming", "In Progress"])
                )
            )
            if res_pending.scalar_one_or_none():
                logger.info("[ApplicationEligibilityService] Candidate %s already has scheduled interview for Job %s. Skipping.", app.candidate_id, job_id)
                continue

            # Fetch candidate and user details
            res_c = await db.execute(select(Candidate).where(Candidate.id == app.candidate_id))
            cand = res_c.scalar_one_or_none()
            if not cand:
                continue

            res_u = await db.execute(select(User).where(User.id == cand.user_id))
            cand_user = res_u.scalar_one_or_none()
            if not cand_user or not cand_user.is_active or cand_user.deleted_at is not None:
                continue

            eligible_list.append({
                "candidate_id": cand.id,
                "user_id": cand_user.id,
                "application_id": app.id,
                "full_name": cand_user.full_name,
                "candidate_name": cand_user.full_name,
                "email": cand_user.email,
                "job_id": job.id,
                "job_title": job.title,
                "applied_job": job.title,
                "ats_score": round(app.ats_score, 1) if app.ats_score is not None else 85.0,
                "applied_date": app.applied_at.strftime('%b %d, %Y') if app.applied_at else "Recent",
                "status": app.status or "Shortlisted"
            })

        logger.info("[ApplicationEligibilityService] Candidates Returned for Job %s: %d eligible candidate(s).", job_id, len(eligible_list))
        return eligible_list

    @staticmethod
    async def get_all_eligible_candidates(
        db: AsyncSession,
        recruiter_user_id: Optional[str] = None,
        is_admin: bool = False
    ) -> List[Dict[str, Any]]:
        """Queries all eligible shortlisted candidates across recruiter's jobs."""
        logger.info("[ApplicationEligibilityService] Querying all eligible candidates across jobs (is_admin=%s)", is_admin)

        if is_admin or not recruiter_user_id:
            res_jobs = await db.execute(select(JobPosting.id))
            job_ids = res_jobs.scalars().all()
        else:
            res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
            rec = res_rec.scalar_one_or_none()
            if not rec:
                return []
            res_jobs = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == rec.id))
            job_ids = res_jobs.scalars().all()

        all_candidates = []
        for jid in job_ids:
            cands = await ApplicationEligibilityService.get_eligible_candidates_for_job(db, jid)
            all_candidates.extend(cands)

        return all_candidates

eligibility_service = ApplicationEligibilityService()
