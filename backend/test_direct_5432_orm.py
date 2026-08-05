import asyncio
from app.core.db import AsyncSessionLocal
from app.api.v1.recruiter import get_registered_candidates, get_recruiter_stats
from app.models.domain import User
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == "recruiter"))
        rec_user = res.scalars().first()
        
        res_cand = await db.execute(select(User).where(User.role == "candidate"))
        cands_in_db = res_cand.scalars().all()
        print(f"[DIRECT DB 5432] Total Candidate Users in Postgres 5432: {len(cands_in_db)}")
        
        stats = await get_recruiter_stats(user=rec_user, db=db)
        print(f"[DIRECT SERVICE 5432] get_recruiter_stats output: {stats}")
        
        cand_list = await get_registered_candidates(db=db)
        print(f"[DIRECT SERVICE 5432] get_registered_candidates output count: {len(cand_list)}")
        
        for idx, c in enumerate(cand_list[:5]):
            print(f"   [{idx+1}] {c.get('full_name')} ({c.get('email')}) - Status: {c.get('status')}")

if __name__ == "__main__":
    asyncio.run(main())
