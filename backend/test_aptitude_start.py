import requests
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_aptitude_start_endpoint():
    print("="*80)
    print("=== TESTING POST /api/v1/aptitude/start ENDPOINT ===")
    print("="*80)

    # 1. Register & Authenticate Candidate
    email = f"aptitude_test_{uuid.uuid4().hex[:4]}@smarthire.ai"
    reg = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Aptitude Tester",
        "role": "candidate"
    })
    token = reg.json().get("access_token") or reg.json().get("tokens", {}).get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[OK] Candidate Registered & Authenticated: {email}")

    # 2. Call POST /api/v1/aptitude/start
    res = requests.post(f"{BASE_URL}/aptitude/start", json={
        "title": "Verification Aptitude Start Test",
        "topics": ["Quantitative Aptitude", "Logical Reasoning"],
        "difficulty": "Medium",
        "question_count": 5,
        "duration_minutes": 10
    }, headers=headers)

    print(f"[RESPONSE STATUS]: {res.status_code}")
    print(f"[RESPONSE DATA]: {res.json()}")

    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert "session_id" in res.json(), "session_id missing in response"

    print("\n" + "="*80)
    print("=== PASS - POST /api/v1/aptitude/start RETURNED HTTP 200 OK! ===")
    print("="*80)

if __name__ == "__main__":
    test_aptitude_start_endpoint()
