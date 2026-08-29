import asyncio
import logging
from enum import Enum
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Awaitable
from pydantic import BaseModel, Field

logger = logging.getLogger("smarthire.events")


class SessionEventType(str, Enum):
    # Session Events
    SESSION_CREATED = "SESSION_CREATED"
    SESSION_STARTED = "SESSION_STARTED"
    SESSION_PAUSED = "SESSION_PAUSED"
    SESSION_RESUMED = "SESSION_RESUMED"
    SESSION_COMPLETED = "SESSION_COMPLETED"
    SESSION_CANCELLED = "SESSION_CANCELLED"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    # Assessment Events
    ASSESSMENT_STARTED = "ASSESSMENT_STARTED"
    ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED"
    ASSESSMENT_COMPLETED = "ASSESSMENT_COMPLETED"

    # Evaluation & Score Events
    EVALUATION_STARTED = "EVALUATION_STARTED"
    EVALUATION_COMPLETED = "EVALUATION_COMPLETED"
    EVALUATION_FAILED = "EVALUATION_FAILED"
    SCORE_UPDATED = "SCORE_UPDATED"

    # Report Events
    REPORT_GENERATED = "REPORT_GENERATED"
    REPORT_UPDATED = "REPORT_UPDATED"

    # Application Events
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"
    APPLICATION_STATUS_UPDATED = "APPLICATION_STATUS_UPDATED"
    ATS_EVALUATION_UPDATED = "ATS_EVALUATION_UPDATED"

    # Interview Scheduling Events
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    INTERVIEW_STARTED = "INTERVIEW_STARTED"
    INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED"

    # Offer Events
    OFFER_ISSUED = "OFFER_ISSUED"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    OFFER_REJECTED = "OFFER_REJECTED"

    # Notification Events
    NOTIFICATION_CREATED = "NOTIFICATION_CREATED"

    # Recording Events
    RECORDING_AVAILABLE = "RECORDING_AVAILABLE"

    # Transcription Events
    TRANSCRIPTION_STARTED = "TRANSCRIPTION_STARTED"
    TRANSCRIPTION_COMPLETED = "TRANSCRIPTION_COMPLETED"
    TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED"

    # Vision Analysis Events
    VISION_ANALYSIS_STARTED = "VISION_ANALYSIS_STARTED"
    VISION_ANALYSIS_COMPLETED = "VISION_ANALYSIS_COMPLETED"
    VISION_ANALYSIS_FAILED = "VISION_ANALYSIS_FAILED"


class SessionEventPayload(BaseModel):
    """
    Standardized domain event structure for SmartHire Phase 1 & Phase 2 state updates.
    Decoupled from transport mechanics (WebSockets/Redis) and raw DB ORM models.
    Contains explicit authorization routing metadata (candidate_id, recruiter_id, user_id).
    """
    event_type: str
    event: Optional[str] = None
    session_id: Optional[str] = None
    candidate_id: Optional[str] = None
    interview_id: Optional[str] = None
    recruiter_id: Optional[str] = None
    job_application_id: Optional[str] = None
    job_id: Optional[str] = None
    user_id: Optional[str] = None
    entity: Optional[str] = None
    entity_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    status: Optional[str] = "active"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    data: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True

    def model_post_init(self, __context: Any) -> None:
        """Ensure both `event` and `event_type` fields are synchronized."""
        if not self.event:
            self.event = str(self.event_type)
        if not self.event_type:
            self.event_type = str(self.event)
        if not self.data and self.metadata:
            self.data = self.metadata
        elif not self.metadata and self.data:
            self.metadata = self.data


class SessionEventPublisher:
    """
    In-memory domain event publisher & bus for system lifecycle state changes.
    Enables a clean service/event boundary so Phase 2 can register WebSocket
    subscribers without modifying core business logic or DB models.
    """
    def __init__(self):
        self._subscribers: List[Callable[[SessionEventPayload], Awaitable[None]]] = []
        self._history: List[SessionEventPayload] = []

    def subscribe(self, handler: Callable[[SessionEventPayload], Awaitable[None]]):
        """Register an async event listener."""
        if handler not in self._subscribers:
            self._subscribers.append(handler)
            logger.info("Registered event subscriber: %s", getattr(handler, '__name__', str(handler)))

    def unsubscribe(self, handler: Callable[[SessionEventPayload], Awaitable[None]]):
        """Unregister an async event listener."""
        if handler in self._subscribers:
            self._subscribers.remove(handler)

    async def publish(self, event: SessionEventPayload):
        """Publish a domain event to all registered subscribers."""
        self._history.append(event)
        logger.info(
            "[EVENT EMITTED] Type: %s | Session: %s | Candidate: %s | Recruiter: %s | Status: %s",
            event.event_type, event.session_id, event.candidate_id, event.recruiter_id, event.status
        )
        for subscriber in list(self._subscribers):
            try:
                res = subscriber(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.error("Error in event subscriber %s: %s", subscriber, str(e), exc_info=True)

    def get_history(self) -> List[SessionEventPayload]:
        """Retrieve emitted event history for testing, logging, and auditing."""
        return list(self._history)

    def clear_history(self):
        """Clear recorded event history."""
        self._history.clear()


# Global singleton instance for event publishing
session_event_publisher = SessionEventPublisher()
