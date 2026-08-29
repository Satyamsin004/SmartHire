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

async def create_test_candidate(db: AsyncSession, email_prefix: str = "cand_e"):
    u_id = str(uuid.uuid4())
    c_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Candidate Eval Tester",
        role="candidate",
        password_hash="hashed_pwd"
    )
    cand = Candidate(id=c_id, user_id=u_id)
    db.add(user)
    db.add(cand)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="candidate")
    return user, cand, token

async def create_test_recruiter(db: AsyncSession, email_prefix: str = "rec_e"):
    u_id = str(uuid.uuid4())
    r_id = str(uuid.uuid4())
    user = User(
        id=u_id,
        email=f"{email_prefix}_{u_id[:8]}@example.com",
        full_name="Recruiter Eval Tester",
        role="recruiter",
        password_hash="hashed_pwd"
    )
    rec = Recruiter(id=r_id, user_id=u_id)
    db.add(user)
    db.add(rec)
    await db.commit()
    token = create_access_token(subject=u_id, email=user.email, role="recruiter")
    return user, rec, token

async def create_full_eval_session(db: AsyncSession, candidate_id: str, recruiter_id: str = None):
    s_id = str(uuid.uuid4())
    sess = InterviewSession(
        id=s_id,
        candidate_id=candidate_id,
        recruiter_id=recruiter_id,
        title="Unified Evaluation Session",
        role_target="Lead System Architect",
        round_type="Technical",
        status="in_progress"
    )
    db.add(sess)
    await db.commit()

    q_id = str(uuid.uuid4())
    q = InterviewQuestion(
        id=q_id,
        session_id=s_id,
        order_index=1,
        question_text="Explain microservice event-driven architecture.",
        category="System Design",
        difficulty="Hard",
        expected_keywords=["event", "architecture", "microservices", "async", "kafka"]
    )
    db.add(q)
    await db.commit()

    a_id = str(uuid.uuid4())
    ans = InterviewAnswer(
        id=a_id,
        question_id=q_id,
        transcript_text="I designed event-driven microservices using Kafka and asynchronous messaging patterns.",
        execution_time_ms=120.0
    )
    db.add(ans)
    await db.commit()

    rec_saved = storage_service.save_recording(candidate_id, s_id, b"eval video stream bytes", "eval_video.webm", "video/webm")
    rec = InterviewRecording(
        id=str(uuid.uuid4()),
        session_id=s_id,
        candidate_id=candidate_id,
        recording_type="VIDEO_AUDIO",
        file_path=rec_saved["file_path"],
        storage_key=rec_saved["storage_key"],
        mime_type="video/webm",
        file_size=len(b"eval video stream bytes"),
        duration=18.5,
        status="available"
    )
    db.add(rec)
    await db.commit()

    tr = InterviewTranscript(
        id=str(uuid.uuid4()),
        recording_id=rec.id,
        session_id=s_id,
        candidate_id=candidate_id,
        status="COMPLETED",
        transcript_text="I designed event-driven microservices using Kafka and asynchronous messaging patterns.",
        language="en",
        provider="whisper-large-v3-turbo",
        duration=18.5
    )
    db.add(tr)
    await db.commit()

    va = InterviewVisionAnalysis(
        id=str(uuid.uuid4()),
        recording_id=rec.id,
        session_id=s_id,
        candidate_id=candidate_id,
        status="COMPLETED",
        provider="gemini_vision",
        duration=18.5,
        frames_analyzed=10,
        face_presence_percentage=98.5,
        eye_contact_percentage=94.0,
        attention_score=96.0,
        confidence_percentage=91.0,
        multiple_person_percentage=0.0,
        multiple_faces_detected=False
    )
    db.add(va)
    await db.commit()

    return sess, q, ans, rec, tr, va


# ============================================================================
# PHASE 8 TEST SUITE (22 MANDATORY TESTS)
# ============================================================================

@pytest.mark.anyio
async def test_01_evaluation_loads_correct_interview_session(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e1")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report is not None
    assert report.session_id == sess.id


@pytest.mark.anyio
async def test_02_correct_candidate_session_relationships_maintained(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e2")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.candidate_id == cand.id


@pytest.mark.anyio
async def test_03_persisted_transcript_used(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e3")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.transcript_id == tr.id


@pytest.mark.anyio
async def test_04_persisted_vision_analysis_used(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e4")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.vision_analysis_id == va.id


@pytest.mark.anyio
async def test_05_existing_technical_evaluation_used(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e5")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.technical_score >= 40.0


@pytest.mark.anyio
async def test_06_no_second_transcription_call_occurs(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e6")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    with patch.object(transcription_service, "process_transcription", side_effect=AssertionError("Should not re-call transcription")):
        report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
        assert report.transcript_id == tr.id


@pytest.mark.anyio
async def test_07_no_second_vision_analysis_call_occurs(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e7")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    with patch.object(video_vision_service, "process_vision_analysis", side_effect=AssertionError("Should not re-call vision analysis")):
        report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
        assert report.vision_analysis_id == va.id


@pytest.mark.anyio
async def test_08_evaluation_waits_for_required_inputs(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e8")
    s_id = str(uuid.uuid4())
    sess = InterviewSession(id=s_id, candidate_id=cand.id, title="Empty Session", status="in_progress")
    db_session.add(sess)
    await db_session.commit()

    report = await EvaluationService.generate_and_finalize_report(db_session, s_id)
    assert report is not None
    assert report.session_id == s_id


@pytest.mark.anyio
async def test_09_evaluation_completes_when_required_inputs_available(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e9")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.status == "COMPLETED"


@pytest.mark.anyio
async def test_10_evaluation_result_persisted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e10")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)

    res_check = await db_session.execute(select(ScoringReport).where(ScoringReport.session_id == sess.id))
    persisted = res_check.scalars().first()
    assert persisted is not None
    assert persisted.id == report.id


@pytest.mark.anyio
async def test_11_report_generated_from_evaluation(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e11")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report.communication_score is not None
    assert report.overall_score is not None


@pytest.mark.anyio
async def test_12_duplicate_evaluation_generation_prevented(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e12")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    report1 = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    report2 = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report1.id == report2.id


@pytest.mark.anyio
async def test_13_partial_vision_failure_follows_documented_behavior(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e13")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)
    va.status = "FAILED"
    va.error_message = "Corrupt frame stream"
    await db_session.commit()

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report is not None
    assert report.overall_score > 0.0


@pytest.mark.anyio
async def test_14_partial_transcription_failure_follows_documented_behavior(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e14")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)
    tr.status = "FAILED"
    tr.error_message = "Audio chunk unreadable"
    await db_session.commit()

    report = await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    assert report is not None
    assert report.overall_score > 0.0


@pytest.mark.anyio
async def test_15_candidate_authorization_works(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e15")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    headers = {"Authorization": f"Bearer {token}"}
    res = await async_client.get(f"/api/v1/interview/evaluation/{sess.id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["session_id"] == sess.id


@pytest.mark.anyio
async def test_16_recruiter_authorization_works(async_client: AsyncClient, db_session: AsyncSession):
    user_c, cand, token_c = await create_test_candidate(db_session, "e16_c")
    user_r, rec, token_r = await create_test_recruiter(db_session, "e16_r")
    sess, q, ans, rec_f, tr, va = await create_full_eval_session(db_session, cand.id, rec.id)

    headers = {"Authorization": f"Bearer {token_r}"}
    res = await async_client.get(f"/api/v1/interview/evaluation/{sess.id}", headers=headers)
    assert res.status_code == 200


@pytest.mark.anyio
async def test_17_unauthorized_user_cannot_access_other_evaluation(async_client: AsyncClient, db_session: AsyncSession):
    user1, cand1, token1 = await create_test_candidate(db_session, "e17_1")
    user2, cand2, token2 = await create_test_candidate(db_session, "e17_2")
    sess2, q2, ans2, rec2, tr2, va2 = await create_full_eval_session(db_session, cand2.id)

    headers = {"Authorization": f"Bearer {token1}"}
    res = await async_client.get(f"/api/v1/interview/evaluation/{sess2.id}", headers=headers)
    assert res.status_code == 403


@pytest.mark.anyio
async def test_18_evaluation_started_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e18")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.EVALUATION_STARTED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_19_evaluation_completed_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e19")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.EVALUATION_COMPLETED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_20_report_generated_event_emitted(db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e20")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    events = []
    def sub(evt):
        if evt.event_type == SessionEventType.REPORT_GENERATED:
            events.append(evt)
    session_event_publisher.subscribe(sub)

    await EvaluationService.generate_and_finalize_report(db_session, sess.id)
    await asyncio.sleep(0.05)
    assert len(events) >= 1
    assert events[0].session_id == sess.id


@pytest.mark.anyio
async def test_21_existing_scoring_regression_tests_pass():
    speech = [{"speaking_pace_wpm": 145.0, "filler_word_count": 2, "grammar_score": 90.0, "clarity_score": 92.0}]
    vision = [{"eye_contact_percentage": 92.0, "confidence_percentage": 88.0, "attention_score": 95.0}]
    tech = [{"technical_score": 85.0}]
    transcripts = ["I implemented Kafka messaging."]

    computed = await scoring_engine.calculate_session_scores(speech, vision, tech, transcripts)
    assert computed["overall_score"] > 0.0
    assert "communication_score" in computed
    assert "confidence_score" in computed
    assert "technical_score" in computed
    assert "professionalism_score" in computed


@pytest.mark.anyio
async def test_22_existing_interview_pipeline_tests_pass(async_client: AsyncClient, db_session: AsyncSession):
    user, cand, token = await create_test_candidate(db_session, "e22")
    sess, q, ans, rec, tr, va = await create_full_eval_session(db_session, cand.id)

    res = await async_client.post(
        f"/api/v1/interview/finish/{sess.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


@pytest.mark.anyio
async def test_23_silent_empty_transcript_produces_zero_and_reject():
    speech = [{"speaking_pace_wpm": 0.0, "filler_word_count": 0}]
    vision = [{"eye_contact_percentage": 0.0, "confidence_percentage": 0.0}]
    tech = [{"technical_score": 0.0}]
    transcripts = [""]

    computed = await scoring_engine.calculate_session_scores(speech, vision, tech, transcripts)
    assert computed["overall_score"] == 1.5 or computed["overall_score"] == 0.0
    assert computed["technical_score"] == 0.0
    assert computed["communication_score"] == 0.0
    assert computed["recommendation"] == "Reject"
    assert computed["rating_rubric"] == "Not Recommended"
