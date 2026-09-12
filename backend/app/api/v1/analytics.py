import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter
from app.dependencies.auth import get_current_user, require_role
from app.services.analytics_service import analytics_service

logger = logging.getLogger("smarthire.analytics_router")

router = APIRouter(prefix="/analytics", tags=["Interview Analytics & Intelligence"])


@router.get("/candidate/trends", summary="Get Candidate Historical Performance Trends")
async def get_candidate_trends(
    candidate_id: Optional[str] = Query(None, description="Candidate ID (Required for Recruiter/Admin)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves chronological performance trends comparing overall and category-level
    scores across all completed interviews.
    """
    target_candidate_id = None

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cand = res_c.scalars().first()
        if not cand:
            cand = Candidate(user_id=current_user.id, target_role="Software Engineer")
            db.add(cand)
            await db.flush()
        target_candidate_id = cand.id
    elif current_user.role in ["recruiter", "admin"]:
        if not candidate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="candidate_id query parameter is required for recruiter/admin requests."
            )
        target_candidate_id = candidate_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await analytics_service.get_candidate_performance_trends(db, target_candidate_id)


@router.get("/candidate/weak-areas", summary="Get Candidate Recurring Weak Areas & Predictions")
async def get_candidate_weak_areas(
    candidate_id: Optional[str] = Query(None, description="Candidate ID (Required for Recruiter/Admin)"),
    threshold: float = Query(60.0, description="Configurable weak area threshold (default: 60.0)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves historical weak-area analysis identifying recurring weaknesses
    across completed interviews with evidence-based recommendations and verified taxonomy resources.
    """
    target_candidate_id = None

    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cand = res_c.scalars().first()
        if not cand:
            cand = Candidate(user_id=current_user.id, target_role="Software Engineer")
            db.add(cand)
            await db.flush()
        target_candidate_id = cand.id
    elif current_user.role in ["recruiter", "admin"]:
        if not candidate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="candidate_id query parameter is required for recruiter/admin requests."
            )
        target_candidate_id = candidate_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await analytics_service.get_candidate_weak_areas(db, target_candidate_id, threshold=threshold)


@router.get("/candidates/ranking", summary="Get Recruiter Candidate Ranking Metrics")
async def get_candidate_ranking(
    job_id: Optional[str] = Query(None, description="Optional job requisition filter ID"),
    current_user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves deterministic candidate rankings based on authoritative completed interview
    evaluation scores with transparent multi-level tie-breakers.
    """
    return await analytics_service.get_candidate_ranking(
        db,
        recruiter_user_id=current_user.id,
        job_id=job_id,
        user_role=current_user.role
    )


@router.get("/candidate/skills", summary="Get Candidate Skill-Wise Competency Analytics")
async def get_candidate_skills(
    candidate_id: Optional[str] = Query(None, description="Candidate ID (Required for Recruiter/Admin)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves comprehensive skill-wise mastery metrics and observation telemetry across
    all completed interview sessions and verified resume skills.
    """
    target_candidate_id = None
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cand = res_c.scalars().first()
        if not cand:
            cand = Candidate(user_id=current_user.id, target_role="Software Engineer")
            db.add(cand)
            await db.flush()
        target_candidate_id = cand.id
    elif current_user.role in ["recruiter", "admin"]:
        if not candidate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="candidate_id query parameter is required for recruiter/admin requests."
            )
        target_candidate_id = candidate_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await analytics_service.get_candidate_skill_analytics(db, target_candidate_id)


@router.get("/candidate/improvement-progress", summary="Get Candidate AI Feedback & Improvement Velocity")
async def get_candidate_improvement_progress(
    candidate_id: Optional[str] = Query(None, description="Candidate ID (Required for Recruiter/Admin)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves milestone achievements, score delta progression, coaching feedback,
    and improvement velocity across completed interview simulations.
    """
    target_candidate_id = None
    if current_user.role == "candidate":
        res_c = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
        cand = res_c.scalars().first()
        if not cand:
            cand = Candidate(user_id=current_user.id, target_role="Software Engineer")
            db.add(cand)
            await db.flush()
        target_candidate_id = cand.id
    elif current_user.role in ["recruiter", "admin"]:
        if not candidate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="candidate_id query parameter is required for recruiter/admin requests."
            )
        target_candidate_id = candidate_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await analytics_service.get_candidate_improvement_progress(db, target_candidate_id)


from pydantic import BaseModel

class CandidateComparisonRequest(BaseModel):
    candidate_ids: List[str]
    job_id: Optional[str] = None


@router.post("/recruiter/candidate-comparison", summary="Compare Multiple Candidates Side-by-Side")
async def compare_candidates(
    body: CandidateComparisonRequest,
    current_user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Provides side-by-side comparative analysis of 2 to 4 candidates
    evaluating competencies, strengths, weaknesses, and AI hiring recommendations.
    """
    return await analytics_service.get_candidate_comparison(
        db,
        candidate_ids=body.candidate_ids,
        recruiter_user_id=current_user.id,
        job_id=body.job_id
    )


@router.get("/recruiter/skill-analytics", summary="Get Applicant Pool Skill Analytics")
async def get_recruiter_skill_analytics(
    job_id: Optional[str] = Query(None, description="Optional job requisition filter ID"),
    current_user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Aggregates applicant pool skill competencies, demand vs supply,
    and talent scarcity metrics across recruiter's job requisitions.
    """
    return await analytics_service.get_recruiter_skill_analytics(
        db,
        recruiter_user_id=current_user.id,
        job_id=job_id
    )


@router.get("/recruiter/performance-trends", summary="Get Recruiter Cohort Performance Trends")
async def get_recruiter_performance_trends(
    job_id: Optional[str] = Query(None, description="Optional job requisition filter ID"),
    current_user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves cohort performance progression over time for candidates applying
    to recruiter's job requisitions.
    """
    return await analytics_service.get_recruiter_performance_trends(
        db,
        recruiter_user_id=current_user.id,
        job_id=job_id
    )


@router.get("/recruiter/shortlisting-insights", summary="Get AI Shortlisting Insights & Recommendations")
async def get_recruiter_shortlisting_insights(
    job_id: Optional[str] = Query(None, description="Optional job requisition filter ID"),
    current_user: User = Depends(require_role(["recruiter", "admin"])),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Generates AI shortlisting recommendations, qualification benchmark compliance,
    and talent pool conversion insights.
    """
    return await analytics_service.get_recruiter_shortlisting_insights(
        db,
        recruiter_user_id=current_user.id,
        job_id=job_id
    )

