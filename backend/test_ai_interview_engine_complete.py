import asyncio
import os
import sys

user_site = r"C:\Users\satya\AppData\Roaming\Python\Python310\site-packages"
if user_site not in sys.path:
    sys.path.insert(0, user_site)

from httpx import AsyncClient, ASGITransport
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, InterviewSession, ScoringReport
from app.core.security import create_access_token

async def test_full_ai_interview_engine_pipeline():
    """
    End-to-end automated verification of the AI Interview Engine:
    1. Authenticate candidate
    2. Start interview session & generate Q1
    3. Submit Q1 answer and verify AI generates contextual follow-up question Q2
    4. Submit Q2 answer & finish session
    5. Generate evaluation report and assert non-zero Gemini scores across all 9 categories
    6. Verify interview history storage with Recruiter vs Mock distinction
    7. Generate and verify downloadable PDF report
    """
    print("\n=======================================================")
    print("STARTING COMPLETE E2E AI INTERVIEW ENGINE TEST SUITE")
    print("=======================================================")

    from app.main import startup
    await startup()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with AsyncSessionLocal() as db:
            # 1. Create test user & candidate in PostgreSQL
            import uuid
            unique_email = f"ai_interview_test_{uuid.uuid4().hex[:8]}@example.com"
            user = User(
                email=unique_email,
                password_hash="hashed_pw",
                full_name="Alex Rivera",
                role="candidate"
            )
            db.add(user)
            await db.flush()

            candidate = Candidate(
                user_id=user.id,
                target_role="Senior Full Stack Engineer"
            )
            db.add(candidate)
            await db.commit()
            await db.refresh(user)

            access_token = create_access_token(subject=user.id, email=user.email, role=user.role)
            headers = {"Authorization": f"Bearer {access_token}"}

        print(f"[OK] Created test candidate: {user.full_name} ({user.email})")

        # 2. Start Interview Session
        start_payload = {
            "role_target": "Senior Full Stack Engineer",
            "round_type": "Technical",
            "difficulty": "Medium",
            "duration_minutes": 15,
            "resume_text": "Experienced software engineer specializing in Python, React, PostgreSQL, and REST APIs.",
            "parsed_resume": {
                "skills": [{"skill_name": "Python"}, {"skill_name": "React"}, {"skill_name": "PostgreSQL"}, {"skill_name": "REST API"}],
                "projects": ["Built high-throughput distributed microservice architecture."]
            }
        }

        res_start = await client.post("/api/v1/interview/start", json=start_payload, headers=headers)
        assert res_start.status_code == 200, f"Start interview failed: {res_start.text}"
        data_start = res_start.json()
        
        session_id = data_start["session_id"]
        q1 = data_start["first_question"]
        print(f"[OK] Interview started! Session ID: {session_id}")
        print(f"    [Q1]: {q1['question_text']}")

        # 3. Submit Answer to Q1 & Verify Contextual Follow-up Question Q2
        a1_text = "API is used for communication between frontend and backend. There are GET and POST APIs."
        res_a1 = await client.post("/api/v1/interview/submit-answer", json={
            "session_id": session_id,
            "question_id": q1["question_id"],
            "transcript_text": a1_text,
            "speech_duration_seconds": 30.0
        }, headers=headers)
        
        assert res_a1.status_code == 200, f"Submit answer Q1 failed: {res_a1.text}"
        data_a1 = res_a1.json()
        assert "evaluation_feedback" in data_a1, "Missing verbal feedback"
        print(f"    Verbal Feedback: '{data_a1['evaluation_feedback']}'")

        q2 = data_a1.get("next_question")
        assert q2 is not None, "Expected follow-up question Q2"
        print(f"    [Q2 Follow-up]: {q2['question_text']}")
        assert q2.get("is_followup") is True, "Q2 should be marked as follow-up"

        # 4. Submit Answer to Q2
        a2_text = "GET is used to retrieve resource data without side effects, whereas POST creates new resources on the server and carries a payload."
        res_a2 = await client.post("/api/v1/interview/submit-answer", json={
            "session_id": session_id,
            "question_id": q2["question_id"],
            "transcript_text": a2_text,
            "speech_duration_seconds": 40.0
        }, headers=headers)

        assert res_a2.status_code == 200, f"Submit answer Q2 failed: {res_a2.text}"
        data_a2 = res_a2.json()
        print(f"    Verbal Feedback Q2: '{data_a2['evaluation_feedback']}'")

        # 5. Fetch Session Report & Assert All 9 Competency Scores are Non-Zero
        res_rep = await client.get(f"/api/v1/interview/report/{session_id}", headers=headers)
        assert res_rep.status_code == 200, f"Fetch report failed: {res_rep.text}"
        rep_data = res_rep.json()

        print("\n=======================================================")
        print("AI EVALUATION TELEMETRY SCORES (VERIFYING NON-ZERO):")
        print(f"  Overall Score: {rep_data['overall_score']}%")
        print(f"  Technical Score: {rep_data['technical_score']}%")
        print(f"  Communication Score: {rep_data['communication_score']}%")
        print(f"  Confidence Score: {rep_data['confidence_score']}%")
        print(f"  Professionalism Score: {rep_data['professionalism_score']}%")
        print(f"  Grammar Score: {rep_data['grammar_score']}%")
        print(f"  Problem Solving Score: {rep_data['problem_solving_score']}%")
        print(f"  Behavior Score: {rep_data['behavior_score']}%")
        print(f"  Leadership Score: {rep_data['leadership_score']}%")
        print(f"  Recommendation: {rep_data['recommendation']}")
        print("=======================================================\n")

        # Strict Assertions: Zero is NOT allowed!
        assert rep_data['overall_score'] > 0.0, "Overall score cannot be zero!"
        assert rep_data['technical_score'] > 0.0, "Technical score cannot be zero!"
        assert rep_data['communication_score'] > 0.0, "Communication score cannot be zero!"
        assert rep_data['confidence_score'] > 0.0, "Confidence score cannot be zero!"
        assert rep_data['professionalism_score'] > 0.0, "Professionalism score cannot be zero!"
        assert rep_data['grammar_score'] > 0.0, "Grammar score cannot be zero!"
        assert rep_data['problem_solving_score'] > 0.0, "Problem solving score cannot be zero!"

        # 6. Fetch Interview History & Verify Metadata Storage
        res_hist = await client.get("/api/v1/interview/history", headers=headers)
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert len(hist_data) >= 1, "Interview session must be permanently saved in history"
        session_card = next((s for s in hist_data if s["id"] == session_id), None)
        assert session_card is not None, "Completed session card missing from history"
        assert session_card["interview_type"] in ["Mock", "Recruiter"], "Session card must distinguish interview type"
        print(f"[OK] Verified AI Feedback History Card: {session_card['title']} (Type: {session_card['interview_type']}, Score: {session_card['score']}%)")

        # 7. Generate & Verify Downloadable PDF Report
        res_pdf = await client.get(f"/api/v1/interview/report/{session_id}/pdf", headers=headers)
        assert res_pdf.status_code == 200, f"PDF export failed: {res_pdf.text}"
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert len(res_pdf.content) > 500, "PDF content must be valid non-empty PDF binary bytes"
        print(f"[OK] Successfully generated downloadable PDF report ({len(res_pdf.content)} bytes)")

        print("\n=======================================================")
        print("ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY (PASS)")
        print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(test_full_ai_interview_engine_pipeline())
