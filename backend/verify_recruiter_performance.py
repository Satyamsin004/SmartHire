import asyncio
import time
import uuid
from sqlalchemy.future import select
from app.core.db import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.api.v1.recruiter import (
    get_registered_candidates, get_recruiter_stats, get_job_applications,
    get_shortlisted_candidates
)
from app.models.domain import User, Candidate, Recruiter

async def run_performance_audit():
    print("=========================================================================")
    print("=== RECRUITER WORKSPACE PERFORMANCE AUDIT & PAGE LATENCY METRICS ===")
    print("=========================================================================\n")

    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)

        # Create recruiter context for benchmark
        rec_email = f"perf_rec_{uuid.uuid4().hex[:6]}@smarthire.ai"
        res_rec = await auth_service.register_user(
            email=rec_email,
            password="Password123!",
            full_name="Performance Audit Recruiter",
            role="recruiter"
        )
        res_u = await db.execute(select(User).where(User.id == res_rec["user"]["id"]))
        rec_user_obj = res_u.scalar_one()

        # 1. Benchmark: Registered Candidates Directory Endpoint (< 2000 ms)
        t0 = time.time()
        for _ in range(5):
            cands = await get_registered_candidates(db=db)
        cands_latency = round(((time.time() - t0) / 5.0) * 1000, 2)
        print(f"[BENCHMARK] 1. Candidates Directory API Latency: {cands_latency} ms (Target < 2000 ms)")
        assert cands_latency < 2000.0, f"Candidates page load time too slow: {cands_latency} ms"

        # 2. Benchmark: Recruiter Stats & Dashboard Metrics Endpoint (< 2000 ms)
        t0 = time.time()
        for _ in range(5):
            stats = await get_recruiter_stats(user=rec_user_obj, db=db)
        stats_latency = round(((time.time() - t0) / 5.0) * 1000, 2)
        print(f"[BENCHMARK] 2. Recruiter Dashboard Stats API Latency: {stats_latency} ms (Target < 2000 ms)")
        assert stats_latency < 2000.0, f"Dashboard load time too slow: {stats_latency} ms"

        # 3. Benchmark: Job Applications Pipeline Endpoint (< 2000 ms)
        t0 = time.time()
        for _ in range(5):
            apps = await get_job_applications(user=rec_user_obj, db=db)
        apps_latency = round(((time.time() - t0) / 5.0) * 1000, 2)
        print(f"[BENCHMARK] 3. Job Applications Pipeline API Latency: {apps_latency} ms (Target < 2000 ms)")
        assert apps_latency < 2000.0, f"Applications page load time too slow: {apps_latency} ms"

        # 4. Benchmark: Shortlisted Candidates Endpoint (< 2000 ms)
        t0 = time.time()
        for _ in range(5):
            short = await get_shortlisted_candidates(user=rec_user_obj, db=db)
        short_latency = round(((time.time() - t0) / 5.0) * 1000, 2)
        print(f"[BENCHMARK] 4. Shortlisted Candidates API Latency: {short_latency} ms (Target < 2000 ms)")
        assert short_latency < 2000.0, f"Shortlisted page load time too slow: {short_latency} ms"

        print("\n=========================================================================")
        print("[PASS] ALL RECRUITER WORKSPACE PAGES LOAD IN UNDER 2 SECONDS!")
        print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_performance_audit())
