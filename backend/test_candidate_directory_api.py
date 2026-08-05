import asyncio
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, Recruiter
from app.services.auth_service import AuthService
from app.api.v1.recruiter import get_recruiter_stats, get_registered_candidates

async def test_recruiter_data():
    print("=========================================================================")
    print("=== RECRUITER CANDIDATE DATA SYNCHRONIZATION DIAGNOSTIC TEST ===")
    print("=========================================================================\n")

    async with AsyncSessionLocal() as db:
        # 1. DB Row Count
        res_u = await db.execute(select(User).where(User.role == "candidate", User.deleted_at == None))
        cand_users = res_u.scalars().all()
        print(f"[POSTGRESQL] 1. Candidate Users Count (users table): {len(cand_users)}")
        for u in cand_users:
            print(f"   - Candidate ID: {u.id} | Email: {u.email} | Name: {u.full_name} | Active: {u.is_active}")

        res_c = await db.execute(select(Candidate))
        cand_rows = res_c.scalars().all()
        print(f"[POSTGRESQL] 2. Candidates Table Rows Count: {len(cand_rows)}")

        # 2. Get a Recruiter User
        res_r = await db.execute(select(User).where(User.role == "recruiter", User.deleted_at == None))
        rec_user = res_r.scalars().first()
        if not rec_user:
            auth_service = AuthService(db)
            res_reg = await auth_service.register_user(
                email="rec_test_sync@smarthire.ai", password="Password123!", full_name="Recruiter Sync Verifier", role="recruiter"
            )
            res_r = await db.execute(select(User).where(User.id == res_reg["user"]["id"]))
            rec_user = res_r.scalar_one()

        print(f"\n[ORCHESTRATION] Using Recruiter User: {rec_user.email} ({rec_user.id})")

        # 3. Test get_recruiter_stats
        stats = await get_recruiter_stats(user=rec_user, db=db)
        print(f"\n[SERVICE/ORM LAYER] get_recruiter_stats output:")
        print(f"   total_candidates: {stats.get('total_candidates')}")
        print(f"   jobs_posted: {stats.get('jobs_posted')}")
        print(f"   applications_received: {stats.get('applications_received')}")

        # 4. Test get_registered_candidates
        cands_list = await get_registered_candidates(db=db)
        print(f"\n[SERVICE/ORM LAYER] get_registered_candidates output count: {len(cands_list)}")
        for idx, item in enumerate(cands_list):
            print(f"   [{idx+1}] Candidate ID: {item.get('id')} | User ID: {item.get('user_id')} | Name: {item.get('full_name')} | Email: {item.get('email')} | Status: {item.get('status')}")

        assert stats.get('total_candidates') == len(cand_users), f"Mismatch in total_candidates! Expected {len(cand_users)}, got {stats.get('total_candidates')}"
        assert len(cands_list) == len(cand_users), f"Mismatch in candidate directory list! Expected {len(cand_users)}, got {len(cands_list)}"

        print("\n=========================================================================")
        print("[PASS] DATA SYNCHRONIZATION FROM POSTGRESQL TO RECRUITER WORKSPACE VERIFIED")
        print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(test_recruiter_data())
