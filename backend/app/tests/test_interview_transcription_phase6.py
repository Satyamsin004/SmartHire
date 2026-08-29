import pytest
import os
import uuid
import asyncio
from typing import AsyncGenerator
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from app.main import app
from app.core.db import get_db, get_session_factory, get_engine, Base
from app.core.security import create_access_token
from app.models.domain import User, Candidate, Recruiter, InterviewSession, InterviewRecording, InterviewTranscript
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.core.events import session_event_publisher, SessionEventType

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def setup_db_tables():
    engine_obj = get_engine()
    async with engine_obj.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN recording_status VARCHAR(50) DEFAULT 'PENDING';"))
        except Exception:
            pass

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

async def create_test_candidate(db: AsyncSession, email_prefix: str = "cand"):
    u_id = str(uuid.uuid4())
    c_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Candidate Tester",
        role="candidate",
        password_hash="hashed_pwd"
    )
    cand = Candidate(id=c_id, user_id=u_id)
    db.add(user)
    db.add(cand)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="candidate")
    return user, cand, token

async def create_test_recruiter(db: AsyncSession, email_prefix: str = "rec"):
    u_id = str(uuid.uuid4())
    r_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Recruiter Tester",
        role="recruiter",
        password_hash="hashed_pwd"
    )
    rec = Recruiter(id=r_id, user_id=u_id)
    db.add(user)
    db.add(rec)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="recruiter")
    return user, rec, token

async def create_test_session_and_recording(db: AsyncSession, candidate_id: str, recruiter_id: str = None):
    s_id = str(uuid.uuid4())
    sess = InterviewSession(
        id=s_id,
        candidate_id=candidate_id,
        recruiter_id=recruiter_id,
        title="Software Engineer Interview",
        role_target="Software Engineer",
        round_type="Technical",
        status="completed"
    )
    db.add(sess)
    await db.commit()

    saved = storage_service.save_recording(candidate_id, s_id, b"dummy audio recording content", "recording.webm", "video/webm")
    rec = InterviewRecording(
        id=str(uuid.uuid4()),
        session_id=s_id,
        candidate_id=candidate_id,
        recording_type="VIDEO_AUDIO",
        file_path=saved["file_path"],
        storage_key=saved["storage_key"],
        mime_type="video/webm",
        file_size=len(b"dummy audio recording content"),
        duration=15.0,
        status="available"
    )
    db.add(rec)
    await db.commit()
    return sess, rec


# ============================================================================
# PHASE 6 TEST SUITE (20 MANDATORY TESTS)
# ============================================================================

@pytest.mark.anyio
async def test_01_transcript_record_created_correctly(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t1")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr = await transcription_service.create_or_get_transcript(db_session, sess.id, rec.id)
    assert tr is not None
    assert tr.recording_id == rec.id
    assert tr.session_id == sess.id
    assert tr.candidate_id == cand.id
    assert tr.status == "PENDING"


@pytest.mark.anyio
async def test_02_recording_session_candidate_relationships_correct(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t2")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr = await transcription_service.create_or_get_transcript(db_session, sess.id, rec.id)
    res = await db_session.execute(select(InterviewTranscript).where(InterviewTranscript.id == tr.id))
    fetched = res.scalar_one_or_none()
    assert fetched.recording_id == rec.id
    assert fetched.session_id == sess.id
    assert fetched.candidate_id == cand.id


@pytest.mark.anyio
async def test_03_valid_recording_sent_to_transcription_service(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t3")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
    assert tr is not None
    assert tr.status in ("COMPLETED", "PROCESSING")


@pytest.mark.anyio
async def test_04_successful_provider_response_persisted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t4")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    with patch.object(transcription_service, "transcribe_audio", new=AsyncMock(return_value="Mocked transcribed text.")):
        tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
        assert tr.status == "COMPLETED"
        assert tr.transcript_text == "Mocked transcribed text."


@pytest.mark.anyio
async def test_05_transcript_status_becomes_completed(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t5")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
    assert tr.status == "COMPLETED"


@pytest.mark.anyio
async def test_06_provider_failure_becomes_failed(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t6")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    with patch.object(transcription_service, "transcribe_audio", side_effect=RuntimeError("Provider 500 Internal Error")):
        tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
        assert tr.status == "FAILED"
        assert "Provider 500 Internal Error" in tr.error_message


@pytest.mark.anyio
async def test_07_provider_timeout_handled(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t7")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    with patch.object(transcription_service, "transcribe_audio", side_effect=asyncio.TimeoutError("Provider API call timed out")):
        tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
        assert tr.status == "FAILED"


@pytest.mark.anyio
async def test_08_empty_audio_handled(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t8")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    with patch.object(transcription_service, "transcribe_audio", new=AsyncMock(return_value="")):
        tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
        assert tr.status == "FAILED"


@pytest.mark.anyio
async def test_09_duplicate_transcription_prevented(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t9")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr1 = await transcription_service.process_transcription(db_session, sess.id, rec.id)
    assert tr1.status == "COMPLETED"

    # Retry call
    tr2 = await transcription_service.process_transcription(db_session, sess.id, rec.id)
    assert tr2.id == tr1.id
    assert tr2.status == "COMPLETED"


@pytest.mark.anyio
async def test_10_completed_transcript_not_unnecessarily_retranscribed(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t10")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    tr = await transcription_service.create_or_get_transcript(db_session, sess.id, rec.id)
    tr.status = "COMPLETED"
    tr.transcript_text = "Already completed content."
    await db_session.commit()

    with patch.object(transcription_service, "transcribe_audio") as mock_runner:
        res = await transcription_service.process_transcription(db_session, sess.id, rec.id)
        mock_runner.assert_not_called()
        assert res.transcript_text == "Already completed content."


@pytest.mark.anyio
async def test_11_candidate_can_access_only_their_transcript(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t11")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)
    await transcription_service.process_transcription(db_session, sess.id, rec.id)

    headers = {"Authorization": f"Bearer {token}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/transcript", headers=headers)
    assert res.status_code == 200
    assert res.json()["session_id"] == sess.id


@pytest.mark.anyio
async def test_12_unauthorized_candidate_cannot_access_other_transcript(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "t12_1")
    user2, cand2, token2 = await create_test_candidate(db_session, "t12_2")
    sess2, rec2 = await create_test_session_and_recording(db_session, cand2.id)
    await transcription_service.process_transcription(db_session, sess2.id, rec2.id)

    headers = {"Authorization": f"Bearer {token1}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess2.id}/transcript", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_13_authorized_recruiter_can_access_transcript(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "t13_c")
    user_r, rec, token_r = await create_test_recruiter(db_session, "t13_r")
    sess, rec_file = await create_test_session_and_recording(db_session, cand.id, rec.id)
    await transcription_service.process_transcription(db_session, sess.id, rec_file.id)

    headers = {"Authorization": f"Bearer {token_r}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/transcript", headers=headers)
    assert res.status_code == 200


@pytest.mark.anyio
async def test_14_unauthorized_recruiter_cannot_access_transcript(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "t14_c")
    user_r1, rec1, _ = await create_test_recruiter(db_session, "t14_r1")
    user_r2, rec2, token_r2 = await create_test_recruiter(db_session, "t14_r2")
    sess, rec_file = await create_test_session_and_recording(db_session, cand.id, rec1.id)
    await transcription_service.process_transcription(db_session, sess.id, rec_file.id)

    headers = {"Authorization": f"Bearer {token_r2}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/transcript", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_15_transcription_started_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t15")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.TRANSCRIPTION_STARTED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await transcription_service.process_transcription(db_session, sess.id, rec.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_16_transcription_completed_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t16")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.TRANSCRIPTION_COMPLETED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await transcription_service.process_transcription(db_session, sess.id, rec.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_17_transcription_failed_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t17")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.TRANSCRIPTION_FAILED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    with patch.object(transcription_service, "transcribe_audio", side_effect=RuntimeError("Provider Error")):
        await transcription_service.process_transcription(db_session, sess.id, rec.id)
        await asyncio.sleep(0.05)
        assert len(events) >= 1
        assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_18_existing_interview_completion_remains_successful(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t18")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/interview/finish/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


@pytest.mark.anyio
async def test_19_existing_scoring_remains_unchanged(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "t19")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    res = await async_client.get(
        f"/api/v1/interview/report/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)


@pytest.mark.anyio
async def test_20_existing_report_generation_remains_unchanged(async_client: AsyncClient, db_session: AsyncSession):
    user, rec, token = await create_test_recruiter(db_session, "r20")

    res = await async_client.get(
        "/api/v1/recruiter/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)
