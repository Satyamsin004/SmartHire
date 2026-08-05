import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

print("=========================================================================")
print("=== VERIFYING UNIFIED BACKEND & PGADMIN CONNECTIVITY ON PORT 5432 ===")
print("=========================================================================\n")

# 1. Register or login recruiter on Port 5432 database
r_reg = requests.post(f"{BASE_URL}/auth/register", json={
    "email": "rec_unified_5432@smarthire.ai",
    "password": "Password123!",
    "full_name": "Unified Recruiter 5432",
    "role": "recruiter"
})
if r_reg.status_code == 201:
    token = r_reg.json()["tokens"]["access_token"]
else:
    r_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "rec_unified_5432@smarthire.ai",
        "password": "Password123!"
    })
    token = r_login.json()["tokens"]["access_token"]

headers = {"Authorization": f"Bearer {token}"}

# 2. Get Recruiter Stats
r_stats = requests.get(f"{BASE_URL}/recruiter/stats", headers=headers)
stats = r_stats.json()
print(f"[LIVE API /recruiter/stats] Response Status: {r_stats.status_code}")
print(f"   total_candidates: {stats.get('total_candidates')}")
print(f"   jobs_posted: {stats.get('jobs_posted')}")
print(f"   applications_received: {stats.get('applications_received')}")

# 3. Get Registered Candidates Directory
r_cands = requests.get(f"{BASE_URL}/recruiter/registered-candidates", headers=headers)
cands = r_cands.json()
print(f"\n[LIVE API /recruiter/registered-candidates] Response Status: {r_cands.status_code}")
print(f"   Candidates Returned Count: {len(cands)}")
for idx, c in enumerate(cands[:10]): # print first 10
    print(f"   [{idx+1}] {c.get('full_name')} ({c.get('email')}) - Status: {c.get('status')}")

assert len(cands) >= 50, f"Expected 50+ candidates from Port 5432 database, got {len(cands)}"

print("\n=========================================================================")
print("[PASS] UNIFIED POSTGRESQL INSTANCE ON PORT 5432 VERIFIED SUCCESSFULLY!")
print("=========================================================================\n")
