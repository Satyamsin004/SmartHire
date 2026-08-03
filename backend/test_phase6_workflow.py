import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase6_workflow_test():
    print("=== STARTING PHASE 6 AI EVALUATION ENGINE VERIFICATION ===")

    # 1. Register Candidate & Recruiter
    cand_email = f"cand_p6_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Phase 6 Candidate",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    cand_token = r_cand.json()["tokens"]["access_token"]

    rec_email = f"rec_p6_{int(time.time())}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Phase 6 Recruiter",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    rec_token = r_rec.json()["tokens"]["access_token"]
    print("✓ Candidate and Recruiter Registered")

    # 2. Candidate completes AI Interview Session
    start_res = requests.post(f"{BASE_URL}/interview/start", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "role_target": "Principal Cloud Architect",
        "round_type": "Technical",
        "difficulty": "Hard",
        "duration_minutes": 15
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["session_id"]
    q_id = start_res.json()["questions"][0]["question_id"]

    sub_res = requests.post(f"{BASE_URL}/interview/submit-answer", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "session_id": session_id,
        "question_id": q_id,
        "transcript_text": "We deploy microservices using FastAPI, PostgreSQL multi-region replication, and Kubernetes cluster auto-scaling.",
        "speech_duration_seconds": 40.0,
        "vision_telemetry": {
            "eye_contact_percentage": 94.0,
            "blink_rate": 14.0,
            "faces_count": 1,
            "emotion": "Confident & Focused"
        }
    })
    assert sub_res.status_code == 200
    print("✓ Live Interview Answer Submitted with Multimodal Telemetry")

    # 3. Retrieve Permanent Evaluation Report
    report_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {cand_token}"})
    assert report_res.status_code == 200
    rep = report_res.json()
    assert rep["communication_score"] > 0
    assert rep["confidence_score"] > 0
    assert rep["technical_score"] > 0
    assert rep["professionalism_score"] > 0
    assert rep["overall_score"] > 0
    assert "strengths" in rep
    assert "weaknesses" in rep
    print(f"✓ AI Evaluation Generated from Real Metrics (Overall: {rep['overall_score']}, Comm: {rep['communication_score']}, Conf: {rep['confidence_score']}, Tech: {rep['technical_score']})")

    # 4. Candidate Queries Permanent Interview History
    hist_res = requests.get(f"{BASE_URL}/interview/history", headers={"Authorization": f"Bearer {cand_token}"})
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) > 0
    assert history[0]["id"] == session_id
    assert abs(history[0]["score"] - rep["overall_score"]) < 1.0
    print(f"✓ Candidate Permanent Interview History Verified ({len(history)} session(s) recorded)")

    # 5. Recruiter Queries Evaluation Report
    rec_rep = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {rec_token}"})
    assert rec_rep.status_code == 200
    assert rec_rep.json()["overall_score"] == rep["overall_score"]
    print("✓ Recruiter Evaluation Retrieval Verified")

    print("\n=== ALL PHASE 6 AI EVALUATION ENGINE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase6_workflow_test()
