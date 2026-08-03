from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import get_db
from app.models.domain import User, Notification
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notification Center"])

@router.get("/me", summary="Get User Notifications")
async def get_my_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns notifications for authenticated candidate or recruiter with unread count."""
    res = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
    )
    notifs = res.scalars().all()
    unread_count = len([n for n in notifs if not n.is_read])

    out = []
    for n in notifs:
        out.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "timestamp": n.created_at.strftime('%I:%M %p · %b %d') if n.created_at else "Just now"
        })

    return {
        "unread_count": unread_count,
        "notifications": out
    }

@router.post("/{notification_id}/read", summary="Mark Single Notification as Read")
async def mark_notification_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks a single notification as read."""
    res = await db.execute(select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user.id
    ))
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()

    return {"status": "success", "notification_id": notification_id}

@router.post("/read-all", summary="Mark All Notifications as Read")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks all notifications for authenticated user as read."""
    res = await db.execute(select(Notification).where(
        Notification.user_id == user.id,
        Notification.is_read == False
    ))
    notifs = res.scalars().all()
    for n in notifs:
        n.is_read = True

    await db.commit()
    return {"status": "success", "marked_count": len(notifs)}
