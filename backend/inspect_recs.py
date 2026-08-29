import asyncio
from app.core.db import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.domain import InterviewRecording, InterviewSession

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(InterviewRecording))
        recs = res.scalars().all()
        print(f"Total recordings in DB: {len(recs)}")
        for r in recs:
            print(f"REC ID: {r.id} | Session: {r.session_id} | Path: {r.file_path} | Size: {r.file_size} | Status: {r.status}")

        res_s = await session.execute(select(InterviewSession).order_by(InterviewSession.created_at.desc()))
        sessions = res_s.scalars().all()
        print(f"\nTotal sessions in DB: {len(sessions)}")
        for s in sessions[:5]:
            print(f"SESSION ID: {s.id} | Status: {s.status} | RecStatus: {s.recording_status} | Title: {s.title}")

if __name__ == "__main__":
    asyncio.run(main())
