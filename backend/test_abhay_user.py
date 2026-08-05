import requests
from app.core.security import get_password_hash
from sqlalchemy import create_engine, text

BASE_URL = "http://127.0.0.1:8000/api/v1"

# 1. Update password hash for abhay@gmail.com
engine = create_engine("postgresql+psycopg2://postgres:postgrespassword2026@127.0.0.1:5433/smarthire_db")
new_hash = get_password_hash("Password123!")

with engine.connect() as conn:
    conn.execute(text("UPDATE users SET password_hash = :h WHERE email = 'abhay@gmail.com';"), {"h": new_hash})
    conn.commit()
    print("[OK] Updated abhay@gmail.com password hash to 'Password123!'")

# 2. Login abhay@gmail.com
r_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "abhay@gmail.com", "password": "Password123!"})
print("Abhay Login Status:", r_login.status_code)
if r_login.status_code == 200:
    token = r_login.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get Recruiter Stats for Abhay
    r_stats = requests.get(f"{BASE_URL}/recruiter/stats", headers=headers)
    print("Abhay /recruiter/stats:", r_stats.status_code, r_stats.json())

    # 4. Get Registered Candidates for Abhay
    r_cands = requests.get(f"{BASE_URL}/recruiter/registered-candidates", headers=headers)
    cands_data = r_cands.json()
    print("Abhay /recruiter/registered-candidates:", r_cands.status_code, f"Count: {len(cands_data)}")
    for idx, c in enumerate(cands_data):
        print(f"   [{idx+1}] Candidate: {c.get('full_name')} ({c.get('email')}) - Status: {c.get('status')}")
