import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.core.db import get_engine, Base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, InterviewSession, ScoringReport
from app.services.analytics_service import analytics_service


@pytest.mark.asyncio
async def test_analytics_api_endpoints_and_rbac():
    """Validates HTTP 200 for authorized endpoints and HTTP 403 for unauthorized roles."""
    import uuid
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    uid = uuid.uuid4().hex[:8]
    async with async_session() as db:
        # 1. Candidate User
        cand_user = User(
            email=f"cand_api_{uid}@smarthire.ai",
            password_hash="pwd",
            full_name="Candidate API Test",
            role="candidate"
        )
        db.add(cand_user)
        await db.flush()
        cand = Candidate(user_id=cand_user.id, target_role="Software Engineer")
        db.add(cand)

        # 2. Recruiter User
        rec_user = User(
            email=f"rec_api_{uid}@smarthire.ai",
            password_hash="pwd",
            full_name="Recruiter API Test",
            role="recruiter"
        )
        db.add(rec_user)
        await db.flush()
        rec = Recruiter(user_id=rec_user.id, company_name="Test Corp")
        db.add(rec)
        await db.flush()

        job = JobPosting(recruiter_id=rec.id, title="Test Job", description="Description")
        db.add(job)
        await db.commit()

        cand_token = create_access_token(cand_user.id, cand_user.email, "candidate")
        rec_token = create_access_token(rec_user.id, rec_user.email, "recruiter")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Candidate gets own trends -> 200 OK
        resp_trends = await client.get(
            "/api/v1/analytics/candidate/trends",
            headers={"Authorization": f"Bearer {cand_token}"}
        )
        assert resp_trends.status_code == 200
        data_trends = resp_trends.json()
        assert "overall_trend" in data_trends
        assert "timeline" in data_trends

        # Candidate gets own weak areas -> 200 OK
        resp_weak = await client.get(
            "/api/v1/analytics/candidate/weak-areas",
            headers={"Authorization": f"Bearer {cand_token}"}
        )
        assert resp_weak.status_code == 200
        data_weak = resp_weak.json()
        assert "weak_areas" in data_weak

        # Candidate tries to access recruiter ranking -> 403 Forbidden!
        resp_rank_forbidden = await client.get(
            "/api/v1/analytics/candidates/ranking",
            headers={"Authorization": f"Bearer {cand_token}"}
        )
        assert resp_rank_forbidden.status_code == 403

        # Recruiter accesses ranking -> 200 OK
        resp_rank = await client.get(
            "/api/v1/analytics/candidates/ranking",
            headers={"Authorization": f"Bearer {rec_token}"}
        )
        assert resp_rank.status_code == 200
        data_rank = resp_rank.json()
        assert "ranking" in data_rank
        assert "tie_breaking_order" in data_rank


@pytest.mark.asyncio
async def test_real_database_consistency_satyam():
    """Validates data consistency with actual completed interviews in smarthire.db.
    Ensures Database score == Analytics score without discrepancy.
    """
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Check Satyam Singh
        res = await db.execute(select(Candidate).where(Candidate.id == "1f2a3df2-0a84-4ce7-b870-2de702f6019b"))
        cand = res.scalars().first()
        if not cand:
            pytest.skip("Satyam Singh candidate not present in active DB test environment.")

        # Query authoritative latest scoring report directly from DB
        stmt = (
            select(ScoringReport)
            .join(InterviewSession, ScoringReport.session_id == InterviewSession.id)
            .where(InterviewSession.candidate_id == cand.id)
            .where(InterviewSession.status.in_(["completed", "Completed"]))
            .order_by(InterviewSession.started_at.asc(), ScoringReport.created_at.asc())
        )
        reports = (await db.execute(stmt)).scalars().all()
        assert len(reports) > 0

        latest_db_report = reports[-1]
        expected_latest_score = round(latest_db_report.overall_score, 1)

        # Call analytics service
        trends = await analytics_service.get_candidate_performance_trends(db, cand.id)
        assert trends["total_interviews"] == len(reports)
        assert trends["summary"]["latest_score"] == expected_latest_score

        # Verify weak areas derive from actual records without fabrication
        weak = await analytics_service.get_candidate_weak_areas(db, cand.id)
        assert weak["total_interviews"] == len(reports)
        for w in weak["weak_areas"]:
            assert w["weak_occurrences"] >= 1
            assert w["average_score"] is not None
            assert w["latest_score"] is not None
            assert w["recommendation"] is not None
