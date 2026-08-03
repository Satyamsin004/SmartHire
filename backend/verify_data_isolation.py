import asyncio
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, InterviewSession
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        res_u = await db.execute(select(User))
        users = res_u.scalars().all()
        print('✓ REGISTERED USERS:', [(u.full_name, u.email, u.role) for u in users])

        res_c = await db.execute(select(Candidate))
        cands = res_c.scalars().all()
        print(f'✓ TOTAL CANDIDATES IN DB: {len(cands)}')

        for c in cands:
            res_user = await db.execute(select(User).where(User.id == c.user_id))
            u = res_user.scalar_one_or_none()
            name = u.full_name if u else "Unknown User"
            
            res_sess = await db.execute(select(InterviewSession).where(InterviewSession.candidate_id == c.id))
            sessions = res_sess.scalars().all()
            print(f'  Candidate "{name}" (id: {c.id}) -> Sessions: {len(sessions)}')

if __name__ == '__main__':
    asyncio.run(main())
