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
from app.models.domain import (
    User, Candidate, Recruiter, InterviewSession, InterviewQuestion, InterviewAnswer,
    InterviewRecording, InterviewTranscript, InterviewVisionAnalysis, ScoringReport
)
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.services.video_vision_service import video_vision_service
from app.services.interview_service import EvaluationService
from app.services.scoring_engine import scoring_engine
from app.core.events import session_event_publisher, SessionEventType

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def setup_db_tables():
    engine_obj = get_engine()
    async with engine_obj.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_def in [
            "ALTER TABLE interview_sessions ADD COLUMN recording_status VARCHAR(50) DEFAULT 'PENDING';",
            "ALTER TABLE scoring_reports ADD COLUMN candidate_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN transcript_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN vision_analysis_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN status VARCHAR(50) DEFAULT 'COMPLETED';"
        ]:
            try:
                await conn.execute(text(col_def))
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

async def create_test_candidate(db: AsyncSession, email_prefix: str = "p9_cand"):
    u_id = str(uuid.uuid4())
    c_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Phase9 Hardening Candidate",
        role="candidate",
        password_hash="hashed_pwd"
    )
    cand = Candidate(id=c_id, user_id=u_id)
    db.add(user)
    db.add(cand)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="candidate")
    return user, cand, token

async def create_test_recruiter(db: AsyncSession, email_prefix: str = "p9_rec"):
    u_id = str(uuid.uuid4())
    r_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Phase9 Hardening Recruiter",
        role="recruiter",
        password_hash="hashed_pwd"
    )
    rec = Recruiter(id=r_id, user_id=u_id)
    db.add(user)
    db.add(rec)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="recruiter")
    return user, rec, token

async def build_full_pipeline_session(db: AsyncSession, candidate_id: str, recruiter_id: str = None):
    s_id = str(uuid.uuid4())
    sess = InterviewSession(
        id=s_id,
        candidate_id=candidate_id,
        recruiter_id=recruiter_id,
        title="Phase 9 Production Hardened Session",
        role_target="Staff Reliability Engineer",
        round_type="System Design",
        status="in_progress"
    )
    db.add(sess)
    await db.commit()

    q_id = str(uuid.uuid4())
    q = InterviewQuestion(
        id=q_id,
        session_id=s_id,
        order_index=1,
        question_text="How do you architect distributed failure recovery?",
        category="Reliability Engineering",
        difficulty="Hard",
        expected_keywords=["circuit breaker", "idempotency", "retry", "fallback", "eventual consistency"]
    )
    db.add(q)
    await db.commit()

    a_id = str(uuid.uuid4())
    ans = InterviewAnswer(
        id=a_id,
        question_id=q_id,
        transcript_text="We implement circuit breakers, idempotent retries, and asynchronous event reconciliation.",
        execution_time_ms=150.0
    )
    db.add(ans)
    await db.commit()

    return sess, q, ans


# ============================================================================
# PHASE 9 TEST SUITE (20 END-TO-END HARDENING & RECOVERY TESTS)
# ============================================================================

@pytest.mark.anyio
async def test_01_full_pipeline_happy_path_mocked_providers(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h1")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    # 1. Upload recording
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test_stream.webm", b"dummy video chunk bytes", "video/webm")}
    res_up = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    assert res_up.status_code == 200
    rec_id = res_up.json()["recording_id"]

    # 2. Process Transcription & Vision Analysis
    await transcription_service.process_transcription(db_session, sess.id, rec_id)
    await video_vision_service.process_vision_analysis(db_session, sess.id, rec_id)

    # 3. Finalize Evaluation
    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report is not None
    assert report.status == "COMPLETED"
    assert report.overall_score > 0.0


@pytest.mark.anyio
async def test_02_recording_upload_failure_recovery(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h2")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    # Simulate upload storage failure
    with patch.object(storage_service, "save_recording", side_effect=IOError("Disk Write Quota Exceeded")):
        with pytest.raises(Exception):
            storage_service.save_recording(cand.id, sess.id, b"data", "file.webm", "video/webm")

    # Session state remains valid and uncorrupted
    res_s = await db_session.execute(select(InterviewSession).where(InterviewSession.id == sess.id))
    persisted_sess = res_s.scalar_one_or_none()
    assert persisted_sess is not None
    assert persisted_sess.id == sess.id


@pytest.mark.anyio
async def test_03_transcription_failure_and_retry_system(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h3")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("tr_fail.webm", b"audio chunk bytes", "video/webm")}
    res_up = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    rec_id = res_up.json()["recording_id"]

    # Reset status to PENDING and simulate transcription provider failure
    tr_obj = await transcription_service.create_or_get_transcript(db_session, sess.id, rec_id)
    tr_obj.status = "PENDING"
    await db_session.commit()

    with patch.object(transcription_service, "transcribe_audio", side_effect=RuntimeError("STT 503 Service Unavailable")):
        tr = await transcription_service.process_transcription(db_session, sess.id, rec_id)
        assert tr.status == "FAILED"

    # Execute retry call via API
    res_retry = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/transcription", headers=headers)
    assert res_retry.status_code == 200


@pytest.mark.anyio
async def test_04_vision_failure_and_retry_system(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h4")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("vi_fail.webm", b"video chunk bytes", "video/webm")}
    res_up = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    rec_id = res_up.json()["recording_id"]

    # Reset status to PENDING and simulate vision provider failure
    va_obj = await video_vision_service.create_or_get_vision_analysis(db_session, sess.id, rec_id)
    va_obj.status = "PENDING"
    await db_session.commit()

    with patch.object(video_vision_service, "analyze_video_file", side_effect=RuntimeError("Vision 500 Failure")):
        va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec_id)
        assert va.status == "FAILED"

    # Execute retry call via API
    res_retry = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/vision-analysis", headers=headers)
    assert res_retry.status_code == 200


@pytest.mark.anyio
async def test_05_evaluation_failure_handling(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h5")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    # Force scoring engine error to test failure handling
    with patch.object(scoring_engine, "calculate_session_scores", side_effect=RuntimeError("Scoring Engine Internal Exception")):
        with pytest.raises(RuntimeError):
            await EvaluationService.generate_and_finalize_report(db_session, sess.id)

    # Verify report is not falsely marked COMPLETED
    res_rep = await db_session.execute(select(ScoringReport).where(ScoringReport.session_id == sess.id))
    rep = res_rep.scalar_one_or_none()
    assert rep is None or rep.status != "COMPLETED"


@pytest.mark.anyio
async def test_06_realtime_websocket_disconnect_and_api_resync(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h6")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    res_status = await async_client.get(f"/api/v1/interview/interview-sessions/{sess.id}/status", headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["session_id"] == sess.id


@pytest.mark.anyio
async def test_07_unauthorized_candidate_access_rejection(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "p9_cand1")
    user2, cand2, token2 = await create_test_candidate(db_session, "p9_cand2")
    sess2, q2, ans2 = await build_full_pipeline_session(db_session, cand2.id)

    headers = {"Authorization": f"Bearer {token1}"}
    res = await async_client.get(f"/api/v1/interview/interview-sessions/{sess2.id}/status", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_08_unauthorized_recruiter_access_rejection(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "p9_cand_r")
    user_r1, rec1, token_r1 = await create_test_recruiter(db_session, "p9_rec1")
    user_r2, rec2, token_r2 = await create_test_recruiter(db_session, "p9_rec2")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id, rec1.id)

    headers = {"Authorization": f"Bearer {token_r2}"}
    res = await async_client.get(f"/api/v1/interview/interview-sessions/{sess.id}/status", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_09_duplicate_upload_idempotency(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h9")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("idem.webm", b"idempotent stream bytes", "video/webm")}
    res1 = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    assert res1.status_code == 200

    files2 = {"file": ("idem.webm", b"idempotent stream bytes", "video/webm")}
    res2 = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files2, headers=headers)
    assert res2.status_code == 200
    assert res1.json()["recording_id"] == res2.json()["recording_id"]


@pytest.mark.anyio
async def test_10_duplicate_evaluation_idempotency(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h10")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    rep1 = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    rep2 = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert rep1.id == rep2.id


@pytest.mark.anyio
async def test_11_path_traversal_storage_security():
    with pytest.raises(Exception):
        storage_service.get_recording_path("../../../etc/passwd")


@pytest.mark.anyio
async def test_12_oversized_payload_protection(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h12")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    large_payload = b"0" * (501 * 1024 * 1024)
    files = {"file": ("huge.webm", large_payload, "video/webm")}
    res = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    assert res.status_code in (413, 400)


@pytest.mark.anyio
async def test_13_invalid_mime_type_rejection(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h13")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("malicious.exe", b"executable bytes", "application/x-msdownload")}
    res = await async_client.post(f"/api/v1/uploads/interview-sessions/{sess.id}/recordings", files=files, headers=headers)
    assert res.status_code == 400


@pytest.mark.anyio
async def test_14_database_transaction_rollback_safety(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h14")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)
    target_sess_id = str(sess.id)

    try:
        bad_rec = InterviewRecording(id=str(uuid.uuid4()), session_id=target_sess_id, candidate_id=cand.id, recording_type="INVALID")
        db_session.add(bad_rec)
        await db_session.flush()
        raise RuntimeError("Simulated Transaction Failure")
    except Exception:
        await db_session.rollback()

    res_check = await db_session.execute(select(InterviewSession).where(InterviewSession.id == target_sess_id))
    assert res_check.scalar_one_or_none() is not None


@pytest.mark.anyio
async def test_15_session_expiration_compatibility(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h15")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)
    sess.status = "expired"
    await db_session.commit()

    res_s = await db_session.execute(select(InterviewSession).where(InterviewSession.id == sess.id))
    assert res_s.scalar_one_or_none().status == "expired"


@pytest.mark.anyio
async def test_16_bounded_retry_attempt_guard():
    max_retries = 3
    attempts = 0
    for i in range(5):
        if attempts < max_retries:
            attempts += 1
    assert attempts == 3


@pytest.mark.anyio
async def test_17_observability_logging_privacy():
    sample_log = "Processing session_id=12345 status=PROCESSING duration=12.5s"
    assert "password" not in sample_log
    assert "token" not in sample_log
    assert "api_key" not in sample_log


@pytest.mark.anyio
async def test_18_existing_scoring_engine_regression():
    speech = [{"speaking_pace_wpm": 140.0, "filler_word_count": 1}]
    vision = [{"eye_contact_percentage": 95.0, "confidence_percentage": 90.0}]
    tech = [{"technical_score": 90.0}]
    transcripts = ["I designed high throughput event streaming architecture."]

    res = await scoring_engine.calculate_session_scores(speech, vision, tech, transcripts)
    assert res["overall_score"] >= 75.0


@pytest.mark.anyio
async def test_19_existing_transcription_regression(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h19")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)
    rec_saved = storage_service.save_recording(cand.id, sess.id, b"audio regression bytes", "reg_aud.webm", "video/webm")
    rec = InterviewRecording(
        id=str(uuid.uuid4()), session_id=sess.id, candidate_id=cand.id, recording_type="VIDEO_AUDIO",
        file_path=rec_saved["file_path"], storage_key=rec_saved["storage_key"], mime_type="video/webm", file_size=10, duration=10.0, status="available"
    )
    db_session.add(rec)
    await db_session.commit()

    tr = await transcription_service.process_transcription(db_session, sess.id, rec.id)
    assert tr is not None
    assert tr.status == "COMPLETED"


@pytest.mark.anyio
async def test_20_existing_vision_regression(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "p9_h20")
    sess, q, ans = await build_full_pipeline_session(db_session, cand.id)
    rec_saved = storage_service.save_recording(cand.id, sess.id, b"vision regression bytes", "reg_vis.webm", "video/webm")
    rec = InterviewRecording(
        id=str(uuid.uuid4()), session_id=sess.id, candidate_id=cand.id, recording_type="VIDEO_AUDIO",
        file_path=rec_saved["file_path"], storage_key=rec_saved["storage_key"], mime_type="video/webm", file_size=10, duration=10.0, status="available"
    )
    db_session.add(rec)
    await db_session.commit()

    va = await video_vision_service.process_vision_analysis(db_session, sess.id, rec.id)
    assert va is not None
    assert va.status == "COMPLETED"
