import requests
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_full_pipeline():
    print("="*80)
    print("=== SMARTHIRE E2E RECRUITMENT & PRACTICE HUB PIPELINE VERIFICATION ===")
    print("="*80)

    # --- 1. Candidate Registration & Auth ---
    c_email = f"c_e2e_{uuid.uuid4().hex[:4]}@smarthire.ai"
    reg_c = requests.post(f"{BASE_URL}/auth/register", json={
        "email": c_email,
        "password": "Password123!",
        "full_name": "E2E Candidate",
        "role": "candidate"
    })
    c_token = reg_c.json().get("access_token") or reg_c.json().get("tokens", {}).get("access_token")
    c_headers = {"Authorization": f"Bearer {c_token}"}
    print(f"[OK] Candidate Registered & Authenticated: {c_email}")

    # --- 2. Practice Assessment Workflow (BUG 2 Verification) ---
    print("\n--- [TEST MODULE 1] Candidate Practice Assessment ---")
    res_assess = requests.post(f"{BASE_URL}/aptitude/start", json={
        "title": "E2E AI Aptitude Practice Session",
        "topics": ["Quantitative Aptitude", "PostgreSQL & Database Indexing"],
        "difficulty": "Medium",
        "question_count": 5,
        "duration_minutes": 15
    }, headers=c_headers)

    print(f"[STATUS]: {res_assess.status_code}")
    assert res_assess.status_code == 200, f"Start assessment failed: {res_assess.text}"
    session_id = res_assess.json()["session_id"]
    print(f"[OK] Practice Session Started: ID={session_id}")

    # Fetch Questions
    res_q = requests.get(f"{BASE_URL}/aptitude/session/{session_id}/questions", headers=c_headers)
    assert res_q.status_code == 200
    questions = res_q.json()
    print(f"[OK] Fetched {len(questions)} Assessment MCQs")

    # Submit Answers
    user_answers = []
    for q in questions:
        user_answers.append({
            "question_id": q["id"],
            "selected_option": 0,
            "time_taken_seconds": 12
        })

    res_sub = requests.post(f"{BASE_URL}/aptitude/session/{session_id}/submit", json={
        "answers": user_answers,
        "proctoring_violations": 1
    }, headers=c_headers)
    assert res_sub.status_code == 200, f"Submit assessment failed: {res_sub.text}"
    print(f"[OK] Submitted Assessment: Score={res_sub.json().get('score_percentage')}%")

    # Fetch Result
    res_res = requests.get(f"{BASE_URL}/aptitude/session/{session_id}/result", headers=c_headers)
    assert res_res.status_code == 200
    print(f"[OK] Assessment Result Report Verified")

    # --- 3. Interview Evaluation Workflow with Multiple Answers (BUG 1 Verification) ---
    print("\n--- [TEST MODULE 2] AI Interview Evaluation & Multiple Questions ---")
    res_int = requests.post(f"{BASE_URL}/interview/start", json={
        "role_target": "Principal Full Stack Engineer",
        "round_type": "Technical Interview",
        "difficulty": "Hard",
        "question_count": 3
    }, headers=c_headers)
    assert res_int.status_code == 200, f"Start interview failed: {res_int.text}"
    int_session_id = res_int.json()["session_id"]
    first_q = res_int.json()["first_question"]
    q_id = first_q["question_id"]
    print(f"[OK] AI Interview Started: Session ID={int_session_id}")

    # Submit answer 1 for Question 1
    res_ans1 = requests.post(f"{BASE_URL}/interview/submit-answer", json={
        "session_id": int_session_id,
        "question_id": q_id,
        "transcript_text": "I design distributed systems using microservices, PostgreSQL indexing, and Redis caching.",
        "speaking_pace_wpm": 130.0,
        "filler_word_count": 1,
        "eye_contact_percentage": 92.0,
        "confidence_percentage": 95.0
    }, headers=c_headers)
    assert res_ans1.status_code == 200

    # Submit answer 2 for SAME Question 1 (Testing Multiple Answers / MultipleResultsFound protection)
    res_ans2 = requests.post(f"{BASE_URL}/interview/submit-answer", json={
        "session_id": int_session_id,
        "question_id": q_id,
        "transcript_text": "Furthermore, I optimize database queries and utilize horizontal scaling with Docker.",
        "speaking_pace_wpm": 140.0,
        "filler_word_count": 0,
        "eye_contact_percentage": 95.0,
        "confidence_percentage": 98.0
    }, headers=c_headers)
    assert res_ans2.status_code == 200
    print(f"[OK] Submitted Multiple Answers for Session Question")

    # Fetch Final Report
    res_report = requests.get(f"{BASE_URL}/interview/report/{int_session_id}", headers=c_headers)
    print(f"[REPORT STATUS]: {res_report.status_code}")
    assert res_report.status_code == 200, f"Failed to generate report: {res_report.text}"
    rep_data = res_report.json()
    print(f"[OK] Scoring Report Generated Successfully without MultipleResultsFound Error!")
    print(f"     Overall Score: {rep_data.get('overall_score')}% | Recommendation: {rep_data.get('recommendation')}")

    print("\n" + "="*80)
    print("=== PASS - ALL E2E WORKFLOWS & BUG FIXES 100% VERIFIED! ===")
    print("="*80)

if __name__ == "__main__":
    test_full_pipeline()
