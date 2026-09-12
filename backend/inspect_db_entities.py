import asyncio
import os
import sys

root_dir = os.path.dirname(os.path.abspath(__file__))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, JobPosting, JobApplication, ScheduledInterview, InterviewSession, InterviewRecording, OfferLetter, ScoringReport

async def inspect():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        print(f"TOTAL USERS: {len(users)}")
        for u in users:
            if "satyam" in (u.email or "").lower() or "satyam" in (u.full_name or "").lower() or "test" in (u.email or "").lower() or "e2e" in (u.email or "").lower() or "e2e" in (u.full_name or "").lower():
                print(f"User: id={u.id}, email={u.email}, name={u.full_name}, role={u.role}, is_test={u.is_test_data}")
        
        cands = (await db.execute(select(Candidate))).scalars().all()
        print(f"\nTOTAL CANDIDATES: {len(cands)}")
        for c in cands:
            u = (await db.execute(select(User).where(User.id == c.user_id))).scalar_one_or_none()
            name = u.full_name if u else "Unknown"
            email = u.email if u else "Unknown"
            if "satyam" in name.lower() or "e2e" in name.lower() or "test" in name.lower():
                print(f"Candidate: id={c.id}, user_id={c.user_id}, name={name}, email={email}, target_role={c.target_role}")
            
        apps = (await db.execute(select(JobApplication))).scalars().all()
        print(f"\nTOTAL APPLICATIONS: {len(apps)}")
        for a in apps:
            c = (await db.execute(select(Candidate).where(Candidate.id == a.candidate_id))).scalar_one_or_none()
            u = (await db.execute(select(User).where(User.id == c.user_id))).scalar_one_or_none() if c else None
            name = u.full_name if u else "Unknown"
            email = u.email if u else "Unknown"
            j = (await db.execute(select(JobPosting).where(JobPosting.id == a.job_id))).scalar_one_or_none()
            job_title = j.title if j else "Unknown"
            print(f"App: id={a.id}, cand_id={a.candidate_id}, user_id={u.id if u else None}, name={name} ({email}), job='{job_title}' (job_id={a.job_id}), status={a.status}")
            
        pass

if __name__ == "__main__":
    asyncio.run(inspect())
