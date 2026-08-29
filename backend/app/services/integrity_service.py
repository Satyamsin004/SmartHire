import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.models.domain import (
    InterviewSession, InterviewIntegrityEvent, Candidate, User, ScoringReport
)

logger = logging.getLogger("smarthire.integrity_service")

class IntegrityService:
    """Manages interview simulation integrity events, deterministic scoring,
    incident lifecycle tracking, and automatic termination policies.
    """

    PENALTIES = {
        "MULTIPLE_PERSON": 10.0,
        "MOBILE_PHONE": 15.0,
        "FACE_NOT_VISIBLE": 5.0,
        "TAB_SWITCH": 40.0
    }

    @classmethod
    def compute_score_and_status(
        cls, events: List[InterviewIntegrityEvent], is_terminated: bool = False
    ) -> Tuple[float, str, Dict[str, int]]:
        """Calculates deterministic integrity score (0-100), status, and breakdown."""
        counts = {
            "MULTIPLE_PERSON": 0,
            "MOBILE_PHONE": 0,
            "FACE_NOT_VISIBLE": 0,
            "TAB_SWITCH": 0
        }

        total_penalty = 0.0
        has_tab_switch = False
        has_critical = False

        for evt in events:
            evt_type = (evt.event_type or "").upper()
            if evt_type in counts:
                counts[evt_type] += 1
            else:
                counts[evt_type] = 1

            penalty = cls.PENALTIES.get(evt_type, 5.0)
            total_penalty += penalty

            if evt_type == "TAB_SWITCH" or evt.status == "TERMINATED":
                has_tab_switch = True
            if (evt.severity or "").upper() == "CRITICAL":
                has_critical = True

        score = max(0.0, min(100.0, round(100.0 - total_penalty, 1)))

        if is_terminated or has_tab_switch:
            status = "TERMINATED"
        elif score < 70.0 or len(events) >= 5 or has_critical:
            status = "CRITICAL"
        elif score < 90.0 or len(events) >= 1:
            status = "FLAGGED"
        else:
            status = "CLEAN"

        return score, status, counts

    async def get_session_integrity_summary(
        self, db: AsyncSession, session_id: str
    ) -> Dict[str, Any]:
        """Calculates and returns the complete integrity audit summary for a session."""
        stmt_sess = select(InterviewSession).where(InterviewSession.id == session_id)
        res_sess = await db.execute(stmt_sess)
        session = res_sess.scalar_one_or_none()

        if not session:
            raise ValueError(f"Interview session {session_id} not found.")

        stmt_events = (
            select(InterviewIntegrityEvent)
            .where(InterviewIntegrityEvent.session_id == session_id)
            .order_by(InterviewIntegrityEvent.started_at.asc())
        )
        res_events = await db.execute(stmt_events)
        events = list(res_events.scalars().all())

        is_term = session.status == "TERMINATED" or bool(session.termination_reason)
        score, status, counts = self.compute_score_and_status(events, is_terminated=is_term)

        # Update session cached integrity metrics
        session.integrity_score = score
        session.integrity_status = status
        session.total_integrity_incidents = len(events)
        await db.flush()

        timeline = [
            {
                "id": e.id,
                "event_type": e.event_type,
                "severity": e.severity,
                "status": e.status,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "ended_at": e.ended_at.isoformat() if e.ended_at else None,
                "duration_seconds": e.duration_seconds,
                "confidence": e.confidence,
                "metadata": e.metadata_json or {}
            }
            for e in events
        ]

        return {
            "session_id": session_id,
            "integrity_status": status,
            "integrity_score": score,
            "total_incidents": len(events),
            "breakdown": {
                "multiple_person": counts.get("MULTIPLE_PERSON", 0),
                "mobile_phone": counts.get("MOBILE_PHONE", 0),
                "face_not_visible": counts.get("FACE_NOT_VISIBLE", 0),
                "tab_switch": counts.get("TAB_SWITCH", 0)
            },
            "is_terminated": is_term,
            "termination_reason": session.termination_reason,
            "terminated_at": session.terminated_at.isoformat() if session.terminated_at else None,
            "timeline": timeline
        }

    async def record_or_update_event(
        self,
        db: AsyncSession,
        session_id: str,
        candidate_id: Optional[str],
        data: Dict[str, Any]
    ) -> Tuple[InterviewIntegrityEvent, Dict[str, Any]]:
        """Creates a new integrity incident or updates/resolves an active incident."""
        stmt_sess = select(InterviewSession).where(InterviewSession.id == session_id)
        res_sess = await db.execute(stmt_sess)
        session = res_sess.scalar_one_or_none()

        if not session:
            raise ValueError(f"Interview session {session_id} not found.")

        cand_id = candidate_id or session.candidate_id
        event_id = data.get("event_id") or data.get("id")
        event = None

        if event_id:
            stmt_evt = select(InterviewIntegrityEvent).where(
                InterviewIntegrityEvent.id == event_id,
                InterviewIntegrityEvent.session_id == session_id
            )
            res_evt = await db.execute(stmt_evt)
            event = res_evt.scalar_one_or_none()

        if event:
            # Update existing active incident
            if "status" in data:
                event.status = data["status"]
            if "ended_at" in data:
                try:
                    parsed = datetime.fromisoformat(data["ended_at"].replace("Z", "+00:00"))
                    event.ended_at = parsed.replace(tzinfo=None)
                except Exception:
                    event.ended_at = datetime.utcnow()
            elif data.get("status") == "RESOLVED" and not event.ended_at:
                event.ended_at = datetime.utcnow()

            if "duration_seconds" in data:
                event.duration_seconds = float(data["duration_seconds"])
            elif event.ended_at and event.started_at:
                event.duration_seconds = max(0.0, (event.ended_at - event.started_at).total_seconds())

            if "confidence" in data:
                event.confidence = float(data["confidence"])
            if "metadata" in data:
                event.metadata_json = {**(event.metadata_json or {}), **data["metadata"]}
        else:
            # Create new incident
            evt_type = (data.get("event_type") or "MULTIPLE_PERSON").upper()
            default_sev = "CRITICAL" if evt_type == "TAB_SWITCH" else ("HIGH" if evt_type in ["MULTIPLE_PERSON", "MOBILE_PHONE"] else "MEDIUM")
            sev = data.get("severity") or default_sev
            status = data.get("status") or "ACTIVE"

            started_at = datetime.utcnow()
            if data.get("started_at"):
                try:
                    parsed = datetime.fromisoformat(data["started_at"].replace("Z", "+00:00"))
                    started_at = parsed.replace(tzinfo=None)
                except Exception:
                    pass

            event = InterviewIntegrityEvent(
                session_id=session_id,
                candidate_id=cand_id,
                event_type=evt_type,
                severity=sev,
                status=status,
                started_at=started_at,
                duration_seconds=float(data.get("duration_seconds") or 0.0),
                confidence=float(data.get("confidence") or 1.0),
                metadata_json=data.get("metadata") or {}
            )
            db.add(event)

        await db.flush()

        # Recalculate summary and update session
        summary = await self.get_session_integrity_summary(db, session_id)
        await db.commit()
        await db.refresh(event)

        return event, summary

    async def terminate_session(
        self,
        db: AsyncSession,
        session_id: str,
        candidate_id: Optional[str],
        reason: str = "TAB_SWITCH",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Automatically terminates an interview session due to an integrity violation."""
        stmt_sess = select(InterviewSession).where(InterviewSession.id == session_id)
        res_sess = await db.execute(stmt_sess)
        session = res_sess.scalar_one_or_none()

        if not session:
            raise ValueError(f"Interview session {session_id} not found.")

        cand_id = candidate_id or session.candidate_id
        now = datetime.utcnow()

        session.status = "TERMINATED"
        session.fsm_state = "TERMINATED"
        session.integrity_status = "TERMINATED"
        session.termination_reason = reason
        session.terminated_at = now
        session.ended_at = now

        # Record termination integrity incident
        term_event = InterviewIntegrityEvent(
            session_id=session_id,
            candidate_id=cand_id,
            event_type="TAB_SWITCH" if "TAB" in reason.upper() else "TERMINATION",
            severity="CRITICAL",
            status="TERMINATED",
            started_at=now,
            ended_at=now,
            duration_seconds=0.0,
            confidence=1.0,
            metadata_json=metadata or {"reason": reason, "enforced_policy": "automatic_tab_switch_termination"}
        )
        db.add(term_event)
        await db.flush()

        summary = await self.get_session_integrity_summary(db, session_id)
        await db.commit()

        logger.warning(
            "Session %s automatically TERMINATED for candidate %s. Reason: %s",
            session_id, cand_id, reason
        )
        return summary

integrity_service = IntegrityService()
