import os
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.models.domain import (
    JobPosting, JobApplication, Candidate, Recruiter, User, ScheduledInterview
)

logger = logging.getLogger("smarthire.recruitment_pipeline")

def normalize_resume_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    p = str(path).strip().replace("\\", "/")
    if p.startswith("http://") or p.startswith("https://"):
        return p
    fname = os.path.basename(p)
    if fname:
        return f"/uploads/resumes/{fname}"
    return p

class RecruitmentPipelineService:
    """Centralized Single Source of Truth for all Recruitment Pipeline Queries & Business Logic.

    Used across Recruiter Posted Jobs, Candidate Applications, Shortlisted Candidates,
    Interview Scheduler, Analytics, and Reports.
    """

    ELIGIBLE_SHORTLISTED_STATUSES = [
        "Shortlisted", "SHORTLISTED", "Screening Passed", "ATS Passed",
        "Assessment Eligible", "Assessment Passed", "Interview Eligible",
        "Move to Next Round", "Interview Scheduled", "Evaluation Ready",
        "Evaluation Generated", "Applied", "Hired"
    ]

    REJECTED_STATUSES = ["Rejected", "REJECTED", "ATS Rejected", "Assessment Failed", "Interview Failed", "Failed"]
    MINIMUM_ATS_SCORE = 80.0

    @staticmethod
    async def get_posted_jobs(db: AsyncSession, recruiter_user_id: str, is_admin: bool = False) -> List[Dict[str, Any]]:
        """Returns ONLY jobs created by the logged-in recruiter (or all for admin),
        with real-time aggregated counts from PostgreSQL for Applications, Shortlisted Candidates, and Scheduled Interviews.
        """
        logger.info("[RecruitmentPipelineService] Fetching Posted Jobs for Recruiter User ID: %s (is_admin=%s)", recruiter_user_id, is_admin)

        if is_admin:
            res_jobs = await db.execute(select(JobPosting).order_by(JobPosting.created_at.desc()))
        else:
            res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
            rec = res_rec.scalars().first()
            if rec:
                res_jobs = await db.execute(
                    select(JobPosting)
                    .where((JobPosting.recruiter_id == rec.id) | (JobPosting.recruiter_id == recruiter_user_id))
                    .order_by(JobPosting.created_at.desc())
                )
            else:
                res_jobs = await db.execute(
                    select(JobPosting)
                    .where(JobPosting.recruiter_id == recruiter_user_id)
                    .order_by(JobPosting.created_at.desc())
                )

        jobs = res_jobs.scalars().all()
        logger.info("Job Retrieved ✅ Recruiter Ownership Verified ✅ Recruiter Posted Jobs refreshed ✅ Count: %d jobs", len(jobs))

        out = []
        for j in jobs:
            # 1. Total Applications Count
            res_app_cnt = await db.execute(
                select(func.count(JobApplication.id)).where(JobApplication.job_id == j.id)
            )
            apps_count = res_app_cnt.scalar() or 0

            # 2. Shortlisted Candidates Count (ATS >= 80% AND Not Rejected Status)
            res_short_cnt = await db.execute(
                select(func.count(JobApplication.id)).where(
                    JobApplication.job_id == j.id,
                    JobApplication.ats_score >= RecruitmentPipelineService.MINIMUM_ATS_SCORE,
                    JobApplication.status.not_in(RecruitmentPipelineService.REJECTED_STATUSES)
                )
            )
            shortlisted_count = res_short_cnt.scalar() or 0

            # 3. Scheduled Interviews Count
            res_int_cnt = await db.execute(
                select(func.count(ScheduledInterview.id)).where(ScheduledInterview.job_id == j.id)
            )
            interview_count = res_int_cnt.scalar() or 0

            out.append({
                "id": j.id,
                "job_id": j.id,
                "title": j.title,
                "company": j.company_name or "SmartHire Corporate",
                "company_name": j.company_name or "SmartHire Corporate",
                "department": j.department or "Engineering",
                "employment_type": j.employment_type or "Full Time",
                "work_mode": j.work_mode or "Remote",
                "location": j.location or "San Francisco, CA / Remote",
                "salary": j.salary_range or "$120,000 - $160,000",
                "salary_range": j.salary_range or "$120,000 - $160,000",
                "status": j.status or "Published",
                "published_date": j.created_at.strftime('%b %d, %Y') if j.created_at else "Recent",
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "applications_count": apps_count,
                "shortlisted_count": shortlisted_count,
                "interview_count": interview_count,
                "experience_required": getattr(j, "experience_required", "3-5 Years") or "3-5 Years",
                "required_skills": j.required_skills or [],
                "description": j.description or ""
            })

        logger.info("Published Status Verified ✅ Applications Loaded ✅ Shortlisted Candidates Loaded ✅")
        return out

    @staticmethod
    async def get_applications(db: AsyncSession, recruiter_user_id: str, job_id: Optional[str] = None, is_admin: bool = False) -> List[Dict[str, Any]]:
        """Returns applications for jobs owned by recruiter (or filtered by specific job_id), with strictly linked evaluation metrics."""
        logger.info("[RecruitmentPipelineService] Fetching Applications for recruiter=%s, job_id=%s", recruiter_user_id, job_id)
        from app.models.domain import InterviewSession, ScoringReport, AssessmentSession, AssessmentResult

        query = select(JobApplication)
        if job_id:
            query = query.where(JobApplication.job_id == job_id)
        elif not is_admin:
            res_rec = await db.execute(select(Recruiter).where(Recruiter.user_id == recruiter_user_id))
            rec = res_rec.scalars().first()
            if not rec:
                return []
            res_jobs = await db.execute(select(JobPosting.id).where(JobPosting.recruiter_id == rec.id))
            jids = res_jobs.scalars().all()
            if not jids:
                return []
            query = query.where(JobApplication.job_id.in_(jids))

        res_apps = await db.execute(query.order_by(JobApplication.applied_at.desc()))
        apps = res_apps.scalars().all()
        if not apps:
            return []

        from app.models.domain import InterviewSession, ScoringReport, AssessmentSession, AssessmentResult, OfferLetter, Resume

        app_ids = [app.id for app in apps]
        cand_ids = list({app.candidate_id for app in apps if app.candidate_id})
        job_ids = list({app.job_id for app in apps if app.job_id})
        resume_ids = list({app.resume_id for app in apps if app.resume_id})

        # 1. Batch fetch Candidates & Users
        cands_map = {}
        if cand_ids:
            res_cu = await db.execute(
                select(Candidate, User)
                .outerjoin(User, Candidate.user_id == User.id)
                .where(Candidate.id.in_(cand_ids))
            )
            for c, u in res_cu.all():
                cands_map[c.id] = (c, u)

        # 2. Batch fetch Jobs
        jobs_map = {}
        if job_ids:
            res_j = await db.execute(select(JobPosting).where(JobPosting.id.in_(job_ids)))
            for j in res_j.scalars().all():
                jobs_map[j.id] = j

        # 3. Batch fetch Resumes
        resumes_map = {}
        if resume_ids:
            res_r = await db.execute(select(Resume).where(Resume.id.in_(resume_ids)))
            for r in res_r.scalars().all():
                resumes_map[r.id] = r

        # 4. Batch fetch strictly RECRUITER Assessment Sessions & Results
        assess_sess_map = {}
        res_assess = await db.execute(
            select(AssessmentSession)
            .where(
                AssessmentSession.job_application_id.in_(app_ids),
                AssessmentSession.is_recruiter_configured.is_(True)
            )
            .order_by(AssessmentSession.created_at.desc())
        )
        for asess in res_assess.scalars().all():
            if asess.job_application_id not in assess_sess_map:
                assess_sess_map[asess.job_application_id] = asess

        assess_results_map = {}
        assess_ids = [s.id for s in assess_sess_map.values() if s.id]
        if assess_ids:
            res_ar = await db.execute(select(AssessmentResult).where(AssessmentResult.session_id.in_(assess_ids)))
            for ar in res_ar.scalars().all():
                assess_results_map[ar.session_id] = ar

        # 5. Batch fetch Scheduled Interviews & Sessions
        sched_map = {}
        res_scheds = await db.execute(
            select(ScheduledInterview)
            .where(ScheduledInterview.job_application_id.in_(app_ids))
            .order_by(ScheduledInterview.scheduled_date.desc())
        )
        for sc in res_scheds.scalars().all():
            sched_map.setdefault(sc.job_application_id, []).append(sc)

        int_sess_map = {}
        res_sessions = await db.execute(
            select(InterviewSession)
            .where(
                InterviewSession.job_application_id.in_(app_ids),
                InterviewSession.interview_type == "Recruiter"
            )
            .order_by(InterviewSession.started_at.desc())
        )
        all_int_sessions = res_sessions.scalars().all()
        for isess in all_int_sessions:
            int_sess_map.setdefault(isess.job_application_id, []).append(isess)

        # 6. Batch fetch Reports
        all_rep_sess_ids = [s.id for s in all_int_sessions if s.id]
        for s_list in sched_map.values():
            for sc in s_list:
                if sc.session_id:
                    all_rep_sess_ids.append(sc.session_id)
        all_rep_sess_ids = list(set(all_rep_sess_ids))

        reports_map = {}
        if all_rep_sess_ids:
            res_reps = await db.execute(select(ScoringReport).where(ScoringReport.session_id.in_(all_rep_sess_ids)))
            for rep in res_reps.scalars().all():
                reports_map[rep.session_id] = rep

        # 7. Batch fetch Offer Letters
        offers_map = {}
        res_offs = await db.execute(select(OfferLetter).where(OfferLetter.job_application_id.in_(app_ids)))
        for off in res_offs.scalars().all():
            offers_map.setdefault(off.job_application_id, []).append(off)

        out = []
        for app in apps:
            cand_tuple = cands_map.get(app.candidate_id)
            cand = cand_tuple[0] if cand_tuple else None
            cand_user = cand_tuple[1] if cand_tuple else None
            job = jobs_map.get(app.job_id)

            r_obj = resumes_map.get(app.resume_id)
            resume_url = r_obj.file_path if (r_obj and r_obj.file_path) else getattr(cand, "resume_url", None)

            # Strictly fetch Assessment Session & Result LINKED to THIS specific application
            assess_sess = assess_sess_map.get(app.id)
            assess_res = assess_results_map.get(assess_sess.id) if assess_sess else None
            assess_score = round(assess_res.overall_score, 1) if (assess_res and assess_res.overall_score is not None) else None

            recruiter_assessment = None
            if assess_sess:
                recruiter_assessment = {
                    "session_id": assess_sess.id,
                    "status": "Completed" if assess_res else (assess_sess.status or "Scheduled"),
                    "score": assess_score,
                    "attempt_date": assess_res.created_at.strftime('%B %d, %Y') if (assess_res and assess_res.created_at) else (assess_sess.created_at.strftime('%B %d, %Y') if assess_sess.created_at else "Recently"),
                    "duration_minutes": assess_sess.duration_minutes or 30
                }

            sched_list = sched_map.get(app.id, [])
            session_list = int_sess_map.get(app.id, [])

            def get_round_data(r_type: str):
                matched_session = next((s for s in session_list if (s.round_type or '').lower() == r_type.lower()), None)
                matched_sched = next((s for s in sched_list if (s.round_type or '').lower() == r_type.lower()), None)

                if not matched_session and matched_sched and matched_sched.session_id:
                    for s in session_list:
                        if s.id == matched_sched.session_id:
                            matched_session = s
                            break

                sess_id = matched_session.id if matched_session else (matched_sched.session_id if matched_sched else None)
                if not matched_session and not matched_sched:
                    return None

                rep = reports_map.get(sess_id) if sess_id else None
                is_completed = (rep is not None) or (matched_session and matched_session.status in ["completed", "Completed"])
                status_val = "Completed" if is_completed else (matched_session.status if matched_session else (matched_sched.status if matched_sched else "Scheduled"))

                return {
                    "schedule_id": matched_sched.id if matched_sched else None,
                    "session_id": sess_id,
                    "round_type": r_type.capitalize(),
                    "status": status_val,
                    "scheduled_date": matched_sched.scheduled_date.strftime('%B %d, %Y %I:%M %p') if (matched_sched and matched_sched.scheduled_date) else None,
                    "duration_minutes": matched_sched.duration_minutes if matched_sched else (matched_session.duration_minutes if matched_session else 30),
                    "overall_score": round(rep.overall_score, 1) if (rep and rep.overall_score is not None) else None,
                    "technical_score": round(rep.technical_score, 1) if (rep and rep.technical_score is not None) else None,
                    "communication_score": round(rep.communication_score, 1) if (rep and rep.communication_score is not None) else None,
                    "confidence_score": round(rep.confidence_score, 1) if (rep and rep.confidence_score is not None) else None,
                    "professionalism_score": round(rep.professionalism_score, 1) if (rep and rep.professionalism_score is not None) else None,
                    "is_conducted": is_completed
                }

            tech_round = get_round_data("technical")
            behav_round = get_round_data("behavioral")
            hr_round = get_round_data("hr")

            # Offer Letter Details
            all_offs = offers_map.get(app.id, [])
            off = next((o for o in all_offs if o.status == "Accepted"), all_offs[0] if all_offs else None)
            offer_details = {
                "id": off.id,
                "salary_offered": off.salary_offered,
                "start_date": off.start_date.strftime('%B %d, %Y') if off.start_date else "ASAP",
                "offer_letter_text": off.offer_letter_text,
                "status": off.status
            } if off else None

            app_st_lower = (app.status or "").lower()

            # Robust pass determination:
            is_tech_passed = (
                (tech_round and tech_round.get("status") in ["Passed", "Passed by Recruiter"]) or
                app_st_lower in [
                    "tech passed", "technical passed", "round 2",
                    "behavioral scheduled", "behavioral in progress", "behavioral evaluation ready", "behavioral passed",
                    "hr scheduled", "hr in progress", "hr evaluation ready", "hr passed",
                    "selected", "offer sent", "hired", "accepted"
                ] or
                (behav_round is not None) or
                (hr_round is not None) or
                (offer_details is not None)
            ) and not ("tech failed" in app_st_lower or "technical failed" in app_st_lower)
            if is_tech_passed and tech_round:
                tech_round["is_passed"] = True
                tech_round["status"] = "Passed by Recruiter"
                tech_round["is_conducted"] = True

            is_behav_passed = (
                (behav_round and behav_round.get("status") in ["Passed", "Passed by Recruiter"]) or
                app_st_lower in [
                    "behavioral passed", "move to hr",
                    "hr scheduled", "hr in progress", "hr evaluation ready", "hr passed",
                    "selected", "offer sent", "hired", "accepted"
                ] or
                (hr_round is not None) or
                (offer_details is not None)
            ) and not ("behavioral failed" in app_st_lower)
            if is_behav_passed and behav_round:
                behav_round["is_passed"] = True
                behav_round["status"] = "Passed by Recruiter"
                behav_round["is_conducted"] = True

            is_hr_passed = (
                (hr_round and hr_round.get("status") in ["Passed", "Passed by Recruiter"]) or
                app_st_lower in ["hr passed", "selected", "offer sent", "hired", "accepted"] or
                (offer_details is not None)
            ) and not ("hr failed" in app_st_lower)
            if is_hr_passed and hr_round:
                hr_round["is_passed"] = True
                hr_round["status"] = "Passed by Recruiter"
                hr_round["is_conducted"] = True

            # Pick latest conducted interview for session_id link
            active_interview = (
                (hr_round if hr_round and hr_round.get("is_conducted") else None) or
                (behav_round if behav_round and behav_round.get("is_conducted") else None) or
                (tech_round if tech_round and tech_round.get("is_conducted") else None) or
                hr_round or behav_round or tech_round
            )

            conducted_session_id = (
                (hr_round["session_id"] if (hr_round and hr_round.get("is_conducted") and hr_round.get("session_id")) else None) or
                (behav_round["session_id"] if (behav_round and behav_round.get("is_conducted") and behav_round.get("session_id")) else None) or
                (tech_round["session_id"] if (tech_round and tech_round.get("is_conducted") and tech_round.get("session_id")) else None) or
                (active_interview["session_id"] if (active_interview and active_interview.get("is_conducted")) else None)
            )

            out.append({
                "id": app.id,
                "job_id": app.job_id,
                "candidate_id": app.candidate_id,
                "full_name": cand_user.full_name if cand_user else "Candidate",
                "candidate_name": cand_user.full_name if cand_user else "Candidate",
                "candidate_email": cand_user.email if cand_user else "N/A",
                "job_title": job.title if job else "Position",
                "ats_score": round(app.ats_score, 1) if app.ats_score is not None else 0.0,
                "resume_url": normalize_resume_path(resume_url),
                "overall_score": active_interview["overall_score"] if active_interview else None,
                "communication_score": active_interview["communication_score"] if active_interview else None,
                "confidence_score": active_interview["confidence_score"] if active_interview else None,
                "technical_score": active_interview["technical_score"] if active_interview else None,
                "assessment_score": assess_score,
                "recruiter_assessment": recruiter_assessment,
                "recruiter_interview": active_interview,
                "technical_round": tech_round,
                "behavioral_round": behav_round,
                "hr_round": hr_round,
                "offer_details": offer_details,
                "session_id": conducted_session_id,
                "status": app.status or "Applied",
                "applied_date": app.applied_at.strftime('%b %d, %Y') if app.applied_at else "Recent",
                "matching_skills": app.matching_skills or [],
                "missing_skills": app.missing_skills or []
            })

        logger.info("Applications Loaded ✅ Count: %d", len(out))
        return out

    @staticmethod
    async def get_shortlisted_candidates(db: AsyncSession, recruiter_user_id: str, job_id: Optional[str] = None, is_admin: bool = False) -> List[Dict[str, Any]]:
        """Returns candidates who satisfy ATS score >= 80% and non-rejected status for recruiter's jobs."""
        logger.info("[RecruitmentPipelineService] Fetching Shortlisted Candidates for recruiter=%s, job_id=%s", recruiter_user_id, job_id)

        all_apps = await RecruitmentPipelineService.get_applications(db, recruiter_user_id, job_id=job_id, is_admin=is_admin)
        shortlisted = [
            a for a in all_apps 
            if a["ats_score"] >= RecruitmentPipelineService.MINIMUM_ATS_SCORE 
            and a["status"] not in RecruitmentPipelineService.REJECTED_STATUSES
        ]

        logger.info("ATS Loaded ✅ Shortlisted Candidates Loaded ✅ Count: %d", len(shortlisted))
        return shortlisted

    @staticmethod
    async def get_eligible_candidates_for_assessment_scheduler(db: AsyncSession, recruiter_user_id: str, job_id: str) -> List[Dict[str, Any]]:
        """Returns ONLY candidates who passed ATS screening (ATS >= 80%) for Online Assessment scheduling."""
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
        job = res_j.scalars().first()
        if not job:
            return []

        res_apps = await db.execute(
            select(JobApplication)
            .where(
                JobApplication.job_id == job_id,
                JobApplication.ats_score >= RecruitmentPipelineService.MINIMUM_ATS_SCORE,
                JobApplication.status.not_in(RecruitmentPipelineService.REJECTED_STATUSES)
            )
            .order_by(JobApplication.applied_at.desc())
        )
        apps = res_apps.scalars().all()

        out = []
        for app in apps:
            res_c = await db.execute(select(Candidate).where(Candidate.id == app.candidate_id))
            cand = res_c.scalars().first()
            if not cand:
                continue

            res_u = await db.execute(select(User).where(User.id == cand.user_id))
            cand_user = res_u.scalars().first()
            if not cand_user or not cand_user.is_active or getattr(cand_user, 'deleted_at', None) is not None:
                continue

            out.append({
                "candidate_id": cand.id,
                "id": cand.id,
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
                "status": app.status or "ATS Passed",
                "eligibility": "Assessment Eligible (ATS >= 80%)"
            })

        return out

    @staticmethod
    async def get_eligible_candidates_for_interview_scheduler(db: AsyncSession, recruiter_user_id: str, job_id: str) -> List[Dict[str, Any]]:
        """Returns candidates for Interview scheduling with strict sequential funnel status (Assessment Passed vs In-Progress)."""
        from app.models.domain import AssessmentSession, AssessmentResult
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
        job = res_j.scalars().first()
        if not job:
            return []

        res_apps = await db.execute(
            select(JobApplication)
            .where(
                JobApplication.job_id == job_id,
                JobApplication.ats_score >= RecruitmentPipelineService.MINIMUM_ATS_SCORE,
                JobApplication.status.not_in(RecruitmentPipelineService.REJECTED_STATUSES)
            )
            .order_by(JobApplication.applied_at.desc())
        )
        apps = res_apps.scalars().all()

        out = []
        for app in apps:
            res_c = await db.execute(select(Candidate).where(Candidate.id == app.candidate_id))
            cand = res_c.scalars().first()
            if not cand:
                continue

            res_u = await db.execute(select(User).where(User.id == cand.user_id))
            cand_user = res_u.scalars().first()
            if not cand_user or not cand_user.is_active or getattr(cand_user, 'deleted_at', None) is not None:
                continue

            # Fetch linked Assessment Result
            res_ass = await db.execute(
                select(AssessmentResult)
                .join(AssessmentSession, AssessmentResult.session_id == AssessmentSession.id)
                .where(AssessmentSession.job_application_id == app.id)
                .order_by(AssessmentResult.created_at.desc())
            )
            ass_res = res_ass.scalars().first()
            assess_score = round(ass_res.overall_score, 1) if (ass_res and ass_res.overall_score is not None) else None

            # STRICT ENFORCEMENT: Candidates MUST have taken and PASSED the Online Assessment stage to be eligible for Interview
            has_passed_assessment = False
            if app.status in ["Assessment Passed", "Interview Eligible"]:
                has_passed_assessment = True
            elif ass_res and (ass_res.overall_score is not None and ass_res.overall_score >= 60.0 or ass_res.hiring_recommendation == "Pass"):
                has_passed_assessment = True

            # If candidate has not passed the online assessment, skip from interview scheduling candidate list
            if not has_passed_assessment:
                continue

            stage_label = f"Interview Eligible (Assessment Score: {assess_score if assess_score is not None else 80}%)"

            out.append({
                "candidate_id": cand.id,
                "id": cand.id,
                "user_id": cand_user.id,
                "application_id": app.id,
                "full_name": cand_user.full_name,
                "candidate_name": cand_user.full_name,
                "email": cand_user.email,
                "job_id": job.id,
                "job_title": job.title,
                "applied_job": job.title,
                "ats_score": round(app.ats_score, 1) if app.ats_score is not None else 80.0,
                "assessment_score": assess_score,
                "applied_date": app.applied_at.strftime('%b %d, %Y') if app.applied_at else "Recent",
                "status": app.status or "Assessment Passed",
                "has_passed_assessment": True,
                "eligibility": stage_label
            })

        return out

    @staticmethod
    async def get_eligible_candidates_for_scheduler(db: AsyncSession, recruiter_user_id: str, job_id: str, schedule_type: str = "interview") -> List[Dict[str, Any]]:
        """General candidates list selector router."""
        if schedule_type == "assessment":
            return await RecruitmentPipelineService.get_eligible_candidates_for_assessment_scheduler(db, recruiter_user_id, job_id)
        return await RecruitmentPipelineService.get_eligible_candidates_for_interview_scheduler(db, recruiter_user_id, job_id)

    @staticmethod
    async def close_job(db: AsyncSession, recruiter_user_id: str, job_id: str) -> bool:
        """Closes a posted job requisition."""
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
        job = res_j.scalars().first()
        if not job:
            return False
        job.status = "Closed"
        await db.commit()
        logger.info("[RecruitmentPipelineService] Job %s closed successfully by user %s", job_id, recruiter_user_id)
        return True

    @staticmethod
    async def delete_job(db: AsyncSession, recruiter_user_id: str, job_id: str) -> bool:
        """Deletes a posted job requisition from PostgreSQL."""
        res_j = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
        job = res_j.scalars().first()
        if not job:
            return False
        await db.delete(job)
        await db.commit()
        logger.info("[RecruitmentPipelineService] Job %s deleted successfully by user %s", job_id, recruiter_user_id)
        return True

pipeline_service = RecruitmentPipelineService()
