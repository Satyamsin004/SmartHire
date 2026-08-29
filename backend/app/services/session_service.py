import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from app.models.domain import InterviewSession
from app.core.events import (
    SessionEventType,
    SessionEventPayload,
    session_event_publisher
)

logger = logging.getLogger("smarthire.session_service")


class SessionService:
    """
    Service layer for managing InterviewSession state transitions and emitting
    consistent, transport-decoupled domain events for realtime dashboards.
    """

    @staticmethod
    def build_event_payload(
        session: InterviewSession,
        event_type: SessionEventType,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionEventPayload:
        """
        Constructs a standardized SessionEventPayload containing authorization metadata
        and essential state information, avoiding direct database model leakage.
        """
        merged_meta = {
            "title": session.title,
            "role_target": session.role_target,
            "round_type": session.round_type,
            "difficulty": session.difficulty,
            "duration_minutes": session.duration_minutes,
            "question_count": session.question_count,
            "fsm_state": session.fsm_state,
        }
        if metadata:
            merged_meta.update(metadata)

        return SessionEventPayload(
            event_type=event_type,
            session_id=session.id,
            candidate_id=session.candidate_id,
            interview_id=session.scheduled_interview_id or session.id,
            recruiter_id=session.recruiter_id,
            job_application_id=session.job_application_id,
            job_id=session.job_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            status=session.status,
            metadata=merged_meta
        )

    @classmethod
    async def create_session(
        cls,
        db: AsyncSession,
        candidate_id: str,
        title: str,
        role_target: str = "Software Engineer",
        round_type: str = "Technical",
        difficulty: str = "Medium",
        duration_minutes: int = 30,
        question_count: int = 6,
        interview_type: str = "CandidatePractice",
        scheduled_interview_id: Optional[str] = None,
        recruiter_id: Optional[str] = None,
        job_application_id: Optional[str] = None,
        job_id: Optional[str] = None,
        resume_id: Optional[str] = None,
        config_json: Optional[Dict[str, Any]] = None
    ) -> InterviewSession:
        """Creates a new interview session record and emits SESSION_CREATED event."""
        session = InterviewSession(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            recruiter_id=recruiter_id,
            job_application_id=job_application_id,
            job_id=job_id,
            resume_id=resume_id,
            scheduled_interview_id=scheduled_interview_id,
            title=title,
            role_target=role_target,
            round_type=round_type,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
            question_count=question_count,
            interview_type=interview_type,
            config_json=config_json or {},
            fsm_state="WAITING_FOR_QUESTION",
            status="created",
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow()
        )
        db.add(session)
        await db.flush()

        event = cls.build_event_payload(session, SessionEventType.SESSION_CREATED)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def start_session(
        cls,
        db: AsyncSession,
        session_id: str
    ) -> InterviewSession:
        """Marks session as active, updates start timestamp, and emits SESSION_STARTED event."""
        session = await cls._get_session_or_404(db, session_id)
        session.status = "active"
        session.started_at = datetime.utcnow()
        await db.flush()

        event = cls.build_event_payload(session, SessionEventType.SESSION_STARTED)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def pause_session(
        cls,
        db: AsyncSession,
        session_id: str,
        reason: Optional[str] = None
    ) -> InterviewSession:
        """Pauses an active session and emits SESSION_PAUSED event."""
        session = await cls._get_session_or_404(db, session_id)
        if session.status in ["completed", "cancelled", "expired"]:
            raise HTTPException(status_code=400, detail=f"Cannot pause a session with status '{session.status}'.")

        session.status = "paused"
        await db.flush()

        metadata = {"pause_reason": reason or "User requested pause"}
        event = cls.build_event_payload(session, SessionEventType.SESSION_PAUSED, metadata=metadata)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def resume_session(
        cls,
        db: AsyncSession,
        session_id: str
    ) -> InterviewSession:
        """Resumes a paused session and emits SESSION_RESUMED event."""
        session = await cls._get_session_or_404(db, session_id)
        if session.status != "paused":
            raise HTTPException(status_code=400, detail=f"Cannot resume a session with status '{session.status}'. Session must be paused.")

        session.status = "active"
        await db.flush()

        event = cls.build_event_payload(session, SessionEventType.SESSION_RESUMED)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def complete_session(
        cls,
        db: AsyncSession,
        session_id: str,
        reason: Optional[str] = None
    ) -> InterviewSession:
        """Completes a session, records end time, and emits SESSION_COMPLETED event."""
        session = await cls._get_session_or_404(db, session_id)
        session.status = "completed"
        session.ended_at = datetime.utcnow()
        await db.flush()

        metadata = {"completion_reason": reason or "Interview finished"}
        event = cls.build_event_payload(session, SessionEventType.SESSION_COMPLETED, metadata=metadata)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def cancel_session(
        cls,
        db: AsyncSession,
        session_id: str,
        reason: Optional[str] = None
    ) -> InterviewSession:
        """Cancels a session, records end time, and emits SESSION_CANCELLED event."""
        session = await cls._get_session_or_404(db, session_id)
        session.status = "cancelled"
        session.ended_at = datetime.utcnow()
        await db.flush()

        metadata = {"cancellation_reason": reason or "Cancelled by user or system"}
        event = cls.build_event_payload(session, SessionEventType.SESSION_CANCELLED, metadata=metadata)
        await session_event_publisher.publish(event)
        return session

    @classmethod
    async def expire_session(
        cls,
        db: AsyncSession,
        session_id: str,
        reason: Optional[str] = None
    ) -> InterviewSession:
        """Expires a session due to timeout or inactivity and emits SESSION_EXPIRED event."""
        session = await cls._get_session_or_404(db, session_id)
        session.status = "expired"
        session.ended_at = datetime.utcnow()
        await db.flush()

        metadata = {"expiration_reason": reason or "Session timed out"}
        event = cls.build_event_payload(session, SessionEventType.SESSION_EXPIRED, metadata=metadata)
        await session_event_publisher.publish(event)
        return session

    @staticmethod
    async def _get_session_or_404(db: AsyncSession, session_id: str) -> InterviewSession:
        res = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
        session = res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found.")
        return session
