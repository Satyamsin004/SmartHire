import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_banner(title):
    print("\n" + "="*80)
    print(f"=== {title} ===")
    print("="*80)

def test_human_like_interview():
    print_banner("HUMAN-LIKE AI INTERVIEW ENGINE & DEDUPLICATION VERIFICATION")

    # 1. Candidate Authentication
    email = f"candidate_human_{uuid.uuid4().hex[:4]}@smarthire.ai"
    reg = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Senior Fullstack Engineer",
        "role": "candidate"
    })
    token = reg.json().get("access_token") or reg.json().get("tokens", {}).get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[OK] Candidate Registered & Authenticated: {email}")

    # 2. Upload Resume
    files = {
        "file": ("fullstack_resume.pdf", b"%PDF-1.4 React TypeScript Node.js PostgreSQL Docker REST API GraphQL Microservices", "application/pdf")
    }
    r_up = requests.post(f"{BASE_URL}/resume/upload", files=files, headers=headers)
    print(f"[OK] Resume Uploaded (Status {r_up.status_code})")

    # 3. Start Session 1: Technical Interview
    print("\n--- Session 1: Technical Interview ---")
    s1_res = requests.post(f"{BASE_URL}/interview/start", json={
        "role_target": "Senior Full Stack Engineer",
        "round_type": "Technical",
        "difficulty": "Hard",
        "duration_minutes": 15
    }, headers=headers)
    assert s1_res.status_code == 200, f"Start session 1 failed: {s1_res.text}"
    s1_data = s1_res.json()
    q1 = s1_data["first_question"]["question_text"]
    s1_id = s1_data["session_id"]
    print(f"[OK] Session 1 Created (ID: {s1_id})")
    print(f"[Q1]: {q1}")

    # Submit Answer 1 to trigger Live Micro-Feedback & Dynamic Follow-up
    ans1_res = requests.post(f"{BASE_URL}/interview/submit-answer", json={
        "session_id": s1_id,
        "question_id": s1_data["first_question"]["question_id"],
        "transcript_text": "I build REST APIs using FastAPI and Node.js with JWT authentication, PostgreSQL indexing, and Docker containerization.",
        "speech_duration_seconds": 35.0
    }, headers=headers)
    assert ans1_res.status_code == 200, f"Submit answer 1 failed: {ans1_res.text}"
    ans1_data = ans1_res.json()
    remark1 = ans1_data.get("interviewer_remark") or ans1_data.get("evaluation_feedback")
    followup1 = ans1_data.get("next_question", {}).get("question_text")
    print(f"[INTERVIEWER MICRO-REMARK]: \"{remark1}\"")
    print(f"[FOLLOW-UP Q2]: \"{followup1}\"")

    assert remark1 and len(remark1) > 5, "Interviewer micro-remark was empty!"
    assert followup1 and len(followup1) > 5, "Follow-up question was empty!"

    # 4. Start Session 2: HR & Behavioral Interview (Question Memory Verification)
    print("\n--- Session 2: HR & Behavioral Interview (Question Memory Check) ---")
    s2_res = requests.post(f"{BASE_URL}/interview/start", json={
        "role_target": "Senior Full Stack Engineer",
        "round_type": "Behavioral",
        "difficulty": "Medium",
        "duration_minutes": 15
    }, headers=headers)
    assert s2_res.status_code == 200, f"Start session 2 failed: {s2_res.text}"
    s2_data = s2_res.json()
    q2 = s2_data["first_question"]["question_text"]
    s2_id = s2_data["session_id"]
    print(f"[OK] Session 2 Created (ID: {s2_id})")
    print(f"[Q1 (Behavioral)]: {q2}")

    # Deduplication check across sessions
    assert q1 != q2, f"ERROR: Identical question asked across different sessions! ('{q1}')"
    print("[OK] Question Memory Verified: Session 2 generated a completely distinct opening question.")

    # 5. Fetch Mock History Directory
    print("\n--- Mock Interview History Directory Verification ---")
    hist_res = requests.get(f"{BASE_URL}/interview/mock-history", headers=headers)
    assert hist_res.status_code == 200, f"Fetch mock history failed: {hist_res.text}"
    mock_history = hist_res.json()
    print(f"[OK] Mock History Returned {len(mock_history)} History Cards:")
    for card in mock_history:
        print(f"  - [{card['date']}] {card['title']} | Round: {card['round_type']} | Status: {card['status']} | Overall Score: {card['overall_score']}")

    assert len(mock_history) >= 2, "Mock history did not record past sessions!"
    print("\n" + "="*80)
    print("=== PASS - HUMAN-LIKE AI INTERVIEW ENGINE & MEMORY DEDUPLICATION VERIFIED! ===")
    print("="*80)

if __name__ == "__main__":
    test_human_like_interview()
