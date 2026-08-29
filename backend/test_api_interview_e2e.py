import os
import io
import sys
import pytest
import uuid
import httpx
from datetime import datetime
from sqlalchemy.future import select

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.models.domain import User, Candidate, InterviewSession, InterviewQuestion, ScoringReport
from app.main import app

@pytest.mark.asyncio
async def test_full_interview_api_lifecycle():
    """
    Validates complete end-to-end HTTP API lifecycle:
    1. Authenticate candidate
    2. Start interview session via /api/v1/interview/start
    3. Submit answers via /api/v1/interview/submit-answer
    4. Upload recording via /api/v1/uploads/interview-sessions/{id}/recordings
    5. Stream recording via /api/v1/uploads/interview-sessions/{id}/recordings/stream
    6. Complete session via /api/v1/interview/finish/{id}
    7. Fetch report via /api/v1/interview/report/{id}
    8. Fetch transcript via /api/v1/interview/transcript/{id}
    9. Fetch interview history via /api/v1/interview/history
    """
    async with AsyncSessionLocal() as db:
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email=f"cand_test_{user_id[:8]}@example.com",
            full_name="E2E Test Candidate",
            role="candidate",
            password_hash="hashed_pw_test_123"
        )
        db.add(user)
        cand_id = str(uuid.uuid4())
        cand = Candidate(id=cand_id, user_id=user_id, target_role="Full Stack Engineer")
        db.add(cand)
        await db.commit()

    token = create_access_token(subject=user_id, email=f"cand_test_{user_id[:8]}@example.com", role="candidate")
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Start Interview Session
        start_payload = {
            "role_target": "Full Stack Engineer",
            "round_type": "Technical",
            "difficulty": "Medium",
            "duration_minutes": 15,
            "resume_text": "Experienced Python and React full-stack developer with expertise in PostgreSQL and FastAPI."
        }
        res_start = await client.post("/api/v1/interview/start", json=start_payload, headers=headers)
        assert res_start.status_code == 200, f"Failed start: {res_start.text}"
        data_start = res_start.json()
        session_id = data_start["session_id"]
        assert "first_question" in data_start
        q1 = data_start["first_question"]
        q1_id = q1["question_id"]
        assert q1_id is not None
        print(f"\n[OK] Interview Started: Session {session_id}, First Question: {q1['question_text'][:50]}...")

        # 2. Submit Answer 1
        ans1_payload = {
            "session_id": session_id,
            "question_id": q1_id,
            "transcript_text": "I design backend APIs using FastAPI with dependency injection, PostgreSQL for persistent storage, and Redis for distributed caching.",
            "speech_duration_seconds": 35.0,
            "elapsed_seconds": 60,
            "vision_telemetry": {
                "eye_contact_percentage": 92,
                "attention_score": 94,
                "dominant_emotion": "confident",
                "confidence_percentage": 88
            }
        }
        res_ans1 = await client.post("/api/v1/interview/submit-answer", json=ans1_payload, headers=headers)
        assert res_ans1.status_code == 200, f"Failed submit answer 1: {res_ans1.text}"
        data_ans1 = res_ans1.json()
        assert "interviewer_remark" in data_ans1
        assert "next_question" in data_ans1
        q2 = data_ans1["next_question"]
        assert q2 is not None
        q2_id = q2["question_id"]
        print(f"[OK] Answer 1 Submitted. Remark: '{data_ans1['interviewer_remark'][:50]}...'. Next Q: {q2['question_text'][:50]}...")

        # 3. Submit Answer 2
        ans2_payload = {
            "session_id": session_id,
            "question_id": q2_id,
            "transcript_text": "To handle database migrations under high traffic, we run non-blocking schema migrations and use read replicas with connection pooling.",
            "speech_duration_seconds": 40.0,
            "elapsed_seconds": 120,
            "vision_telemetry": {
                "eye_contact_percentage": 95,
                "attention_score": 96,
                "dominant_emotion": "focused",
                "confidence_percentage": 90
            }
        }
        res_ans2 = await client.post("/api/v1/interview/submit-answer", json=ans2_payload, headers=headers)
        assert res_ans2.status_code == 200, f"Failed submit answer 2: {res_ans2.text}"
        print(f"[OK] Answer 2 Submitted successfully.")

        # 4. Upload Recording
        fake_video_bytes = b"RIFF....WEBMVIDEOSTREAM_TEST_DATA_BYTES_WITH_SUFFICIENT_SIZE_FOR_VALIDATION_" * 20
        files = {
            "file": ("test_interview_recording.webm", io.BytesIO(fake_video_bytes), "video/webm")
        }
        data_form = {
            "duration": "120.0",
            "recording_type": "VIDEO_AUDIO"
        }
        res_rec = await client.post(f"/api/v1/uploads/interview-sessions/{session_id}/recordings", files=files, data=data_form, headers=headers)
        assert res_rec.status_code == 200, f"Failed upload recording: {res_rec.text}"
        rec_meta = res_rec.json()
        assert rec_meta["session_id"] == session_id
        print(f"[OK] Recording uploaded: {rec_meta['file_path']}")

        # 5. Stream Recording
        res_stream = await client.get(f"/api/v1/uploads/interview-sessions/{session_id}/recordings/stream", headers=headers)
        assert res_stream.status_code in (200, 206), f"Failed stream recording: {res_stream.status_code}"
        assert len(res_stream.content) > 500
        print(f"[OK] Recording streaming verified: {len(res_stream.content)} bytes received.")

        # 6. Finish Interview Session
        res_finish = await client.post(f"/api/v1/interview/finish/{session_id}", headers=headers)
        assert res_finish.status_code == 200, f"Failed finish: {res_finish.text}"
        finish_data = res_finish.json()
        assert finish_data["status"] == "completed"
        print(f"[OK] Interview Session Finished. Score: {finish_data['overall_score']}% | Recommendation: {finish_data['recommendation']}")

        # 7. Fetch Final Report
        res_rep = await client.get(f"/api/v1/interview/report/{session_id}", headers=headers)
        assert res_rep.status_code == 200, f"Failed fetch report: {res_rep.text}"
        report_data = res_rep.json()
        assert report_data["session_id"] == session_id
        assert report_data["overall_score"] is not None
        assert report_data["has_recording"] is True
        assert "communication_score" in report_data
        assert "technical_score" in report_data
        assert "confidence_score" in report_data
        assert len(report_data["questions"]) >= 2
        print(f"[OK] Final Report Loaded: Score={report_data['overall_score']}%, Has Recording={report_data['has_recording']}, Questions Evaluated={len(report_data['questions'])}")

        # 8. Fetch Transcript
        res_tr = await client.get(f"/api/v1/interview/transcript/{session_id}", headers=headers)
        assert res_tr.status_code == 200, f"Failed fetch transcript: {res_tr.text}"
        tr_data = res_tr.json()
        assert len(tr_data["questions"]) >= 2
        print(f"[OK] Transcript Loaded: {tr_data['total_questions']} questions.")

        # 9. Fetch History
        res_hist = await client.get("/api/v1/interview/history", headers=headers)
        assert res_hist.status_code == 200, f"Failed fetch history: {res_hist.text}"
        hist_data = res_hist.json()
        assert any(h["session_id"] == session_id for h in hist_data)
        print(f"[OK] Interview History Verified: Found {len(hist_data)} sessions.")

    print("\n=======================================================")
    print("ALL 9 CRITICAL INTERVIEW WORKFLOW ENDPOINTS VERIFIED 100%")
    print("=======================================================\n")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_full_interview_api_lifecycle())

