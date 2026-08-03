import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase5_workflow_test():
    print("=== STARTING PHASE 5 AI INTERVIEW SYSTEM VERIFICATION ===")

    # 1. Register Recruiter & Candidate
    rec_email = f"rec_p5_{int(time.time())}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Lead Hiring Manager",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    rec_token = r_rec.json()["tokens"]["access_token"]

    cand_email = f"cand_p5_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Satyam Interviewee",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    cand_token = r_cand.json()["tokens"]["access_token"]
    cand_user_id = r_cand.json()["user"]["id"]
    print("✓ Recruiter and Candidate Satyam Registered")

    # 2. Recruiter Schedules Interview for Satyam
    sched_res = requests.post(f"{BASE_URL}/scheduling/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "candidate_ids": [cand_user_id],
        "round_type": "Technical",
        "scheduled_date": "2026-08-01T10:00:00Z",
        "duration_minutes": 15,
        "difficulty": "Hard",
        "instructions": "Be prepared to discuss distributed systems architecture."
    })
    assert sched_res.status_code == 200
    print("✓ Recruiter Scheduled Technical Interview for Candidate Satyam")

    # 3. Candidate Queries Scheduled Interviews
    cand_scheds = requests.get(f"{BASE_URL}/scheduling/candidate-schedules", headers={"Authorization": f"Bearer {cand_token}"})
    assert cand_scheds.status_code == 200
    sched_list = cand_scheds.json()
    assert len(sched_list) > 0
    assert sched_list[0]["round_type"] == "Technical"
    print(f"✓ Candidate Satyam Retrieved Scheduled Interview (Duration: {sched_list[0]['duration_minutes']}m)")

    # 4. Candidate Starts AI Interview Session (Question Limit & Timer Configured)
    start_res = requests.post(f"{BASE_URL}/interview/start", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "role_target": "Staff Distributed Systems Engineer",
        "round_type": "Technical",
        "difficulty": "Hard",
        "duration_minutes": 10
    })
    assert start_res.status_code == 200
    start_data = start_res.json()
    session_id = start_data["session_id"]
    questions = start_data["questions"]
    assert len(questions) > 0
    print(f"✓ Live AI Interview Session Started. Session ID: {session_id} ({len(questions)} Questions Generated)")

    # 5. Candidate Submits Answer (Speech-to-Text & Vision Metrics Processing)
    first_q = questions[0]
    sub_res = requests.post(f"{BASE_URL}/interview/submit-answer", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "session_id": session_id,
        "question_id": first_q["question_id"],
        "transcript_text": "I design distributed systems using FastAPI microservices with PostgreSQL replication, Redis pub sub caching, and Docker orchestration.",
        "speech_duration_seconds": 35.0
    })
    if sub_res.status_code != 200:
        print("Submit answer failed:", sub_res.status_code, sub_res.text)
    assert sub_res.status_code == 200
    answer_data = sub_res.json()
    assert answer_data["speaking_pace_wpm"] > 0
    print("✓ Speech-to-Text Transcript & Multimodal Metrics Processed Successfully")

    # 6. Generate Complete Permanent Evaluation Report
    report_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {cand_token}"})
    assert report_res.status_code == 200
    rep = report_res.json()
    assert rep["overall_score"] is not None
    print(f"✓ Permanent AI Evaluation Report Stored in PostgreSQL (Overall Score: {rep['overall_score']})")

    print("\n=== ALL PHASE 5 AI INTERVIEW SYSTEM TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase5_workflow_test()
