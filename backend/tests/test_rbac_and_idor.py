import pytest
import uuid
import httpx
from app.main import app
from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.models.domain import User, Candidate, Recruiter, InterviewSession

@pytest.mark.asyncio
async def test_candidate_idor_cross_session_isolation():
    """
    IDOR / BOLA Test:
    Verify Candidate A cannot read or manipulate Candidate B's session or transcript.
    """
    async with AsyncSessionLocal() as db:
        # Create Candidate A
        user_a_id = f"test-user-a-{uuid.uuid4().hex[:8]}"
        user_a = User(id=user_a_id, email=f"{user_a_id}@example.com", full_name="Candidate A", role="candidate", password_hash="pw")
        db.add(user_a)
        cand_a_id = f"cand-a-{uuid.uuid4().hex[:8]}"
        cand_a = Candidate(id=cand_a_id, user_id=user_a_id, target_role="Engineer")
        db.add(cand_a)

        # Create Candidate B
        user_b_id = f"test-user-b-{uuid.uuid4().hex[:8]}"
        user_b = User(id=user_b_id, email=f"{user_b_id}@example.com", full_name="Candidate B", role="candidate", password_hash="pw")
        db.add(user_b)
        cand_b_id = f"cand-b-{uuid.uuid4().hex[:8]}"
        cand_b = Candidate(id=cand_b_id, user_id=user_b_id, target_role="Engineer")
        db.add(cand_b)

        # Session for Candidate B (Scheduled Recruiter Interview)
        sess_b_id = f"sess-b-{uuid.uuid4().hex[:8]}"
        sess_b = InterviewSession(
            id=sess_b_id,
            candidate_id=cand_b_id,
            scheduled_interview_id=f"sched-{uuid.uuid4().hex[:8]}",
            interview_type="Recruiter",
            role_target="Engineer",
            status="IN_PROGRESS"
        )
        db.add(sess_b)
        await db.commit()

    token_a = create_access_token(subject=user_a_id, email=f"{user_a_id}@example.com", role="candidate")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Candidate A tries to access Candidate B's session details
        res_sess = await client.get(f"/api/v1/interview/session/{sess_b_id}", headers=headers_a)
        assert res_sess.status_code == 403, f"Expected 403 for Candidate A accessing Session B, got {res_sess.status_code}: {res_sess.text}"

        # 2. Candidate A tries to post visual telemetry to Candidate B's session
        res_vis = await client.post(
            f"/api/v1/interview/{sess_b_id}/visual-observations",
            json={"observations": [{"timestamp": 1.0, "face_detected": True}]},
            headers=headers_a
        )
        assert res_vis.status_code == 403, f"Expected 403 for Candidate A writing to Session B, got {res_vis.status_code}: {res_vis.text}"

        # 3. Candidate A tries to fetch Candidate B's transcript
        res_tr = await client.get(f"/api/v1/interview/transcript/{sess_b_id}", headers=headers_a)
        assert res_tr.status_code == 403, f"Expected 403 for Candidate A fetching transcript of Session B, got {res_tr.status_code}: {res_tr.text}"

        # 4. Candidate A tries to call recruiter-only endpoint (POST /api/v1/jobs/create)
        res_rec = await client.post(
            "/api/v1/jobs/create",
            json={"title": "Unauthorized Job", "description": "test", "location": "Remote"},
            headers=headers_a
        )
        assert res_rec.status_code == 403, f"Expected 403 for candidate accessing recruiter endpoint, got {res_rec.status_code}: {res_rec.text}"

        # 5. Unauthenticated access without token to protected session endpoint
        res_unauth = await client.get(f"/api/v1/interview/session/{sess_b_id}")
        assert res_unauth.status_code == 401, f"Expected 401 for unauthenticated request, got {res_unauth.status_code}"

    # Cleanup created test entities
    async with AsyncSessionLocal() as db:
        sess = await db.get(InterviewSession, sess_b_id)
        if sess: await db.delete(sess)
        ca = await db.get(Candidate, cand_a_id)
        if ca: await db.delete(ca)
        cb = await db.get(Candidate, cand_b_id)
        if cb: await db.delete(cb)
        ua = await db.get(User, user_a_id)
        if ua: await db.delete(ua)
        ub = await db.get(User, user_b_id)
        if ub: await db.delete(ub)
        await db.commit()
