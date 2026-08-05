import asyncio
import uuid
from datetime import datetime
from sqlalchemy.future import select

from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, Recruiter, JobPosting, ScheduledInterview, InterviewSession
from app.api.v1.scheduling import get_candidate_schedule
from app.services.interview_service import EvaluationService

async def test_banner_persistence_and_completion_lifecycle():
    async with AsyncSessionLocal() as db:
        print("\n=======================================================")
        print("TESTING UPCOMING INTERVIEW BANNER PERSISTENCE LIFECYCLE")
        print("=======================================================")

        # 1. Setup Test Users
        cand_usr_id = f"test-usr-bannercand-{uuid.uuid4().hex[:8]}"
        cand_usr = User(
            id=cand_usr_id,
            email=f"bannercand_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="test_pwd_hash",
            full_name="Banner Test Candidate",
            role="candidate"
        )
        db.add(cand_usr)
        await db.flush()

        cand = Candidate(id=f"cand-{uuid.uuid4().hex[:8]}", user_id=cand_usr.id)
        db.add(cand)
        await db.flush()

        rec_usr_id = f"test-usr-bannerrec-{uuid.uuid4().hex[:8]}"
        rec_usr = User(
            id=rec_usr_id,
            email=f"bannerrec_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="test_pwd_hash",
            full_name="Banner Test Recruiter",
            role="recruiter"
        )
        db.add(rec_usr)
        await db.flush()

        rec = Recruiter(id=f"rec-{uuid.uuid4().hex[:8]}", user_id=rec_usr.id)
        db.add(rec)
        await db.flush()

        # Simulate prior completed mock practice session (unrelated)
        old_past_session = InterviewSession(
            id=f"sess-old-{uuid.uuid4().hex[:8]}",
            candidate_id=cand.id,
            title="Old Past Practice",
            status="completed"
        )
        db.add(old_past_session)
        await db.flush()
        await db.commit()

        # STEP 1: Recruiter schedules interview
        print("\n[STEP 1] Recruiter Schedules Technical Interview...")
        sched = ScheduledInterview(
            id=f"sched-banner-{uuid.uuid4().hex[:8]}",
            candidate_id=cand.id,
            recruiter_id=rec.id,
            round_type="Technical",
            scheduled_date=datetime.utcnow(),
            duration_minutes=30,
            status="Scheduled"
        )
        db.add(sched)
        await db.commit()
        print(f" -> Interview Scheduled (ID: {sched.id}, Status: {sched.status})")

        # STEP 2: Candidate Dashboard (First Load)
        print("\n[STEP 2] Candidate Dashboard First Load...")
        schedules_first = await get_candidate_schedule(user=cand_usr, db=db)
        print(f" -> Returned Schedules Count: {len(schedules_first)}")
        assert len(schedules_first) == 1, "Banner MUST appear on first dashboard load!"
        assert schedules_first[0]["id"] == sched.id, "Correct scheduled interview must be returned!"
        print(" -> Banner Appears [OK]")

        # STEP 3: Candidate Refreshes Page
        print("\n[STEP 3] Candidate Refreshes Page...")
        schedules_refresh = await get_candidate_schedule(user=cand_usr, db=db)
        print(f" -> Returned Schedules Count After Refresh: {len(schedules_refresh)}")
        assert len(schedules_refresh) == 1, "Banner MUST STILL appear after candidate refreshes page!"
        assert schedules_refresh[0]["id"] == sched.id, "Correct scheduled interview must be returned after refresh!"
        print(" -> Banner STILL Appears After Refresh [OK]")

        # STEP 4: Candidate Joins Interview Room & Starts Session
        print("\n[STEP 4] Candidate Joins Room & Starts Session...")
        new_session = InterviewSession(
            id=f"sess-live-{uuid.uuid4().hex[:8]}",
            candidate_id=cand.id,
            scheduled_interview_id=sched.id,
            title="Live Technical Interview",
            status="active"
        )
        db.add(new_session)
        sched.session_id = new_session.id
        sched.status = "In Progress"
        await db.commit()

        schedules_in_progress = await get_candidate_schedule(user=cand_usr, db=db)
        print(f" -> Schedules Count During Interview: {len(schedules_in_progress)}")
        assert len(schedules_in_progress) == 1, "Banner should remain available during active interview!"

        # STEP 5: Interview Completes & Report Finalized
        print("\n[STEP 5] Interview Completes & Report Finalized...")
        new_session.status = "completed"
        sched.status = "Completed"
        await db.commit()

        # STEP 6: Candidate Returns to Dashboard (Banner Disappears)
        print("\n[STEP 6] Candidate Returns to Dashboard After Completion...")
        schedules_completed = await get_candidate_schedule(user=cand_usr, db=db)
        print(f" -> Returned Schedules Count After Completion: {len(schedules_completed)}")
        assert len(schedules_completed) == 0, "Banner MUST disappear after interview completion!"
        print(" -> Banner Disappears After Completion [OK]")

        print("\n=======================================================")
        print("BANNER PERSISTENCE & COMPLETION LIFECYCLE: 100% PASSED!")
        print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(test_banner_persistence_and_completion_lifecycle())
