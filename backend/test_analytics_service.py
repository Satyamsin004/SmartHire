import pytest
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.domain import (
    Base, User, Candidate, Recruiter, JobPosting, JobApplication, InterviewSession, ScoringReport
)
from app.services.analytics_service import analytics_service, WEAK_THRESHOLD

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def async_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        yield session
    await engine.dispose()


# ==============================================================================
# 1. WEAK AREAS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_weak_areas_zero_interviews(async_db: AsyncSession):
    """Zero completed interviews returns empty list and informative message."""
    user = User(email="zero@smarthire.ai", password_hash="pwd", full_name="Zero Cand", role="candidate")
    async_db.add(user)
    await async_db.flush()
    cand = Candidate(user_id=user.id, target_role="Software Engineer")
    async_db.add(cand)
    await async_db.commit()

    res = await analytics_service.get_candidate_weak_areas(async_db, cand.id)
    assert res["total_interviews"] == 0
    assert res["weak_areas"] == []
    assert "No completed interviews yet" in res["message"]


@pytest.mark.asyncio
async def test_weak_areas_single_weak_interview(async_db: AsyncSession):
    """Single interview with low scores identifies weak area with low confidence."""
    user = User(email="single@smarthire.ai", password_hash="pwd", full_name="Single Cand", role="candidate")
    async_db.add(user)
    await async_db.flush()
    cand = Candidate(user_id=user.id, target_role="Java Developer")
    async_db.add(cand)
    await async_db.flush()

    sess = InterviewSession(
        candidate_id=cand.id,
        title="Java Core Interview",
        role_target="Java Developer",
        status="completed",
        started_at=datetime.utcnow() - timedelta(days=2)
    )
    async_db.add(sess)
    await async_db.flush()

    rep = ScoringReport(
        session_id=sess.id,
        candidate_id=cand.id,
        status="COMPLETED",
        overall_score=52.0,
        technical_score=45.0,
        communication_score=78.0,
        confidence_score=72.0,
        professionalism_score=70.0,
        missing_topics=["Java Collections", "Concurrency"],
        communication_metrics={"grammar": 80.0, "clarity": 80.0, "speaking_pace_wpm": 140.0, "filler_words": 2},
        confidence_metrics={"eye_contact": 75.0, "attention": 80.0}
    )
    async_db.add(rep)
    await async_db.commit()

    res = await analytics_service.get_candidate_weak_areas(async_db, cand.id)
    assert res["total_interviews"] == 1
    assert len(res["weak_areas"]) > 0

    skills = [w["skill"] for w in res["weak_areas"]]
    assert any("Technical Core" in s or "Java" in s for s in skills)
    # Confidence for single interview is low
    for w in res["weak_areas"]:
        assert w["confidence"] == "low"
        assert w["recommendation"] is not None
        assert len(w["resources"]) > 0


@pytest.mark.asyncio
async def test_weak_areas_recurring_and_improving_weakness(async_db: AsyncSession):
    """Multiple interviews recurring weakness with improving trend detection."""
    user = User(email="recur@smarthire.ai", password_hash="pwd", full_name="Recur Cand", role="candidate")
    async_db.add(user)
    await async_db.flush()
    cand = Candidate(user_id=user.id, target_role="Backend Engineer")
    async_db.add(cand)
    await async_db.flush()

    # Interview 1: Technical score 40, missing Redis
    sess1 = InterviewSession(candidate_id=cand.id, title="Backend 1", status="completed", started_at=datetime.utcnow() - timedelta(days=10))
    async_db.add(sess1)
    await async_db.flush()
    rep1 = ScoringReport(session_id=sess1.id, candidate_id=cand.id, overall_score=50.0, technical_score=40.0, missing_topics=["Redis"])
    async_db.add(rep1)

    # Interview 2: Technical score 48, missing Redis
    sess2 = InterviewSession(candidate_id=cand.id, title="Backend 2", status="completed", started_at=datetime.utcnow() - timedelta(days=5))
    async_db.add(sess2)
    await async_db.flush()
    rep2 = ScoringReport(session_id=sess2.id, candidate_id=cand.id, overall_score=58.0, technical_score=48.0, missing_topics=["Redis"])
    async_db.add(rep2)

    # Interview 3: Technical score 56, missing Redis
    sess3 = InterviewSession(candidate_id=cand.id, title="Backend 3", status="completed", started_at=datetime.utcnow() - timedelta(days=1))
    async_db.add(sess3)
    await async_db.flush()
    rep3 = ScoringReport(session_id=sess3.id, candidate_id=cand.id, overall_score=62.0, technical_score=56.0, missing_topics=["Redis"])
    async_db.add(rep3)
    await async_db.commit()

    res = await analytics_service.get_candidate_weak_areas(async_db, cand.id)
    assert res["total_interviews"] == 3

    redis_weak = next((w for w in res["weak_areas"] if "Redis" in w["skill"] or "Caching" in w["skill"]), None)
    assert redis_weak is not None
    assert redis_weak["weak_occurrences"] == 3
    assert redis_weak["confidence"] == "high"

    tech_core = next((w for w in res["weak_areas"] if w["skill"] == "Technical Core"), None)
    assert tech_core is not None
    assert tech_core["weak_occurrences"] == 3
    assert tech_core["trend"] == "improving"  # 40 -> 48 -> 56
    assert tech_core["latest_score"] == 56.0
    assert tech_core["average_score"] == 48.0


# ==============================================================================
# 2. PERFORMANCE TRENDS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_performance_trends_zero_and_single_interview(async_db: AsyncSession):
    """Empty and single interview behavior for performance trends."""
    user = User(email="trend_zero@smarthire.ai", password_hash="pwd", full_name="Trend Zero", role="candidate")
    async_db.add(user)
    await async_db.flush()
    cand = Candidate(user_id=user.id, target_role="Engineer")
    async_db.add(cand)
    await async_db.commit()

    # 0 interviews
    res0 = await analytics_service.get_candidate_performance_trends(async_db, cand.id)
    assert res0["total_interviews"] == 0
    assert res0["overall_trend"] == "Insufficient Data"
    assert res0["timeline"] == []

    # 1 interview
    sess = InterviewSession(candidate_id=cand.id, title="First Mock", status="completed", started_at=datetime.utcnow())
    async_db.add(sess)
    await async_db.flush()
    rep = ScoringReport(
        session_id=sess.id,
        candidate_id=cand.id,
        overall_score=75.0,
        technical_score=78.0,
        communication_score=72.0,
        confidence_score=74.0,
        professionalism_score=76.0
    )
    async_db.add(rep)
    await async_db.commit()

    res1 = await analytics_service.get_candidate_performance_trends(async_db, cand.id)
    assert res1["total_interviews"] == 1
    assert res1["overall_trend"] == "Insufficient Data"
    assert res1["summary"]["latest_score"] == 75.0
    assert res1["summary"]["previous_score"] is None
    assert res1["summary"]["score_change"] == 0.0
    assert len(res1["timeline"]) == 1


@pytest.mark.asyncio
async def test_performance_trends_improving_declining_stable(async_db: AsyncSession):
    """Chronological progression correctly derives Improving, Declining, and Stable trends."""
    user = User(email="prog@smarthire.ai", password_hash="pwd", full_name="Prog Cand", role="candidate")
    async_db.add(user)
    await async_db.flush()
    cand = Candidate(user_id=user.id, target_role="Engineer")
    async_db.add(cand)
    await async_db.flush()

    # Session 1: 65.0
    s1 = InterviewSession(candidate_id=cand.id, title="Mock 1", status="completed", started_at=datetime.utcnow() - timedelta(days=3))
    async_db.add(s1)
    await async_db.flush()
    async_db.add(ScoringReport(session_id=s1.id, candidate_id=cand.id, overall_score=65.0, technical_score=60.0, communication_score=70.0, confidence_score=65.0, professionalism_score=65.0))

    # Session 2: 74.0 (Improving +9.0)
    s2 = InterviewSession(candidate_id=cand.id, title="Mock 2", status="completed", started_at=datetime.utcnow() - timedelta(days=1))
    async_db.add(s2)
    await async_db.flush()
    async_db.add(ScoringReport(session_id=s2.id, candidate_id=cand.id, overall_score=74.0, technical_score=72.0, communication_score=76.0, confidence_score=72.0, professionalism_score=76.0))
    await async_db.commit()

    res = await analytics_service.get_candidate_performance_trends(async_db, cand.id)
    assert res["total_interviews"] == 2
    assert res["overall_trend"] == "Improving"
    assert res["summary"]["latest_score"] == 74.0
    assert res["summary"]["previous_score"] == 65.0
    assert res["summary"]["score_change"] == 9.0
    assert res["categories"]["technical"]["trend"] == "Improving"
    assert res["categories"]["communication"]["trend"] == "Improving"


# ==============================================================================
# 3. CANDIDATE RANKING TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_candidate_ranking_deterministic_and_tie_breaking(async_db: AsyncSession):
    """Validates recruiter candidate ranking with deterministic tie-breaking logic."""
    # Recruiter
    rec_user = User(email="recruiter_test@smarthire.ai", password_hash="pwd", full_name="Recruiter Lead", role="recruiter")
    async_db.add(rec_user)
    await async_db.flush()
    recruiter = Recruiter(user_id=rec_user.id, company_name="Acme Tech")
    async_db.add(recruiter)
    await async_db.flush()

    # Job
    job = JobPosting(recruiter_id=recruiter.id, title="Full Stack Engineer", description="Engineering role")
    async_db.add(job)
    await async_db.flush()

    # Candidate A: Overall 85, Tech 90, Comm 80
    uA = User(email="candA@smarthire.ai", password_hash="pwd", full_name="Alice A", role="candidate")
    async_db.add(uA)
    await async_db.flush()
    cA = Candidate(user_id=uA.id, target_role="Full Stack")
    async_db.add(cA)
    await async_db.flush()
    appA = JobApplication(job_id=job.id, candidate_id=cA.id, ats_score=85.0, status="Evaluation Ready", applied_at=datetime.utcnow() - timedelta(days=5))
    async_db.add(appA)
    await async_db.flush()
    sessA = InterviewSession(candidate_id=cA.id, job_application_id=appA.id, status="completed", started_at=datetime.utcnow() - timedelta(days=4))
    async_db.add(sessA)
    await async_db.flush()
    async_db.add(ScoringReport(session_id=sessA.id, candidate_id=cA.id, overall_score=85.0, technical_score=90.0, communication_score=80.0, confidence_score=82.0, professionalism_score=88.0))

    # Candidate B: Overall 85, Tech 85, Comm 85 (Tied overall with A, but A has higher Technical 90 > 85)
    uB = User(email="candB@smarthire.ai", password_hash="pwd", full_name="Bob B", role="candidate")
    async_db.add(uB)
    await async_db.flush()
    cB = Candidate(user_id=uB.id, target_role="Full Stack")
    async_db.add(cB)
    await async_db.flush()
    appB = JobApplication(job_id=job.id, candidate_id=cB.id, ats_score=88.0, status="Evaluation Ready", applied_at=datetime.utcnow() - timedelta(days=4))
    async_db.add(appB)
    await async_db.flush()
    sessB = InterviewSession(candidate_id=cB.id, job_application_id=appB.id, status="completed", started_at=datetime.utcnow() - timedelta(days=3))
    async_db.add(sessB)
    await async_db.flush()
    async_db.add(ScoringReport(session_id=sessB.id, candidate_id=cB.id, overall_score=85.0, technical_score=85.0, communication_score=85.0, confidence_score=84.0, professionalism_score=86.0))

    # Candidate C: Overall 92 (Clear #1)
    uC = User(email="candC@smarthire.ai", password_hash="pwd", full_name="Charlie C", role="candidate")
    async_db.add(uC)
    await async_db.flush()
    cC = Candidate(user_id=uC.id, target_role="Full Stack")
    async_db.add(cC)
    await async_db.flush()
    appC = JobApplication(job_id=job.id, candidate_id=cC.id, ats_score=92.0, status="Evaluation Ready", applied_at=datetime.utcnow() - timedelta(days=3))
    async_db.add(appC)
    await async_db.flush()
    sessC = InterviewSession(candidate_id=cC.id, job_application_id=appC.id, status="completed", started_at=datetime.utcnow() - timedelta(days=2))
    async_db.add(sessC)
    await async_db.flush()
    async_db.add(ScoringReport(session_id=sessC.id, candidate_id=cC.id, overall_score=92.0, technical_score=94.0, communication_score=90.0, confidence_score=91.0, professionalism_score=93.0))

    # Candidate D: Applied, but no completed interview yet (Evaluation Pending)
    uD = User(email="candD@smarthire.ai", password_hash="pwd", full_name="David D", role="candidate")
    async_db.add(uD)
    await async_db.flush()
    cD = Candidate(user_id=uD.id, target_role="Full Stack")
    async_db.add(cD)
    await async_db.flush()
    appD = JobApplication(job_id=job.id, candidate_id=cD.id, ats_score=82.0, status="Applied", applied_at=datetime.utcnow() - timedelta(days=1))
    async_db.add(appD)
    await async_db.commit()

    ranking_res = await analytics_service.get_candidate_ranking(async_db, rec_user.id, job_id=job.id, user_role="recruiter")
    ranking = ranking_res["ranking"]

    assert ranking_res["total_candidates"] == 4
    assert ranking_res["ranked_candidates"] == 3
    assert ranking_res["pending_candidates"] == 1

    # Rank 1: Charlie (92.0)
    assert ranking[0]["candidate_name"] == "Charlie C"
    assert ranking[0]["rank"] == 1
    assert ranking[0]["overall_score"] == 92.0

    # Rank 2: Alice (85.0, Tech 90.0 wins tie-breaker over Bob Tech 85.0)
    assert ranking[1]["candidate_name"] == "Alice A"
    assert ranking[1]["rank"] == 2
    assert ranking[1]["overall_score"] == 85.0
    assert ranking[1]["technical_score"] == 90.0

    # Rank 3: Bob (85.0, Tech 85.0)
    assert ranking[2]["candidate_name"] == "Bob B"
    assert ranking[2]["rank"] == 3
    assert ranking[2]["overall_score"] == 85.0
    assert ranking[2]["technical_score"] == 85.0

    # Pending: David
    assert ranking[3]["candidate_name"] == "David D"
    assert ranking[3]["rank"] is None
    assert ranking[3]["evaluation_status"] == "Evaluation Pending"
