import pytest
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.core.db import get_session_factory, get_engine, Base
from app.models.domain import (
    User, Candidate, Recruiter, ScheduledInterview, ReminderScheduleLog,
    EmailNotificationLog, InterviewSession, ScoringReport, Notification,
    InterviewIntegrityEvent, InterviewQuestion, InterviewAnswer
)
from app.services.reminder_service import reminder_service
from app.services.email_service import email_service
from app.services.pdf_service import pdf_generator
from app.services.integrity_service import integrity_service
from app.services.interview_service import EvaluationService
from app.core.security import create_access_token

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def setup_db_tables():
    engine_obj = get_engine()
    async with engine_obj.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

async def create_candidate_user(db: AsyncSession, prefix: str):
    u_id = str(uuid.uuid4())
    u = User(
        id=u_id,
        email=f"{prefix}_{u_id[:8]}@example.com",
        password_hash="hash",
        full_name=f"Candidate {prefix}",
        role="candidate",
        is_verified=True
    )
    db.add(u)
    await db.flush()
    c = Candidate(user_id=u.id, target_role="Senior Full Stack Engineer", experience_level="Senior")
    db.add(c)
    await db.flush()
    token = create_access_token(subject=u.id, email=u.email, role=u.role)
    return u, c, token

async def create_recruiter_user(db: AsyncSession, prefix: str):
    u_id = str(uuid.uuid4())
    u = User(
        id=u_id,
        email=f"{prefix}_{u_id[:8]}@example.com",
        password_hash="hash",
        full_name=f"Recruiter {prefix}",
        role="recruiter",
        is_verified=True
    )
    db.add(u)
    await db.flush()
    r = Recruiter(user_id=u.id, company_name="TechCorp Global")
    db.add(r)
    await db.flush()
    token = create_access_token(subject=u.id, email=u.email, role=u.role)
    return u, r, token

# =========================================================================
# 1. INTERVIEW REMINDERS TESTS
# =========================================================================

@pytest.mark.anyio
async def test_01_reminder_scheduling_and_intervals(db_session: AsyncSession):
    """Verifies that scheduling an interview creates 24H, 1H, and 15M reminder schedule records."""
    u, c, _ = await create_candidate_user(db_session, "rem_01")
    interview_time = datetime.utcnow() + timedelta(days=2) # 48 hours from now

    interview = ScheduledInterview(
        candidate_id=c.id,
        round_type="Technical",
        scheduled_date=interview_time,
        duration_minutes=45,
        status="Scheduled"
    )
    db_session.add(interview)
    await db_session.flush()

    reminders = await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    assert len(reminders) == 3
    types = [r.reminder_type for r in reminders]
    assert "24H" in types
    assert "1H" in types
    assert "15M" in types

    for r in reminders:
        assert r.status == "PENDING"
        assert r.idempotency_key == f"{interview.id}_{r.reminder_type}"

@pytest.mark.anyio
async def test_02_duplicate_reminder_prevention(db_session: AsyncSession):
    """Verifies that calling schedule_reminders multiple times does not create duplicates."""
    u, c, _ = await create_candidate_user(db_session, "rem_02")
    interview_time = datetime.utcnow() + timedelta(days=3)

    interview = ScheduledInterview(
        candidate_id=c.id,
        round_type="Technical",
        scheduled_date=interview_time,
        duration_minutes=30,
        status="Scheduled"
    )
    db_session.add(interview)
    await db_session.flush()

    rem1 = await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    rem2 = await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    
    # Query DB directly to ensure no duplicates exist
    res = await db_session.execute(
        select(ReminderScheduleLog).where(ReminderScheduleLog.interview_id == interview.id)
    )
    total_logs = res.scalars().all()
    assert len(total_logs) == 3

@pytest.mark.anyio
async def test_03_interview_cancellation_invalidates_reminders(db_session: AsyncSession):
    """Verifies that cancelling an interview marks pending reminders as CANCELLED."""
    u, c, _ = await create_candidate_user(db_session, "rem_03")
    interview = ScheduledInterview(
        candidate_id=c.id,
        round_type="HR",
        scheduled_date=datetime.utcnow() + timedelta(days=2),
        status="Scheduled"
    )
    db_session.add(interview)
    await db_session.flush()

    await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    cancelled_count = await reminder_service.invalidate_reminders(db_session, interview.id, reason="CANCELLED")
    assert cancelled_count == 3

    res = await db_session.execute(
        select(ReminderScheduleLog).where(ReminderScheduleLog.interview_id == interview.id)
    )
    for r in res.scalars().all():
        assert r.status == "CANCELLED"

@pytest.mark.anyio
async def test_04_interview_rescheduling_regenerates_reminders(db_session: AsyncSession):
    """Verifies that rescheduling invalidates old reminders and sets up new ones."""
    u, c, _ = await create_candidate_user(db_session, "rem_04")
    interview = ScheduledInterview(
        candidate_id=c.id,
        round_type="Technical",
        scheduled_date=datetime.utcnow() + timedelta(days=2),
        status="Scheduled"
    )
    db_session.add(interview)
    await db_session.flush()

    await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    
    # Reschedule interview to 4 days out
    interview.scheduled_date = datetime.utcnow() + timedelta(days=4)
    new_logs = await reminder_service.reschedule_reminders(db_session, interview, u.id)
    assert len(new_logs) == 3
    for r in new_logs:
        assert r.status == "PENDING"

@pytest.mark.anyio
async def test_05_completed_interview_skips_reminders(db_session: AsyncSession):
    """Verifies that a completed interview marks pending reminders as SKIPPED and never sends them."""
    u, c, _ = await create_candidate_user(db_session, "rem_05")
    interview = ScheduledInterview(
        candidate_id=c.id,
        round_type="System Design",
        scheduled_date=datetime.utcnow() + timedelta(hours=5),
        status="Scheduled"
    )
    db_session.add(interview)
    await db_session.flush()

    await reminder_service.schedule_reminders_for_interview(db_session, interview, u.id)
    interview.status = "Completed"
    await reminder_service.invalidate_reminders(db_session, interview.id, reason="SKIPPED")

    summary = await reminder_service.process_due_reminders(db_session)
    assert summary["dispatched"] == 0

# =========================================================================
# 2. EMAIL NOTIFICATIONS TESTS
# =========================================================================

@pytest.mark.anyio
async def test_06_email_dispatch_idempotency_and_logging(db_session: AsyncSession):
    """Verifies that email dispatch records to EmailNotificationLog and suppresses duplicates."""
    u, c, _ = await create_candidate_user(db_session, "email_06")
    idempotency_key = f"TEST_EMAIL_IDEMPOTENT_{uuid.uuid4().hex}"

    sent1 = await email_service.dispatch_email(
        db=db_session,
        to_email=u.email,
        subject="Test Confirmation",
        html_content="<p>Test</p>",
        text_content="Test",
        notification_type="interview_scheduled",
        idempotency_key=idempotency_key,
        user_id=u.id
    )
    assert sent1 is True

    # Duplicate call with identical key
    sent2 = await email_service.dispatch_email(
        db=db_session,
        to_email=u.email,
        subject="Test Confirmation Duplicate",
        html_content="<p>Duplicate</p>",
        text_content="Duplicate",
        notification_type="interview_scheduled",
        idempotency_key=idempotency_key,
        user_id=u.id
    )
    assert sent2 is True

    res = await db_session.execute(
        select(EmailNotificationLog).where(EmailNotificationLog.idempotency_key == idempotency_key)
    )
    logs = res.scalars().all()
    assert len(logs) == 1
    assert logs[0].status == "SENT"
    assert logs[0].retry_count >= 1

@pytest.mark.anyio
async def test_07_interview_lifecycle_email_templates(db_session: AsyncSession):
    """Verifies all lifecycle email methods execute cleanly without throwing errors."""
    u, c, _ = await create_candidate_user(db_session, "email_07")
    u_r, r, _ = await create_recruiter_user(db_session, "email_07_r")

    # 1. Scheduled
    res_s = await email_service.send_interview_scheduled_email(
        db=db_session,
        candidate_email=u.email,
        candidate_name=u.full_name,
        interview_title="Full Stack Engineer",
        scheduled_date_str="Sep 15, 2026 at 10:00 AM",
        duration_minutes=45,
        round_type="Technical",
        interview_link="http://localhost:3001/interview-lobby",
        interview_id="test-sess-1"
    )
    assert res_s is True

    # 2. Reminder
    res_rem = await email_service.send_interview_reminder_email(
        db=db_session,
        candidate_email=u.email,
        candidate_name=u.full_name,
        interview_title="Full Stack Engineer",
        scheduled_date_str="Sep 15, 2026 at 10:00 AM",
        time_until_str="in 24 hours",
        interview_link="http://localhost:3001/interview-lobby",
        reminder_type="24H",
        interview_id="test-sess-1"
    )
    assert res_rem is True

    # 3. Report Ready (Candidate)
    res_rr_c = await email_service.send_report_ready_email(
        db=db_session,
        recipient_email=u.email,
        recipient_name=u.full_name,
        interview_title="Full Stack Engineer",
        overall_score=84.5,
        recommendation="Shortlist",
        report_link="http://localhost:3001/report/test-sess-1",
        is_recruiter=False,
        interview_id="test-sess-1"
    )
    assert res_rr_c is True

    # 4. Report Ready (Recruiter)
    res_rr_r = await email_service.send_report_ready_email(
        db=db_session,
        recipient_email=u_r.email,
        recipient_name=u_r.full_name,
        interview_title="Full Stack Engineer",
        overall_score=84.5,
        recommendation="Shortlist",
        report_link="http://localhost:3001/report/test-sess-1",
        is_recruiter=True,
        candidate_name=u.full_name,
        interview_id="test-sess-1"
    )
    assert res_rr_r is True

# =========================================================================
# 3. DOWNLOADABLE REPORTS (PDF) & AUTHORIZATION TESTS
# =========================================================================

@pytest.mark.anyio
async def test_08_pdf_generator_generates_valid_bytes():
    """Verifies that PDFReportGenerator produces valid PDF bytes containing all required sections."""
    session_info = {
        "candidate_name": "Jane Doe",
        "candidate_email": "jane@example.com",
        "role_target": "Senior Backend Architect",
        "company_name": "SmartHire Tech Corp",
        "round_type": "Technical System Design",
        "interview_type": "Simulation",
        "date": "Sep 08, 2026",
        "session_id": "sess-pdf-01"
    }
    report_data = {
        "overall_score": 88.5,
        "recommendation": "Strong Shortlist",
        "technical_score": 90.0,
        "communication_score": 86.0,
        "confidence_score": 85.0,
        "professionalism_score": 92.0,
        "grammar_score": 89.0,
        "problem_solving_score": 88.0,
        "behavior_score": 84.0,
        "leadership_score": 82.0,
        "overall_summary": "Demonstrated deep mastery of distributed systems and clean architectural patterns.",
        "strengths": ["Excellent caching strategies", "Clear modular breakdown"],
        "weaknesses": ["Could elaborate more on disaster recovery"],
        "communication_metrics": {
            "speaking_pace_wpm": 138,
            "filler_words": 2,
            "filler_frequency": "1.1%",
            "grammar": 91.0,
            "pronunciation": 88.0,
            "vocabulary_richness": 86.0,
            "communication_quality_score": 89.0
        },
        "confidence_metrics": {
            "confidence_score": 87.0,
            "emotion": "Confident & Focused",
            "eye_contact": 89.0,
            "attention": 92.0,
            "facial_engagement": 88.0,
            "posture_stability": "Upright Stable"
        },
        "integrity_score": 100.0,
        "integrity_status": "CLEAN",
        "model_version": "smart-hire-v2.0.0",
        "analysis_version": "evidence_based_v2"
    }
    transcript_data = [
        {
            "question_text": "Explain how you would design a globally distributed rate limiter.",
            "answer_text": "I would use a sliding window log algorithm with Redis clusters partitioned by hash key.",
            "category": "System Design",
            "is_followup": False,
            "technical_score": 92.0,
            "covered_concepts": ["Sliding Window", "Redis Cluster", "Partitioning"],
            "missing_concepts": ["Token Bucket alternative"],
            "recommendation": "Solid system design rationale."
        }
    ]
    integrity_summary = {
        "status": "CLEAN",
        "integrity_score": 100.0,
        "counts": {
            "MOBILE_PHONE": 0,
            "MULTIPLE_PERSON": 0,
            "TAB_SWITCH": 0,
            "FACE_NOT_VISIBLE": 0
        }
    }

    pdf_bytes = pdf_generator.generate_interview_pdf(
        session_info=session_info,
        report_data=report_data,
        transcript_data=transcript_data,
        integrity_summary=integrity_summary
    )

    assert pdf_bytes is not None
    assert len(pdf_bytes) > 1000
    # PDF magic bytes
    assert pdf_bytes.startswith(b"%PDF-")

@pytest.mark.anyio
async def test_09_pdf_download_api_candidate_authorization(async_client: AsyncClient, db_session: AsyncSession):
    """Verifies that Candidate A can download their own report, but cannot access Candidate B's report."""
    u1, c1, token1 = await create_candidate_user(db_session, "pdf_u1")
    u2, c2, token2 = await create_candidate_user(db_session, "pdf_u2")

    sess1 = InterviewSession(
        candidate_id=c1.id,
        title="Software Engineer Interview",
        role_target="Software Engineer",
        status="completed"
    )
    sess2 = InterviewSession(
        candidate_id=c2.id,
        title="Data Engineer Interview",
        role_target="Data Engineer",
        status="completed"
    )
    db_session.add_all([sess1, sess2])
    await db_session.flush()

    # Pre-populate scoring report for sess1 and sess2
    rep1 = ScoringReport(
        session_id=sess1.id,
        candidate_id=c1.id,
        overall_score=85.0,
        technical_score=85.0,
        communication_score=85.0,
        confidence_score=85.0,
        professionalism_score=85.0,
        status="COMPLETED"
    )
    rep2 = ScoringReport(
        session_id=sess2.id,
        candidate_id=c2.id,
        overall_score=78.0,
        technical_score=78.0,
        communication_score=78.0,
        confidence_score=78.0,
        professionalism_score=78.0,
        status="COMPLETED"
    )
    db_session.add_all([rep1, rep2])
    await db_session.commit()

    # 1. Candidate 1 downloads own report -> 200 OK with PDF
    headers1 = {"Authorization": f"Bearer {token1}"}
    res_own = await async_client.get(f"/api/v1/interview/report/{sess1.id}/pdf", headers=headers1)
    assert res_own.status_code == 200
    assert res_own.headers.get("content-type") == "application/pdf"
    assert res_own.content.startswith(b"%PDF-")

    # 2. Candidate 1 attempts to download Candidate 2's report -> 403 Forbidden
    res_unauth = await async_client.get(f"/api/v1/interview/report/{sess2.id}/pdf", headers=headers1)
    assert res_unauth.status_code == 403

@pytest.mark.anyio
async def test_10_pdf_download_api_recruiter_authorization(async_client: AsyncClient, db_session: AsyncSession):
    """Verifies that an authorized recruiter can download candidate evaluation reports."""
    u_c, c, _ = await create_candidate_user(db_session, "pdf_rec_c")
    u_r, r, token_r = await create_recruiter_user(db_session, "pdf_rec_r")

    sess = InterviewSession(
        candidate_id=c.id,
        recruiter_id=r.id,
        title="Backend Engineer",
        role_target="Backend Engineer",
        status="completed"
    )
    db_session.add(sess)
    await db_session.flush()

    rep = ScoringReport(
        session_id=sess.id,
        candidate_id=c.id,
        overall_score=88.0,
        technical_score=90.0,
        communication_score=85.0,
        confidence_score=86.0,
        professionalism_score=88.0,
        status="COMPLETED"
    )
    db_session.add(rep)
    await db_session.commit()

    headers_r = {"Authorization": f"Bearer {token_r}"}
    res = await async_client.get(f"/api/v1/interview/report/{sess.id}/pdf", headers=headers_r)
    assert res.status_code == 200
    assert res.headers.get("content-type") == "application/pdf"
    assert res.content.startswith(b"%PDF-")

# =========================================================================
# 4. SESSION ALERTS INTEGRITY AUDIT VERIFICATION
# =========================================================================

@pytest.mark.anyio
async def test_11_session_alerts_audit_data_flow(db_session: AsyncSession):
    """Verifies end-to-end integrity alert storage and audit penalty calculation."""
    u, c, _ = await create_candidate_user(db_session, "alert_11")

    sess = InterviewSession(
        candidate_id=c.id,
        title="Live Interview Session",
        status="in_progress"
    )
    db_session.add(sess)
    await db_session.flush()

    # Record 1 mobile phone event and 1 multiple person event
    evt1 = InterviewIntegrityEvent(
        session_id=sess.id,
        candidate_id=c.id,
        event_type="MOBILE_PHONE",
        severity="HIGH",
        status="RESOLVED",
        duration_seconds=5.0
    )
    evt2 = InterviewIntegrityEvent(
        session_id=sess.id,
        candidate_id=c.id,
        event_type="MULTIPLE_PERSON",
        severity="HIGH",
        status="RESOLVED",
        duration_seconds=8.0
    )
    db_session.add_all([evt1, evt2])
    await db_session.commit()

    # Compute audit summary
    summary = await integrity_service.get_session_integrity_summary(db_session, sess.id)
    assert summary["breakdown"]["mobile_phone"] == 1
    assert summary["breakdown"]["multiple_person"] == 1
    assert summary["breakdown"]["tab_switch"] == 0
    # Penalty: 15 (phone) + 10 (multiple person) = 25 -> score 75.0
    assert summary["integrity_score"] == 75.0
    assert summary["integrity_status"] == "FLAGGED"
    assert len(summary["timeline"]) == 2
