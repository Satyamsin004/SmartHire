import asyncio
import uuid
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.api.v1.recruiter import (
    get_registered_candidates, get_recruiter_stats, shortlist_candidate,
    send_candidate_message, get_candidate_applications
)
from app.models.domain import User, Candidate, Recruiter

async def run_direct_verification():
    """VERIFICATION SUITE: Test Recruiter Candidates Directory & Separation from Applications."""
    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)
        
        # 1. Register Candidate A (no application)
        cand_a_email = f"cand_alpha_{uuid.uuid4().hex[:6]}@smarthire.ai"
        res_a = await auth_service.register_user(
            email=cand_a_email,
            password="Password123!",
            full_name="Candidate Alpha",
            role="candidate"
        )
        user_a_id = res_a["user"]["id"]
        
        # 2. Register Candidate B (no application)
        cand_b_email = f"cand_beta_{uuid.uuid4().hex[:6]}@smarthire.ai"
        res_b = await auth_service.register_user(
            email=cand_b_email,
            password="Password123!",
            full_name="Candidate Beta",
            role="candidate"
        )
        user_b_id = res_b["user"]["id"]
        
        # 3. Create recruiter user for auth context
        rec_email = f"rec_partner_{uuid.uuid4().hex[:6]}@smarthire.ai"
        res_rec = await auth_service.register_user(
            email=rec_email,
            password="Password123!",
            full_name="Recruiter Partner",
            role="recruiter"
        )
        res_u = await db.execute(select(User).where(User.id == res_rec["user"]["id"]))
        rec_user_obj = res_u.scalar_one()

        # 4. Fetch registered candidates directory directly from PostgreSQL DB logic
        cands_list = await get_registered_candidates(db=db)
        emails = [c["email"] for c in cands_list]
        
        assert cand_a_email in emails, "Candidate Alpha not in registered candidates!"
        assert cand_b_email in emails, "Candidate Beta not in registered candidates!"
        
        cand_a_record = next(c for c in cands_list if c["email"] == cand_a_email)
        cand_b_record = next(c for c in cands_list if c["email"] == cand_b_email)
        
        # Neither candidate has applied yet
        assert cand_a_record["application_count"] == 0, "Candidate Alpha applications should be 0"
        assert cand_b_record["application_count"] == 0, "Candidate Beta applications should be 0"
        
        # 5. Fetch Recruiter Stats counter directly
        stats = await get_recruiter_stats(user=rec_user_obj, db=db)
        assert stats["total_candidates"] >= 2, f"Total candidates counter should be >= 2, got {stats['total_candidates']}"
        
        # 6. Test Search by Name
        search_res = await get_registered_candidates(search="Candidate Alpha", db=db)
        search_emails = [c["email"] for c in search_res]
        assert cand_a_email in search_emails, "Search should return Candidate Alpha"
        assert cand_b_email not in search_emails, "Search should not return Candidate Beta"
        
        # 7. Test Actions
        res_short = await shortlist_candidate(candidate_id=cand_a_record["id"], db=db)
        assert res_short["status"] == "success"
        
        res_apps = await get_candidate_applications(candidate_id=cand_a_record["id"], db=db)
        assert len(res_apps) == 0, "Candidate A should have 0 applications"

        print("\n========================================================")
        print("[PASS] RECRUITER CANDIDATES WORKFLOW VERIFICATION REPORT")
        print("========================================================")
        print(f"• Candidate Alpha Registered: {cand_a_email}")
        print(f"• Candidate Beta Registered: {cand_b_email}")
        print(f"• Both candidates immediately appear in Candidates directory: YES")
        print(f"• Applications count for both candidates: 0")
        print(f"• Dashboard Total Candidates counter: {stats['total_candidates']}")
        print(f"• Dashboard Job Applications counter: {stats['applications_received']}")
        print(f"• PostgreSQL Single Source of Truth verified: YES")
        print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(run_direct_verification())
