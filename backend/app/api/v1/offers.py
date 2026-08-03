import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, OfferLetter, Notification
from app.dependencies.auth import get_current_user, require_role
from app.api.v1.websocket import ws_manager

router = APIRouter(prefix="/offers", tags=["Offer Management"])

class OfferResponseRequest(BaseModel):
    action: str # Accept or Decline

@router.get("/my-offers", response_model=List[Dict[str, Any]], summary="Get Candidate Offer Letters")
async def get_candidate_offers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns official offer letters issued to the authenticated candidate."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    cand = res_c.scalar_one_or_none()
    if not cand:
        return []

    res = await db.execute(select(OfferLetter).where(OfferLetter.candidate_id == cand.id).order_by(OfferLetter.created_at.desc()))
    offers = res.scalars().all()

    out = []
    for o in offers:
        res_r = await db.execute(select(Recruiter).where(Recruiter.id == o.recruiter_id))
        rec = res_r.scalar_one_or_none()

        out.append({
            "id": o.id,
            "job_application_id": o.job_application_id,
            "job_title": o.job_title,
            "company_name": rec.company_name if rec else "SmartHire Corporate",
            "salary_offered": o.salary_offered,
            "start_date": o.start_date.strftime('%B %d, %Y') if o.start_date else "ASAP",
            "offer_letter_text": o.offer_letter_text,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "accepted_at": o.accepted_at.isoformat() if o.accepted_at else None
        })
    return out

@router.post("/{offer_id}/respond", summary="Accept or Decline Offer Letter")
async def respond_to_offer(
    offer_id: str,
    body: OfferResponseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows candidate to accept or decline an official offer letter."""
    res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
    cand = res_c.scalar_one_or_none()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate record not found.")

    res = await db.execute(select(OfferLetter).where(
        OfferLetter.id == offer_id,
        OfferLetter.candidate_id == cand.id
    ))
    offer = res.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer letter not found.")

    new_status = "Accepted" if body.action.lower() == "accept" else "Rejected"
    offer.status = new_status
    if new_status == "Accepted":
        offer.accepted_at = datetime.utcnow()

    # Update application status
    res_app = await db.execute(select(JobApplication).where(JobApplication.id == offer.job_application_id))
    app = res_app.scalar_one_or_none()
    if app:
        app.status = "Hired" if new_status == "Accepted" else "Rejected"

    await db.commit()

    # Broadcast WebSocket Event
    await ws_manager.broadcast({
        "event": "OFFER_RESPONSE",
        "data": {
            "offer_id": offer.id,
            "candidate_name": user.full_name,
            "job_title": offer.job_title,
            "status": new_status
        }
    })

    return {
        "status": "success",
        "message": f"Offer letter has been {new_status.lower()} successfully.",
        "offer_id": offer.id,
        "new_status": new_status
    }
