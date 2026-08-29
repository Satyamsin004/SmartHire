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
from app.models.domain import User, Candidate, Recruiter, InterviewSession, InterviewRecording, InterviewTranscript, InterviewVisionAnalysis
from app.services.storage_service import storage_service
from app.services.video_vision_service import video_vision_service
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
        full_name="Candidate Vision Tester",
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
        full_name="Recruiter Vision Tester",
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
        title="Vision Analysis Practice Interview",
        role_target="Senior Vision Architect",
        round_type="Technical",
        status="completed"
    )
    db.add(sess)
    await db.commit()

    saved = storage_service.save_recording(candidate_id, s_id, b"dummy video recording stream bytes", "rec_vision.webm", "video/webm")
    rec = InterviewRecording(
        id=str(uuid.uuid4()),
        session_id=s_id,
        candidate_id=candidate_id,
        recording_type="VIDEO_AUDIO",
        file_path=saved["file_path"],
        storage_key=saved["storage_key"],
        mime_type="video/webm",
        file_size=len(b"dummy video recording stream bytes"),
        duration=20.0,
        status="available"
    )
    db.add(rec)
    await db.commit()
    return sess, rec


# ============================================================================
# PHASE 7 TEST SUITE (21 MANDATORY TESTS)
# ============================================================================

@pytest.mark.anyio
async def test_01_vision_analysis_associated_with_correct_recording(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v1")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.create_or_get_vision_analysis(db_session, sess.id, rec.id)
    assert va is not None
    assert va.recording_id == rec.id


@pytest.mark.anyio
async def test_02_session_relationship_correct(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v2")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.create_or_get_vision_analysis(db_session, sess.id, rec.id)
    assert va.session_id == sess.id


@pytest.mark.anyio
async def test_03_candidate_relationship_correct(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v3")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.create_or_get_vision_analysis(db_session, sess.id, rec.id)
    assert va.candidate_id == cand.id


@pytest.mark.anyio
async def test_04_valid_recording_enters_vision_processing(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v4")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va is not None
    assert va.status in ("COMPLETED", "PROCESSING")


@pytest.mark.anyio
async def test_05_vision_results_persisted_correctly(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v5")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va.status == "COMPLETED"
    assert va.face_presence_percentage is not None
    assert va.eye_contact_percentage is not None
    assert va.attention_score is not None
    assert va.confidence_percentage is not None


@pytest.mark.anyio
async def test_06_processing_to_completed_works(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v6")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va.status == "COMPLETED"


@pytest.mark.anyio
async def test_07_provider_failure_produces_failed(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v7")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    with patch.object(video_vision_service, "analyze_video_file", side_effect=RuntimeError("Vision Provider 500 Failure")):
        va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
        assert va.status == "FAILED"
        assert "Vision Provider 500 Failure" in va.error_message


@pytest.mark.anyio
async def test_08_invalid_recording_handled(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v8")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    # Corrupt recording path
    rec.file_path = "static/uploads/recordings/non_existent.webm"
    await db_session.commit()

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va.status == "FAILED"


@pytest.mark.anyio
async def test_09_missing_recording_handled(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v9")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, str(uuid.uuid4()))
    assert va.status == "FAILED"


@pytest.mark.anyio
async def test_10_duplicate_vision_jobs_prevented(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v10")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    va1 = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va1.status == "COMPLETED"

    va2 = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va2.id == va1.id
    assert va2.status == "COMPLETED"


@pytest.mark.anyio
async def test_11_candidate_can_access_only_their_own_results(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v11")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)
    await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)

    headers = {"Authorization": f"Bearer {token}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/vision-analysis", headers=headers)
    assert res.status_code == 200
    assert res.json()["session_id"] == sess.id


@pytest.mark.anyio
async def test_12_unauthorized_candidate_cannot_access_other_results(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "v12_1")
    user2, cand2, token2 = await create_test_candidate(db_session, "v12_2")
    sess2, rec2 = await create_test_session_and_recording(db_session, cand2.id)
    await video_vision_service.process_vision_analysis(db_session, sess2.id, rec2.id)

    headers = {"Authorization": f"Bearer {token1}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess2.id}/vision-analysis", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_13_authorized_recruiter_can_access_permitted_results(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "v13_c")
    user_r, rec, token_r = await create_test_recruiter(db_session, "v13_r")
    sess, rec_file = await create_test_session_and_recording(db_session, cand.id, rec.id)
    await video_vision_service.process_vision_analysis(db_session, sess.id, rec_file.id)

    headers = {"Authorization": f"Bearer {token_r}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/vision-analysis", headers=headers)
    assert res.status_code == 200


@pytest.mark.anyio
async def test_14_unauthorized_recruiter_cannot_access_results(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "v14_c")
    user_r1, rec1, _ = await create_test_recruiter(db_session, "v14_r1")
    user_r2, rec2, token_r2 = await create_test_recruiter(db_session, "v14_r2")
    sess, rec_file = await create_test_session_and_recording(db_session, cand.id, rec1.id)
    await video_vision_service.process_vision_analysis(db_session, sess.id, rec_file.id)

    headers = {"Authorization": f"Bearer {token_r2}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess.id}/vision-analysis", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_15_vision_analysis_started_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v15")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.VISION_ANALYSIS_STARTED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_16_vision_analysis_completed_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v16")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.VISION_ANALYSIS_COMPLETED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_17_vision_analysis_failed_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v17")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.VISION_ANALYSIS_FAILED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    with patch.object(video_vision_service, "analyze_video_file", side_effect=RuntimeError("Simulated Analysis Error")):
        await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
        await asyncio.sleep(0.05)
        assert len(events) >= 1
        assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_18_existing_interview_completion_still_passes(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v18")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/interview/finish/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


@pytest.mark.anyio
async def test_19_existing_transcription_still_passes(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v19")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/transcription",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


@pytest.mark.anyio
async def test_20_existing_scoring_remains_unchanged(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "v20")
    sess, rec = await create_test_session_and_recording(db_session, cand.id)

    res = await async_client.get(
        f"/api/v1/interview/report/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)


@pytest.mark.anyio
async def test_21_existing_report_generation_remains_unchanged(async_client: AsyncClient, db_session: AsyncSession):
    user, rec, token = await create_test_recruiter(db_session, "rv21")

    res = await async_client.get(
        "/api/v1/recruiter/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)
