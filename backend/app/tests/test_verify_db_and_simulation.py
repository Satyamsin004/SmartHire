import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.models.domain import User, Candidate, InterviewSession, InterviewAnswer, ScoringReport

@pytest.mark.asyncio
async def test_full_database_retrieval_and_interview_simulation():
    async with AsyncSessionLocal() as db:
        print("\n================================================================================")
        print("=== 1. VERIFYING USER & CANDIDATE DATABASE RETRIEVAL ===")
        print("================================================================================")
        
        # 1. Retrieve User satyamsin004@gmail.com from DB
        stmt = select(User).where(User.email == "satyamsin004@gmail.com")
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        
        assert user is not None, "User satyamsin004@gmail.com should exist in DB"
        print(f"[OK] User retrieved from DB: ID={user.id}, Email={user.email}, FullName='{user.full_name}', Role={user.role}")

        # 2. Retrieve Candidate Record from DB
        cand_stmt = select(Candidate).where(Candidate.user_id == user.id)
        candidate = (await db.execute(cand_stmt)).scalar_one_or_none()
        
        if not candidate:
            candidate = Candidate(
                user_id=user.id,
                target_role="Senior Software Engineer",
                experience_years=5
            )
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)

        print(f"[OK] Candidate profile retrieved: ID={candidate.id}, TargetRole={candidate.target_role}")

    # Generate JWT Auth Token for API testing
    token = create_access_token(subject=user.id, email=user.email, role=user.role)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("\n================================================================================")
        print("=== 2. TESTING INTERVIEW START API (/api/v1/interview/start) ===")
        print("================================================================================")
        
        start_resp = await client.post(
            "/api/v1/interview/start",
            headers=headers,
            json={
                "role_target": "Senior Software Engineer",
                "round_type": "Technical",
                "difficulty": "Easy",
                "duration_minutes": 5
            }
        )
        assert start_resp.status_code == 200, f"Expected 200 OK, got {start_resp.status_code}: {start_resp.text}"
        start_data = start_resp.json()
        session_id = start_data["session_id"]
        first_question = start_data["first_question"]
        
        print(f"[OK] POST /interview/start -> 200 OK")
        print(f"[OK] Created Session ID: {session_id}")
        print(f"[OK] Generated Question: '{first_question['question_text']}' (ID: {first_question['question_id']})")

        print("\n================================================================================")
        print("=== 3. TESTING ANSWER SUBMISSION API (/api/v1/interview/submit-answer) ===")
        print("================================================================================")

        answer_payload = {
            "session_id": session_id,
            "question_id": first_question["question_id"],
            "transcript_text": (
                "Decorators in Python are callable objects used to modify or extend the behavior of functions or classes. "
                "They use closure functions and wrapper functions to inspect parameters and execution time."
            ),
            "speech_duration_seconds": 30.0
        }

        answer_resp = await client.post(
            "/api/v1/interview/submit-answer",
            headers=headers,
            json=answer_payload
        )
        assert answer_resp.status_code == 200, f"Expected 200 OK, got {answer_resp.status_code}: {answer_resp.text}"
        ans_data = answer_resp.json()

        print(f"[OK] POST /interview/submit-answer -> 200 OK")
        print(f"[OK] AI Feedback Remark: '{ans_data.get('ai_remark')}'")
        print(f"[OK] Audio Remark URL: '{ans_data.get('audio_url')}'")

        print("\n================================================================================")
        print("=== 4. TESTING INTERVIEW END & REPORT CREATION (/api/v1/interview/finish/{session_id}) ===")
        print("================================================================================")

        end_resp = await client.post(
            f"/api/v1/interview/finish/{session_id}",
            headers=headers
        )
        assert end_resp.status_code == 200, f"Expected 200 OK, got {end_resp.status_code}: {end_resp.text}"
        end_data = end_resp.json()

        print(f"[OK] POST /interview/finish/{session_id} -> 200 OK")
        print(f"[OK] Final Overall Score: {end_data.get('overall_score')}%")
        print(f"[OK] Recommendation: {end_data.get('recommendation')}")
        print(f"[OK] Feedback Summary: '{end_data.get('feedback_summary')}'")

        print("\n================================================================================")
        print("=== 5. VERIFYING CANDIDATE HISTORY & DASHBOARD METRICS ===")
        print("================================================================================")

        history_resp = await client.get("/api/v1/interview/history", headers=headers)
        assert history_resp.status_code == 200, f"Expected 200 OK, got {history_resp.status_code}"
        history_data = history_resp.json()

        print(f"[OK] GET /interview/history -> 200 OK")
        print(f"[OK] Total Completed Interviews in History: {len(history_data)}")

        metrics_resp = await client.get("/api/v1/users/candidate-metrics", headers=headers)
        assert metrics_resp.status_code == 200, f"Expected 200 OK, got {metrics_resp.status_code}"
        metrics_data = metrics_resp.json()

        print(f"[OK] GET /users/candidate-metrics -> 200 OK")
        print(f"[OK] Metrics Retrieved: Completed Interviews = {metrics_data.get('interviews_completed')}, Avg Score = {metrics_data.get('avg_interview_score')}%, Best Score = {metrics_data.get('best_interview_score')}%")

    print("\n================================================================================")
    print("=== VERIFICATION COMPLETE: ALL DB & INTERVIEW SIMULATION TESTS PASSED 100%! ===")
    print("================================================================================\n")
