import asyncio
import time
import uuid
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal, engine, Base
from app.services.auth_service import AuthService
from app.models.domain import User

async def run_auth_incident_verification():
    print("=========================================================================")
    print("=== CRITICAL PRODUCTION INCIDENT AUDIT & AUTHENTICATION BENCHMARKS ===")
    print("=========================================================================\n")

    # 1. Database Connection & Schema Verification
    t0 = time.time()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db_conn_time = round((time.time() - t0) * 1000, 2)
    print(f"[BENCHMARK] 1. PostgreSQL Database Connection Time: {db_conn_time} ms")

    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)

        # 2. Register Test User
        email = f"prod_auth_{uuid.uuid4().hex[:6]}@smarthire.ai"
        password = "ProductionPassword123!"
        
        t0 = time.time()
        reg_res = await auth_service.register_user(
            email=email,
            password=password,
            full_name="Production Verification User",
            role="recruiter"
        )
        reg_time = round((time.time() - t0) * 1000, 2)
        print(f"[BENCHMARK] 2. User Registration & Session Creation Time: {reg_time} ms")

        # 3. Measure User Lookup + Password Verification + JWT Generation Time
        t0 = time.time()
        auth_res = await auth_service.authenticate_user(email=email, password=password)
        auth_time = round((time.time() - t0) * 1000, 2)
        print(f"[BENCHMARK] 3. Auth Lookup + JWT Generation Time: {auth_time} ms (Target < 200 ms)")

        assert auth_res["tokens"]["access_token"] is not None, "Access token missing!"
        assert auth_res["user"]["email"] == email, "User email mismatch!"

        # 4. Stress Test: Multiple Sequential Logins to Ensure Connection Pool Health
        t0 = time.time()
        for i in range(10):
            res = await auth_service.authenticate_user(email=email, password=password)
            assert res["tokens"]["access_token"] is not None
        multi_login_latency = round(((time.time() - t0) / 10.0) * 1000, 2)
        print(f"[BENCHMARK] 4. Multi-Login Average Latency (10 runs): {multi_login_latency} ms")

    print("\n=========================================================================")
    print("[PASS] AUTHENTICATION & POSTGRESQL CONNECTIVITY RESOLVED SUCCESSFULLY!")
    print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_auth_incident_verification())
