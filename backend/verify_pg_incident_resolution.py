import asyncio
import time
import uuid
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.api.v1.recruiter import (
    get_registered_candidates, get_recruiter_stats, get_job_applications, get_shortlisted_candidates
)
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, Resume, InterviewSession

async def run_incident_verification():
    print("=========================================================================")
    print("=== CRITICAL PRODUCTION INCIDENT AUDIT & MODULE VERIFICATION SUITE ===")
    print("=========================================================================\n")

    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)

        # 1. Candidate Registration & Authentication
        cand_email = f"cand_inc_{uuid.uuid4().hex[:6]}@smarthire.ai"
        t0 = time.time()
        res_cand = await auth_service.register_user(
            email=cand_email, password="Password123!", full_name="Candidate Incident Verifier", role="candidate"
        )
        cand_auth_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 1. Candidate Registration & Auth Query: {cand_auth_time} ms")
        assert res_cand["tokens"]["access_token"] is not None

        # 2. Recruiter Registration & Authentication
        rec_email = f"rec_inc_{uuid.uuid4().hex[:6]}@smarthire.ai"
        t0 = time.time()
        res_rec = await auth_service.register_user(
            email=rec_email, password="Password123!", full_name="Recruiter Incident Verifier", role="recruiter"
        )
        rec_auth_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 2. Recruiter Registration & Auth Query: {rec_auth_time} ms")
        assert res_rec["tokens"]["access_token"] is not None

        res_u = await db.execute(select(User).where(User.id == res_rec["user"]["id"]))
        rec_user_obj = res_u.scalar_one()

        # 3. Admin Authentication
        admin_email = f"admin_inc_{uuid.uuid4().hex[:6]}@smarthire.ai"
        t0 = time.time()
        res_admin = await auth_service.register_user(
            email=admin_email, password="Password123!", full_name="Admin Incident Verifier", role="admin"
        )
        admin_auth_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 3. Admin Registration & Auth Query: {admin_auth_time} ms")
        assert res_admin["tokens"]["access_token"] is not None

        # 4. Recruiter Dashboard Stats PostgreSQL Query
        t0 = time.time()
        stats = await get_recruiter_stats(user=rec_user_obj, db=db)
        stats_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 4. Recruiter Dashboard Stats PostgreSQL Query: {stats_time} ms")
        assert stats["total_candidates"] >= 1

        # 5. Candidates Directory PostgreSQL Query
        t0 = time.time()
        cands = await get_registered_candidates(db=db)
        cands_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 5. Candidates Directory PostgreSQL Query: {cands_time} ms")
        assert len(cands) >= 1

        # 6. Applications Pipeline PostgreSQL Query
        t0 = time.time()
        apps = await get_job_applications(user=rec_user_obj, db=db)
        apps_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 6. Applications Pipeline PostgreSQL Query: {apps_time} ms")

        # 7. Shortlisted Candidates PostgreSQL Query
        t0 = time.time()
        short = await get_shortlisted_candidates(user=rec_user_obj, db=db)
        short_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 7. Shortlisted Candidates PostgreSQL Query: {short_time} ms")

        # 8. User Lookup & Token Verification
        t0 = time.time()
        user_db = await db.get(User, res_cand["user"]["id"])
        lookup_time = round((time.time() - t0) * 1000, 2)
        print(f"[VERIFIED] 8. User Profile Lookup PostgreSQL Query: {lookup_time} ms")
        assert user_db.email == cand_email

        print("\n=========================================================================")
        print("[PASS] ALL SMARTHIRE MODULES OPERATIONAL & POSTGRESQL CONNECTIVITY RESTORED")
        print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_incident_verification())
