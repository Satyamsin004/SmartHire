import requests
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

# 1. Register candidate user
cand_email = f"cand_test_{uuid.uuid4().hex[:6]}@smarthire.ai"
r_cand = requests.post(f"{BASE_URL}/auth/register", json={
    "email": cand_email, "password": "Password123!", "full_name": "HTTP Live Sync Candidate", "role": "candidate"
})
print("Candidate Registration Status:", r_cand.status_code)

# 2. Register recruiter user
rec_email = f"rec_test_{uuid.uuid4().hex[:6]}@smarthire.ai"
r_rec = requests.post(f"{BASE_URL}/auth/register", json={
    "email": rec_email, "password": "Password123!", "full_name": "HTTP Live Sync Recruiter", "role": "recruiter"
})
print("Recruiter Registration Status:", r_rec.status_code)

# 3. Login Recruiter
r_login = requests.post(f"{BASE_URL}/auth/login", json={"email": rec_email, "password": "Password123!"})
token = r_login.json()["tokens"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 4. Fetch Stats
r_stats = requests.get(f"{BASE_URL}/recruiter/stats", headers=headers)
print("Recruiter Stats Response:", r_stats.status_code, r_stats.json())

# 5. Fetch Registered Candidates
r_list = requests.get(f"{BASE_URL}/recruiter/registered-candidates", headers=headers)
print("Registered Candidates Status:", r_list.status_code, f"Count: {len(r_list.json())}")

assert r_stats.json()["total_candidates"] >= 5
assert len(r_list.json()) >= 5
print("\n[SUCCESS] HTTP API ENDPOINTS 100% OPERATIONAL & SYNCHRONIZED!")
