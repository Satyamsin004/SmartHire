import pytest
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.domain import Base, User, Candidate, InterviewSession, InterviewIntegrityEvent
from app.services.integrity_service import integrity_service

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.mark.asyncio
async def test_integrity_service_lifecycle():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        user = User(
            email="cand_integrity@smarthire.ai",
            password_hash="testpwd",
            full_name="Integrity Tester",
            role="candidate"
        )
        db.add(user)
        await db.flush()

        cand = Candidate(user_id=user.id, target_role="Software Engineer")
        db.add(cand)
        await db.flush()

        sess = InterviewSession(
            candidate_id=cand.id,
            title="Integrity Test Session",
            role_target="Software Engineer",
            status="active"
        )
        db.add(sess)
        await db.commit()
        await db.refresh(sess)

        # 1. Start with Clean Summary
        summary = await integrity_service.get_session_integrity_summary(db, sess.id)
        assert summary["integrity_status"] == "CLEAN"
        assert summary["integrity_score"] == 100.0
        assert summary["total_incidents"] == 0

        # 2. Record Multiple Person Incident (Active -> Resolved)
        evt1, summary1 = await integrity_service.record_or_update_event(
            db, sess.id, cand.id, {
                "event_type": "MULTIPLE_PERSON",
                "severity": "HIGH",
                "status": "ACTIVE",
                "confidence": 0.94,
                "metadata": {"person_count": 2}
            }
        )
        assert evt1.id is not None
        assert evt1.status == "ACTIVE"
        assert summary1["breakdown"]["multiple_person"] == 1
        assert summary1["integrity_score"] == 90.0
        assert summary1["integrity_status"] == "FLAGGED"

        # Update and resolve event 1
        evt1_res, summary1_res = await integrity_service.record_or_update_event(
            db, sess.id, cand.id, {
                "event_id": evt1.id,
                "status": "RESOLVED",
                "duration_seconds": 12.5,
                "confidence": 0.95
            }
        )
        assert evt1_res.status == "RESOLVED"
        assert evt1_res.duration_seconds == 12.5
        assert summary1_res["total_incidents"] == 1

        # 3. Record Mobile Phone Incident
        evt2, summary2 = await integrity_service.record_or_update_event(
            db, sess.id, cand.id, {
                "event_type": "MOBILE_PHONE",
                "severity": "HIGH",
                "status": "RESOLVED",
                "duration_seconds": 8.0,
                "confidence": 0.91
            }
        )
        # Score = 100 - 10 (Person) - 15 (Phone) = 75.0
        assert summary2["integrity_score"] == 75.0
        assert summary2["breakdown"]["mobile_phone"] == 1
        assert summary2["total_incidents"] == 2
        assert summary2["integrity_status"] == "FLAGGED"

        # 4. Tab Switch Auto-Termination
        term_summary = await integrity_service.terminate_session(
            db, sess.id, cand.id, reason="TAB_SWITCH", metadata={"tab_hidden_at": datetime.utcnow().isoformat()}
        )
        assert term_summary["is_terminated"] is True
        assert term_summary["integrity_status"] == "TERMINATED"
        assert term_summary["termination_reason"] == "TAB_SWITCH"
        assert term_summary["breakdown"]["tab_switch"] == 1
        # Total incidents = 3 (1 Person + 1 Phone + 1 Tab Switch)
        assert term_summary["total_incidents"] == 3
        # Score = 75 - 40 = 35.0
        assert term_summary["integrity_score"] == 35.0

    await engine.dispose()
