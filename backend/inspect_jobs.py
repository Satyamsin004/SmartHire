import asyncio
from sqlalchemy import select, text
from app.core.db import AsyncSessionLocal
from app.models.domain import JobPosting

async def inspect_and_clean():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(JobPosting))
        jobs = res.scalars().all()
        print(f"Total jobs before purge: {len(jobs)}")
        for j in jobs:
            print(f"  {j.id} | Title: {j.title} | Company: {j.company_name} | Status: {j.status}")

if __name__ == "__main__":
    asyncio.run(inspect_and_clean())
