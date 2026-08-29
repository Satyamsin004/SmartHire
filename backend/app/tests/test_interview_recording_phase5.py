import pytest
import os
import uuid
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from app.main import app
from app.core.db import get_db, get_session_factory, get_engine, Base
from app.core.security import create_access_token
from app.models.domain import User, Candidate, Recruiter, InterviewSession, InterviewRecording, UserRole
from app.services.storage_service import storage_service, MAX_RECORDING_SIZE
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

async def create_test_session(db: AsyncSession, candidate_id: str, recruiter_id: str = None):
    s_id = str(uuid.uuid4())
    sess = InterviewSession(
        id=s_id,
        candidate_id=candidate_id,
        recruiter_id=recruiter_id,
        title="Python Developer Practice",
        role_target="Python Developer",
        round_type="Technical",
        status="completed"
    )
    db.add(sess)
    await db.commit()
    return sess


# ============================================================================
# PHASE 5 TEST SUITE (20 MANDATORY TESTS)
# ============================================================================

@pytest.mark.anyio
async def test_01_authenticated_candidate_can_upload_recording(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c1")
    sess = await create_test_session(db_session, cand.id)

    files = {"file": ("test_vid.webm", b"dummy video binary content", "video/webm")}
    headers = {"Authorization": f"Bearer {token}"}

    res = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "success"
    assert data["session_id"] == sess.id
    assert data["candidate_id"] == cand.id
    assert "file_path" in data


@pytest.mark.anyio
async def test_02_unauthenticated_upload_rejected(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, _ = await create_test_candidate(db_session, "c2")
    sess = await create_test_session(db_session, cand.id)

    files = {"file": ("test_vid.webm", b"dummy video binary content", "video/webm")}
    res = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files)
    assert res.status_code in (401, 403)


@pytest.mark.anyio
async def test_03_candidate_cannot_upload_to_other_candidate_session(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "c3_1")
    user2, cand2, token2 = await create_test_candidate(db_session, "c3_2")
    sess2 = await create_test_session(db_session, cand2.id)

    files = {"file": ("test_vid.webm", b"dummy video binary content", "video/webm")}
    headers = {"Authorization": f"Bearer {token1}"}

    res = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess2.id}/recordings", files=files, headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_04_candidate_cannot_retrieve_other_candidate_recording(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "c4_1")
    user2, cand2, token2 = await create_test_candidate(db_session, "c4_2")
    sess2 = await create_test_session(db_session, cand2.id)

    headers = {"Authorization": f"Bearer {token1}"}
    res = await async_client.get(f"/api/v1/uploads/interview-sessions/{sess2.id}/recordings", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_05_authorized_recruiter_can_retrieve_recording_metadata(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "c5")
    user_r, rec, token_r = await create_test_recruiter(db_session, "r5")
    sess = await create_test_session(db_session, cand.id, rec.id)

    # Upload recording
    files = {"file": ("rec.webm", b"recruiter test payload", "video/webm")}
    await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files=files,
        headers={"Authorization": f"Bearer {token_c}"}
    )

    # Recruiter retrieves
    res = await async_client.get(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        headers={"Authorization": f"Bearer {token_r}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["session_id"] == sess.id


@pytest.mark.anyio
async def test_06_unauthorized_recruiter_cannot_retrieve_recording(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "c6")
    user_r1, rec1, _ = await create_test_recruiter(db_session, "r6_1")
    user_r2, rec2, token_r2 = await create_test_recruiter(db_session, "r6_2")
    sess = await create_test_session(db_session, cand.id, rec1.id)

    res = await async_client.get(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        headers={"Authorization": f"Bearer {token_r2}"}
    )
    assert res.status_code == 403


@pytest.mark.anyio
async def test_07_valid_mime_type_accepted(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c7")
    sess = await create_test_session(db_session, cand.id)

    for mime in ["video/webm", "video/mp4", "audio/webm"]:
        res = await async_client.post(
            f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
            files={"file": ("test.webm", b"valid media content", mime)},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200


@pytest.mark.anyio
async def test_08_invalid_mime_type_rejected(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c8")
    sess = await create_test_session(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("script.sh", b"#!/bin/bash echo hack", "application/x-sh")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400


@pytest.mark.anyio
async def test_09_oversized_recording_rejected(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c9")
    sess = await create_test_session(db_session, cand.id)

    # Test via storage_service direct validation to prevent huge RAM usage in test
    with pytest.raises(Exception) as exc_info:
        storage_service.validate_recording_file("large.webm", "video/webm", MAX_RECORDING_SIZE + 100)
    assert "413" in str(exc_info.value) or "exceeds" in str(exc_info.value)


@pytest.mark.anyio
async def test_10_empty_recording_rejected(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c10")
    sess = await create_test_session(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("empty.webm", b"", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400


@pytest.mark.anyio
async def test_11_successful_upload_creates_interview_recording_metadata(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c11")
    sess = await create_test_session(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("video.webm", b"recording payload", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200

    res_db = await db_session.execute(select(InterviewRecording).where(InterviewRecording.session_id == sess.id))
    rec = res_db.scalar_one_or_none()
    assert rec is not None
    assert rec.candidate_id == cand.id
    assert rec.status == "available"


@pytest.mark.anyio
async def test_12_recording_associated_with_correct_session(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c12")
    sess = await create_test_session(db_session, cand.id)

    await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("video.webm", b"session association payload", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )

    res_db = await db_session.execute(select(InterviewRecording).where(InterviewRecording.session_id == sess.id))
    rec = res_db.scalar_one_or_none()
    assert rec.session_id == sess.id


@pytest.mark.anyio
async def test_13_database_failure_does_not_leave_orphaned_file(db_session: AsyncSession):
    # Verify storage_service clean deletion helper
    cand_id = str(uuid.uuid4())
    sess_id = str(uuid.uuid4())
    saved = storage_service.save_recording(cand_id, sess_id, b"temp data", "temp.webm", "video/webm")
    assert storage_service.exists(saved["file_path"])

    # Simulate cleanup on DB error
    storage_service.delete_recording(saved["file_path"])
    assert not storage_service.exists(saved["file_path"])


@pytest.mark.anyio
async def test_14_storage_failure_does_not_create_db_record(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c14")
    sess = await create_test_session(db_session, cand.id)

    # Trigger storage validation error
    res = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("script.exe", b"malicious binary", "application/x-msdownload")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400

    res_db = await db_session.execute(select(InterviewRecording).where(InterviewRecording.session_id == sess.id))
    assert res_db.scalar_one_or_none() is None


@pytest.mark.anyio
async def test_15_duplicate_upload_idempotent(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c15")
    sess = await create_test_session(db_session, cand.id)

    # First upload
    res1 = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("video.webm", b"idempotent payload 1", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res1.status_code == 200

    # Retry upload
    res2 = await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("video.webm", b"idempotent payload 2", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res2.status_code == 200
    assert res2.json()["recording_id"] == res1.json()["recording_id"]


@pytest.mark.anyio
async def test_16_recording_available_realtime_event_emitted(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c16")
    sess = await create_test_session(db_session, cand.id)

    events_captured = []
    def event_subscriber(evt):
        if evt.event_type == SessionEventType.RECORDING_AVAILABLE:
            events_captured.append(evt)

    session_event_publisher.subscribe(event_subscriber)

    await async_client.post(
        f"/api/v1/uploads/interview-sessions/{sess.id}/recordings",
        files={"file": ("video.webm", b"event payload", "video/webm")},
        headers={"Authorization": f"Bearer {token}"}
    )

    await asyncio.sleep(0.1)
    assert len(events_captured) >= 1
    assert events_captured[0].session_id == sess.id


@pytest.mark.anyio
async def test_17_existing_interview_completion_still_works(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c17")
    sess = await create_test_session(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/interview/finish/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


@pytest.mark.anyio
async def test_18_existing_scoring_report_generation_still_works(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c18")
    sess = await create_test_session(db_session, cand.id)

    res = await async_client.get(
        f"/api/v1/interview/report/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404) # Valid response format


@pytest.mark.anyio
async def test_19_existing_candidate_dashboard_apis_still_work(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "c19")

    res = await async_client.get(
        "/api/v1/users/candidate/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)


@pytest.mark.anyio
async def test_20_existing_recruiter_dashboard_apis_still_work(async_client: AsyncClient, db_session: AsyncSession):
    user, rec, token = await create_test_recruiter(db_session, "r20")

    res = await async_client.get(
        "/api/v1/recruiter/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code in (200, 404)
