import pytest
import pytest_asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Base, Candidate, Recruiter, InterviewSession
from app.core.events import (
    SessionEventType,
    SessionEventPayload,
    SessionEventPublisher,
    session_event_publisher
)
from app.services.session_service import SessionService

# Use an in-memory SQLite DB for fast async unit tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_db():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture(autouse=True)
def clear_event_bus():
    """Ensure event bus history and subscribers are cleared before each test."""
    session_event_publisher.clear_history()
    session_event_publisher._subscribers.clear()


# ============================================================================
# 1. PAYLOAD STRUCTURE & SCHEMA VALIDATION TESTS
# ============================================================================

def test_session_event_payload_structure():
    """Validates that SessionEventPayload adheres strictly to required Phase 1 schema."""
    payload = SessionEventPayload(
        event_type=SessionEventType.SESSION_CREATED,
        session_id="sess-123",
        candidate_id="cand-456",
        interview_id="sched-789",
        recruiter_id="rec-001",
        job_application_id="app-111",
        job_id="job-222",
        status="created",
        metadata={"title": "Backend Engineering Interview", "difficulty": "Hard"}
    )

    data = payload.model_dump() if hasattr(payload, 'model_dump') else payload.dict()

    assert data["event_type"] == "SESSION_CREATED"
    assert data["session_id"] == "sess-123"
    assert data["candidate_id"] == "cand-456"
    assert data["interview_id"] == "sched-789"
    assert data["recruiter_id"] == "rec-001"
    assert data["job_application_id"] == "app-111"
    assert data["job_id"] == "job-222"
    assert data["status"] == "created"
    assert "timestamp" in data
    assert data["metadata"]["title"] == "Backend Engineering Interview"
    assert data["metadata"]["difficulty"] == "Hard"


# ============================================================================
# 2. DECOUPLED SUBSCRIBER BOUNDARY TEST
# ============================================================================

@pytest.mark.asyncio
async def test_decoupled_event_subscriber_boundary():
    """Verifies that Phase 2 subscribers can register and receive domain events cleanly."""
    received_events = []

    async def mock_phase2_websocket_listener(event: SessionEventPayload):
        received_events.append(event)

    session_event_publisher.subscribe(mock_phase2_websocket_listener)

    payload = SessionEventPayload(
        event_type=SessionEventType.SESSION_STARTED,
        session_id="sess-001",
        candidate_id="cand-001",
        status="active"
    )

    await session_event_publisher.publish(payload)

    assert len(received_events) == 1
    assert received_events[0].event_type == SessionEventType.SESSION_STARTED
    assert received_events[0].session_id == "sess-001"


# ============================================================================
# 3. ALL 7 SESSION STATE TRANSITION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_all_seven_session_state_transitions(async_db: AsyncSession):
    """
    Executes and verifies every single one of the 7 session state transitions:
    - SESSION_CREATED
    - SESSION_STARTED
    - SESSION_PAUSED
    - SESSION_RESUMED
    - SESSION_COMPLETED
    - SESSION_CANCELLED
    - SESSION_EXPIRED
    """

    # 1. SESSION_CREATED
    session = await SessionService.create_session(
        async_db,
        candidate_id="cand-test-1",
        title="Full Stack Architecture Interview",
        role_target="Senior Full Stack Engineer",
        round_type="System Design",
        recruiter_id="rec-test-1",
        job_application_id="app-test-1",
        job_id="job-test-1"
    )
    await async_db.commit()

    assert session.status == "created"
    history = session_event_publisher.get_history()
    assert len(history) == 1
    assert history[0].event_type == SessionEventType.SESSION_CREATED
    assert history[0].session_id == session.id
    assert history[0].candidate_id == "cand-test-1"
    assert history[0].recruiter_id == "rec-test-1"
    assert history[0].job_application_id == "app-test-1"

    # 2. SESSION_STARTED
    session = await SessionService.start_session(async_db, session.id)
    await async_db.commit()

    assert session.status == "active"
    history = session_event_publisher.get_history()
    assert len(history) == 2
    assert history[1].event_type == SessionEventType.SESSION_STARTED
    assert history[1].status == "active"

    # 3. SESSION_PAUSED
    session = await SessionService.pause_session(async_db, session.id, reason="Network break")
    await async_db.commit()

    assert session.status == "paused"
    history = session_event_publisher.get_history()
    assert len(history) == 3
    assert history[2].event_type == SessionEventType.SESSION_PAUSED
    assert history[2].metadata["pause_reason"] == "Network break"

    # 4. SESSION_RESUMED
    session = await SessionService.resume_session(async_db, session.id)
    await async_db.commit()

    assert session.status == "active"
    history = session_event_publisher.get_history()
    assert len(history) == 4
    assert history[3].event_type == SessionEventType.SESSION_RESUMED

    # 5. SESSION_COMPLETED
    session = await SessionService.complete_session(async_db, session.id, reason="Candidate finished all questions")
    await async_db.commit()

    assert session.status == "completed"
    history = session_event_publisher.get_history()
    assert len(history) == 5
    assert history[4].event_type == SessionEventType.SESSION_COMPLETED
    assert history[4].metadata["completion_reason"] == "Candidate finished all questions"

    # 6. SESSION_CANCELLED (on a second session)
    sess2 = await SessionService.create_session(
        async_db,
        candidate_id="cand-test-2",
        title="Cancelled Mock Interview"
    )
    sess2 = await SessionService.cancel_session(async_db, sess2.id, reason="Candidate withdrew")
    await async_db.commit()

    assert sess2.status == "cancelled"
    history = session_event_publisher.get_history()
    assert history[-1].event_type == SessionEventType.SESSION_CANCELLED
    assert history[-1].metadata["cancellation_reason"] == "Candidate withdrew"

    # 7. SESSION_EXPIRED (on a third session)
    sess3 = await SessionService.create_session(
        async_db,
        candidate_id="cand-test-3",
        title="Expired Mock Interview"
    )
    sess3 = await SessionService.expire_session(async_db, sess3.id, reason="Inactivity timeout")
    await async_db.commit()

    assert sess3.status == "expired"
    history = session_event_publisher.get_history()
    assert history[-1].event_type == SessionEventType.SESSION_EXPIRED
    assert history[-1].metadata["expiration_reason"] == "Inactivity timeout"


# ============================================================================
# 4. AUTHORIZATION METADATA BOUNDARY TEST
# ============================================================================

@pytest.mark.asyncio
async def test_authorization_metadata_boundary(async_db: AsyncSession):
    """Verifies that all privacy & authorization routing IDs are attached to events."""
    session = await SessionService.create_session(
        async_db,
        candidate_id="cand-auth-999",
        title="Secure Candidate Session",
        recruiter_id="rec-auth-888",
        job_application_id="app-auth-777",
        job_id="job-auth-666"
    )

    history = session_event_publisher.get_history()
    event = history[0]

    assert event.candidate_id == "cand-auth-999"
    assert event.recruiter_id == "rec-auth-888"
    assert event.job_application_id == "app-auth-777"
    assert event.job_id == "job-auth-666"
    # Ensure raw internal ORM models are not present inside metadata
    for key, val in event.metadata.items():
        assert not isinstance(val, Base)
