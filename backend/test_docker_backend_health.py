import requests

BASE_URL = "http://localhost:8000"

print("=========================================================================")
print("=== DOCKER BACKEND CONTAINER HEALTH & ROUTER VERIFICATION ===")
print("=========================================================================\n")

# 1. Health Check GET /
r_root = requests.get(f"{BASE_URL}/")
print(f"[HEALTH CHECK] GET / -> Status Code: {r_root.status_code}, Response: {r_root.json()}")
assert r_root.status_code == 200
assert r_root.json()["status"] == "healthy"

# 2. Login Recruiter via Docker Backend
r_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": "abhay@gmail.com", "password": "Password123!"})
print(f"[AUTH ROUTER] POST /api/v1/auth/login -> Status Code: {r_login.status_code}")
assert r_login.status_code == 200, f"Login failed: {r_login.text}"
token = r_login.json()["tokens"]["access_token"]

headers = {"Authorization": f"Bearer {token}"}

# 3. Recruiter Stats
r_stats = requests.get(f"{BASE_URL}/api/v1/recruiter/stats", headers=headers)
print(f"[RECRUITER ROUTER] GET /api/v1/recruiter/stats -> Status Code: {r_stats.status_code}, Stats: {r_stats.json()}")
assert r_stats.status_code == 200

# 4. Registered Candidates
r_cands = requests.get(f"{BASE_URL}/api/v1/recruiter/registered-candidates", headers=headers)
print(f"[CANDIDATES ROUTER] GET /api/v1/recruiter/registered-candidates -> Status Code: {r_cands.status_code}, Candidates Count: {len(r_cands.json())}")
assert r_cands.status_code == 200

# 5. Jobs List
r_jobs = requests.get(f"{BASE_URL}/api/v1/jobs/my-jobs", headers=headers)
print(f"[JOBS ROUTER] GET /api/v1/jobs/my-jobs -> Status Code: {r_jobs.status_code}")
assert r_jobs.status_code == 200

print("\n=========================================================================")
print("[PASS] DOCKER BACKEND CONTAINER IS 100% HEALTHY & ALL ROUTERS OPERATIONAL!")
print("=========================================================================\n")
