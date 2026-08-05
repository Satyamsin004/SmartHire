import asyncio
import httpx
import uuid
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.models.domain import User

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def trace_recruiter_data_flow():
    print("=== TRACING RECRUITER DATA FLOW FROM POSTGRESQL TO API ===")
    
    # 1. PostgreSQL DB Query
    async with AsyncSessionLocal() as db:
        res_cand = await db.execute(select(User).where(User.role == "candidate", User.deleted_at == None))
        db_candidates = res_cand.scalars().all()
        print(f"1. PostgreSQL Candidate Users Count: {len(db_candidates)}")
        for u in db_candidates:
            print(f"   - User ID: {u.id} | Email: {u.email} | Name: {u.full_name} | Role: {u.role} | Active: {u.is_active}")

        auth_service = AuthService(db)
        rec_email = f"rec_trace_{uuid.uuid4().hex[:6]}@smarthire.ai"
        res_rec = await auth_service.register_user(
            email=rec_email, password="Password123!", full_name="Recruiter Data Flow Verifier", role="recruiter"
        )
        print(f"\n2. Registered Recruiter Test Account: {rec_email}")

    # 2. HTTP API Call using Recruiter credentials
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # Login recruiter
        r_login = await client.post("/auth/login", json={"email": rec_email, "password": "Password123!"})
        if r_login.status_code != 200:
            print(f"Recruiter login failed: {r_login.text}")
            return
        token = r_login.json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Fetch recruiter stats
        r_stats = await client.get("/recruiter/stats", headers=headers)
        print(f"\n3. API /recruiter/stats Response (Status {r_stats.status_code}):")
        print(f"   Payload: {r_stats.json()}")

        # Fetch registered candidates
        r_candidates = await client.get("/recruiter/registered-candidates", headers=headers)
        candidates_data = r_candidates.json()
        print(f"\n4. API /recruiter/registered-candidates Response (Status {r_candidates.status_code}):")
        print(f"   Returned Candidates Count: {len(candidates_data)}")
        for idx, c in enumerate(candidates_data):
            print(f"   [{idx+1}] ID: {c.get('id')} | Name: {c.get('full_name')} | Email: {c.get('email')} | Status: {c.get('status')} | Account: {c.get('account_status')}")

if __name__ == "__main__":
    asyncio.run(trace_recruiter_data_flow())
