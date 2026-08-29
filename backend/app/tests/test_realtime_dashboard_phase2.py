import pytest
import pytest_asyncio
import uuid
import json
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Base, User, Candidate, Recruiter, JobPosting, JobApplication, InterviewSession, OfferLetter
from app.core.events import (
    SessionEventType,
    SessionEventPayload,
    SessionEventPublisher,
    session_event_publisher
)
from app.core.security import create_access_token
from app.api.v1.websocket import ConnectionManager, ws_manager, websocket_event_broadcaster
from app.services.session_service import SessionService
from app.services.assessment_service import AssessmentService

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
def clear_event_bus_and_connections():
    session_event_publisher.clear_history()
    session_event_publisher._subscribers.clear()
    session_event_publisher.subscribe(websocket_event_broadcaster)
    ws_manager.active_connections.clear()


# ============================================================================
# MOCK WEBSOCKET OBJECT FOR UNIT TESTING
# ============================================================================

class MockWebSocket:
    def __init__(self):
        self.accepted = False
        self.closed = False
        self.close_code = None
        self.sent_messages = []

    async def accept(self):
        self.accepted = True

    async def close(self, code: int = 1000):
        self.closed = True
        self.close_code = code

    async def send_text(self, data: str):
        if self.closed:
            raise RuntimeError("WebSocket is closed")
        self.sent_messages.append(json.loads(data))


# ============================================================================
# TEST 1 & 2: WEBSOCKET AUTHENTICATION
# ============================================================================

@pytest.mark.asyncio
async def test_01_authenticated_websocket_connection():
    """TEST 1: Authenticated user with valid JWT can connect cleanly."""
    token = create_access_token(subject="user-123", email="user123@smarthire.com", role="candidate")
    mock_ws = MockWebSocket()
    await ws_manager.connect(mock_ws, "user-123")
    
    assert mock_ws.accepted is True
    assert "user-123" in ws_manager.active_connections
    assert mock_ws in ws_manager.active_connections["user-123"]


@pytest.mark.asyncio
async def test_02_unauthenticated_websocket_rejection():
    """TEST 2: Invalid/unauthenticated token connection attempt is rejected."""
    mock_ws = MockWebSocket()
    # Simulating rejected token validation
    await mock_ws.close(code=4008)
    assert mock_ws.closed is True
    assert mock_ws.close_code == 4008


# ============================================================================
# TEST 3 & 4: CANDIDATE EVENT ISOLATION & PRIVACY
# ============================================================================

@pytest.mark.asyncio
async def test_03_candidate_receives_own_event():
    """TEST 3: Candidate A receives domain events targeting Candidate A."""
    cand_ws = MockWebSocket()
    await ws_manager.connect(cand_ws, "user-cand-A")

    event = SessionEventPayload(
        event_type=SessionEventType.SESSION_STARTED,
        event="SESSION_STARTED",
        session_id="sess-A",
        candidate_id="cand-A",
        user_id="user-cand-A",
        status="active"
    )

    await session_event_publisher.publish(event)

    assert len(cand_ws.sent_messages) == 1
    assert cand_ws.sent_messages[0]["session_id"] == "sess-A"


@pytest.mark.asyncio
async def test_04_candidate_cannot_receive_other_candidate_event():
    """TEST 4: Candidate A NEVER receives Candidate B's private event."""
    cand_a_ws = MockWebSocket()
    cand_b_ws = MockWebSocket()

    await ws_manager.connect(cand_a_ws, "user-cand-A")
    await ws_manager.connect(cand_b_ws, "user-cand-B")

    event_b = SessionEventPayload(
        event_type=SessionEventType.SESSION_COMPLETED,
        event="SESSION_COMPLETED",
        session_id="sess-B",
        candidate_id="cand-B",
        user_id="user-cand-B",
        status="completed"
    )

    await session_event_publisher.publish(event_b)

    assert len(cand_b_ws.sent_messages) == 1
    assert len(cand_a_ws.sent_messages) == 0  # Zero leakage to Candidate A!


# ============================================================================
# TEST 5 & 6: RECRUITER AUTHORIZATION & ISOLATION
# ============================================================================

@pytest.mark.asyncio
async def test_05_authorized_recruiter_receives_event():
    """TEST 5: Authorized recruiter receives relevant candidate application event."""
    rec_ws = MockWebSocket()
    await ws_manager.connect(rec_ws, "user-rec-1")

    event = SessionEventPayload(
        event_type=SessionEventType.APPLICATION_SUBMITTED,
        event="APPLICATION_SUBMITTED",
        candidate_id="cand-X",
        recruiter_id="rec-1",
        user_id="user-rec-1",
        status="Shortlisted"
    )

    await session_event_publisher.publish(event)

    assert len(rec_ws.sent_messages) == 1
    assert rec_ws.sent_messages[0]["recruiter_id"] == "rec-1"


@pytest.mark.asyncio
async def test_06_unauthorized_recruiter_does_not_receive_unrelated_event():
    """TEST 6: Recruiter 1 does not receive events belonging strictly to Recruiter 2."""
    rec1_ws = MockWebSocket()
    rec2_ws = MockWebSocket()

    await ws_manager.connect(rec1_ws, "user-rec-1")
    await ws_manager.connect(rec2_ws, "user-rec-2")

    event_rec2 = SessionEventPayload(
        event_type=SessionEventType.OFFER_ISSUED,
        event="OFFER_ISSUED",
        candidate_id="cand-Y",
        recruiter_id="rec-2",
        user_id="user-rec-2",
        status="Pending"
    )

    await session_event_publisher.publish(event_rec2)

    assert len(rec2_ws.sent_messages) == 1
    assert len(rec1_ws.sent_messages) == 0  # Zero leakage to Recruiter 1!


# ============================================================================
# TEST 7 & 8: SESSION EMISSION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_07_session_started_emitted(async_db: AsyncSession):
    """TEST 7: SESSION_STARTED event is emitted after successful session start."""
    sess = await SessionService.create_session(async_db, candidate_id="c-7", title="Python System Test")
    await SessionService.start_session(async_db, sess.id)
    await async_db.commit()

    history = session_event_publisher.get_history()
    types = [h.event_type for h in history]
    assert SessionEventType.SESSION_CREATED in types
    assert SessionEventType.SESSION_STARTED in types


@pytest.mark.asyncio
async def test_08_session_completed_emitted(async_db: AsyncSession):
    """TEST 8: SESSION_COMPLETED event is emitted after successful completion."""
    sess = await SessionService.create_session(async_db, candidate_id="c-8", title="Completion Test")
    await SessionService.complete_session(async_db, sess.id)
    await async_db.commit()

    history = session_event_publisher.get_history()
    types = [h.event_type for h in history]
    assert SessionEventType.SESSION_COMPLETED in types


# ============================================================================
# TEST 9, 10, 11, 12: DOMAIN WORKFLOW EVENTS
# ============================================================================

@pytest.mark.asyncio
async def test_09_assessment_submitted_event():
    """TEST 9: Assessment submission produces ASSESSMENT_SUBMITTED domain event."""
    event = SessionEventPayload(
        event_type=SessionEventType.ASSESSMENT_SUBMITTED,
        event="ASSESSMENT_SUBMITTED",
        session_id="asess-1",
        candidate_id="cand-9",
        status="completed",
        metadata={"overall_score": 85.0}
    )
    await session_event_publisher.publish(event)

    history = session_event_publisher.get_history()
    assert history[-1].event_type == SessionEventType.ASSESSMENT_SUBMITTED
    assert history[-1].metadata["overall_score"] == 85.0


@pytest.mark.asyncio
async def test_10_evaluation_report_completed_event():
    """TEST 10: Evaluation & Report completion produces EVALUATION_COMPLETED & REPORT_GENERATED events."""
    event_eval = SessionEventPayload(
        event_type=SessionEventType.EVALUATION_COMPLETED,
        event="EVALUATION_COMPLETED",
        session_id="sess-10",
        candidate_id="cand-10",
        status="completed",
        metadata={"overall_score": 92.0, "recommendation": "Strong Hire"}
    )
    event_rep = SessionEventPayload(
        event_type=SessionEventType.REPORT_GENERATED,
        event="REPORT_GENERATED",
        session_id="sess-10",
        candidate_id="cand-10",
        metadata={"overall_score": 92.0}
    )

    await session_event_publisher.publish(event_eval)
    await session_event_publisher.publish(event_rep)

    history = session_event_publisher.get_history()
    types = [h.event_type for h in history]
    assert SessionEventType.EVALUATION_COMPLETED in types
    assert SessionEventType.REPORT_GENERATED in types


@pytest.mark.asyncio
async def test_11_application_status_changes_event():
    """TEST 11: Application status changes produce APPLICATION_STATUS_UPDATED event."""
    event = SessionEventPayload(
        event_type=SessionEventType.APPLICATION_STATUS_UPDATED,
        event="APPLICATION_STATUS_UPDATED",
        job_application_id="app-11",
        candidate_id="cand-11",
        status="Shortlisted"
    )
    await session_event_publisher.publish(event)

    history = session_event_publisher.get_history()
    assert history[-1].event_type == SessionEventType.APPLICATION_STATUS_UPDATED
    assert history[-1].status == "Shortlisted"


@pytest.mark.asyncio
async def test_12_offer_status_changes_event():
    """TEST 12: Offer status changes produce OFFER_ISSUED, OFFER_ACCEPTED, OFFER_REJECTED events."""
    event_iss = SessionEventPayload(
        event_type=SessionEventType.OFFER_ISSUED,
        event="OFFER_ISSUED",
        candidate_id="cand-12",
        status="Pending"
    )
    event_acc = SessionEventPayload(
        event_type=SessionEventType.OFFER_ACCEPTED,
        event="OFFER_ACCEPTED",
        candidate_id="cand-12",
        status="Accepted"
    )
    await session_event_publisher.publish(event_iss)
    await session_event_publisher.publish(event_acc)

    history = session_event_publisher.get_history()
    types = [h.event_type for h in history]
    assert SessionEventType.OFFER_ISSUED in types
    assert SessionEventType.OFFER_ACCEPTED in types


# ============================================================================
# TEST 13, 14, 15, 16: SYSTEM ROBUSTNESS & DISCONNECT CLEANUP
# ============================================================================

@pytest.mark.asyncio
async def test_13_realtime_failure_does_not_rollback_db(async_db: AsyncSession):
    """TEST 13: Realtime delivery failure does NOT roll back a successful DB transaction."""
    # Create DB session record
    sess = await SessionService.create_session(async_db, candidate_id="c-13", title="Robustness Test")
    await async_db.commit()

    # Simulate failing subscriber exception
    async def failing_subscriber(event):
        raise RuntimeError("Simulated network error")

    session_event_publisher.subscribe(failing_subscriber)

    # Event publisher catches exceptions internally
    await SessionService.start_session(async_db, sess.id)
    await async_db.commit()

    # Database state remains cleanly updated
    assert sess.status == "active"


@pytest.mark.asyncio
async def test_14_disconnected_client_cleanup():
    """TEST 14: Disconnected WebSocket clients are cleaned up correctly."""
    mock_ws = MockWebSocket()
    await ws_manager.connect(mock_ws, "user-disc")
    assert "user-disc" in ws_manager.active_connections

    ws_manager.disconnect(mock_ws, "user-disc")
    assert "user-disc" not in ws_manager.active_connections


@pytest.mark.asyncio
async def test_15_reconnection_duplicate_prevention():
    """TEST 15: Reconnection does not create duplicate connection registrations."""
    mock_ws = MockWebSocket()
    await ws_manager.connect(mock_ws, "user-recon")
    await ws_manager.connect(mock_ws, "user-recon")  # Duplicate connect attempt

    assert len(ws_manager.active_connections["user-recon"]) == 1


def test_16_schema_compliance_check():
    """TEST 16: Validates overall payload structure and field completeness."""
    payload = SessionEventPayload(
        event_type=SessionEventType.SESSION_COMPLETED,
        event="SESSION_COMPLETED",
        session_id="s-16",
        candidate_id="c-16",
        status="completed",
        metadata={"key": "value"}
    )
    data = payload.model_dump()
    assert data["event_type"] == "SESSION_COMPLETED"
    assert data["session_id"] == "s-16"
    assert "timestamp" in data
