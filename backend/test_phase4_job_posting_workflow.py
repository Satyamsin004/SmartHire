import requests
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase4_job_posting_workflow_tests():
    print("=========================================================================")
    print("=== STARTING PHASE 4 RECRUITER JOB POSTING WORKFLOW VERIFICATION SUITE ===")
    print("=========================================================================\n")

    timestamp = int(time.time())

    # 1. Register / Login Recruiter A
    email_rec_a = f"recruiter_a_{timestamp}@recruiter.com"
    pwd = "Password123!"
    reg_rec_a = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Recruiter Alice",
        "email": email_rec_a,
        "password": pwd,
        "role": "recruiter"
    })
    assert reg_rec_a.status_code in [200, 201], f"Recruiter A reg failed: {reg_rec_a.text}"
    tok_rec_a = reg_rec_a.json()["tokens"]["access_token"]
    headers_rec_a = {"Authorization": f"Bearer {tok_rec_a}"}

    # 2. Register / Login Recruiter B
    email_rec_b = f"recruiter_b_{timestamp}@recruiter.com"
    reg_rec_b = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Recruiter Bob",
        "email": email_rec_b,
        "password": pwd,
        "role": "recruiter"
    })
    assert reg_rec_b.status_code in [200, 201], f"Recruiter B reg failed: {reg_rec_b.text}"
    tok_rec_b = reg_rec_b.json()["tokens"]["access_token"]
    headers_rec_b = {"Authorization": f"Bearer {tok_rec_b}"}

    # 3. Register / Login Candidate A & B
    email_cand_a = f"candidate_a_{timestamp}@candidate.com"
    email_cand_b = f"candidate_b_{timestamp}@candidate.com"

    reg_cand_a = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Candidate Charlie",
        "email": email_cand_a,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_cand_a.status_code in [200, 201]
    tok_cand_a = reg_cand_a.json()["tokens"]["access_token"]
    headers_cand_a = {"Authorization": f"Bearer {tok_cand_a}"}

    reg_cand_b = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Candidate Diana",
        "email": email_cand_b,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_cand_b.status_code in [200, 201]
    tok_cand_b = reg_cand_b.json()["tokens"]["access_token"]
    headers_cand_b = {"Authorization": f"Bearer {tok_cand_b}"}

    print("✓ Step 1-3 Passed: Created Recruiter A, Recruiter B, Candidate A, and Candidate B.")

    # 4. Recruiter A Posts & Publishes Job A
    job_a_title = f"Senior React Lead {timestamp}"
    job_a_res = requests.post(f"{BASE_URL}/jobs/create", headers=headers_rec_a, json={
        "title": job_a_title,
        "company_name": "Alice Tech Global",
        "department": "Engineering",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "San Francisco, CA",
        "salary_range": "$160,000 - $200,000",
        "description": "Lead the frontend team in building React applications.",
        "education_required": "Bachelor's degree in Computer Science",
        "required_skills": ["React", "TypeScript", "TailwindCSS"],
        "status": "Published"
    })
    assert job_a_res.status_code in [200, 201], f"Job A create failed: {job_a_res.text}"
    job_a_id = job_a_res.json()["job"]["id"]
    print(f"✓ Step 4 Passed: Recruiter A published Job A ({job_a_title}).")

    # 5. Recruiter B Posts & Publishes Job B
    job_b_title = f"Principal FastAPI Architect {timestamp}"
    job_b_res = requests.post(f"{BASE_URL}/jobs/create", headers=headers_rec_b, json={
        "title": job_b_title,
        "company_name": "Bob Cloud Inc",
        "department": "Infrastructure",
        "employment_type": "Full Time",
        "work_mode": "Hybrid",
        "experience_required": "7+ Years",
        "location": "New York, NY",
        "salary_range": "$180,000 - $220,000",
        "description": "Architect high performance FastAPI backends with PostgreSQL.",
        "education_required": "Master's degree in Software Engineering",
        "required_skills": ["FastAPI", "Python", "PostgreSQL", "Docker"],
        "status": "Published"
    })
    assert job_b_res.status_code in [200, 201], f"Job B create failed: {job_b_res.text}"
    job_b_id = job_b_res.json()["job"]["id"]
    print(f"✓ Step 5 Passed: Recruiter B published Job B ({job_b_title}).")

    # 6. Candidate A & Candidate B Job Catalog Verification
    pub_jobs_res_a = requests.get(f"{BASE_URL}/jobs/public", headers=headers_cand_a)
    assert pub_jobs_res_a.status_code == 200
    pub_jobs_a = pub_jobs_res_a.json()
    job_ids_cand_a = [j["id"] for j in pub_jobs_a]
    assert job_a_id in job_ids_cand_a, "Job A missing from Candidate A view!"
    assert job_b_id in job_ids_cand_a, "Job B missing from Candidate A view!"

    pub_jobs_res_b = requests.get(f"{BASE_URL}/jobs/public", headers=headers_cand_b)
    assert pub_jobs_res_b.status_code == 200
    pub_jobs_b = pub_jobs_res_b.json()
    job_ids_cand_b = [j["id"] for j in pub_jobs_b]
    assert job_a_id in job_ids_cand_b, "Job A missing from Candidate B view!"
    assert job_b_id in job_ids_cand_b, "Job B missing from Candidate B view!"

    print("✓ Step 6 Passed: Both Candidate A and Candidate B can view BOTH published jobs.")

    # 7. Recruiter Workspace Isolation Verification
    my_jobs_res_a = requests.get(f"{BASE_URL}/jobs/my-jobs", headers=headers_rec_a)
    assert my_jobs_res_a.status_code == 200
    my_jobs_a = my_jobs_res_a.json()["jobs"]
    ids_rec_a = [j["id"] for j in my_jobs_a]
    assert job_a_id in ids_rec_a, "Job A missing from Recruiter A workspace!"
    assert job_b_id not in ids_rec_a, "DATA LEAK: Recruiter A can see Recruiter B's job!"

    my_jobs_res_b = requests.get(f"{BASE_URL}/jobs/my-jobs", headers=headers_rec_b)
    assert my_jobs_res_b.status_code == 200
    my_jobs_b = my_jobs_res_b.json()["jobs"]
    ids_rec_b = [j["id"] for j in my_jobs_b]
    assert job_b_id in ids_rec_b, "Job B missing from Recruiter B workspace!"
    assert job_a_id not in ids_rec_b, "DATA LEAK: Recruiter B can see Recruiter A's job!"

    print("✓ Step 7 Passed: Strict Recruiter workspace isolation verified (Zero Data Leakage).")

    # 8. Cross-Recruiter Security Check
    forbidden_edit_res = requests.post(f"{BASE_URL}/jobs/{job_a_id}/close", headers=headers_rec_b)
    assert forbidden_edit_res.status_code == 403, f"Security Breach: Recruiter B closed Recruiter A's job! ({forbidden_edit_res.status_code})"

    forbidden_delete_res = requests.delete(f"{BASE_URL}/jobs/{job_a_id}", headers=headers_rec_b)
    assert forbidden_delete_res.status_code == 403, f"Security Breach: Recruiter B deleted Recruiter A's job! ({forbidden_delete_res.status_code})"

    print("✓ Step 8 Passed: Security RBAC checks block Recruiter B from modifying Recruiter A's job (403 Forbidden).")

    # 9. Candidate Real-Time Notification Verification
    notif_res = requests.get(f"{BASE_URL}/notifications", headers=headers_cand_a)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    notif_titles = [n["title"] for n in notifs]
    assert any(job_a_title in t for t in notif_titles), f"Candidate notification for Job A missing! Notifs: {notif_titles}"

    print("✓ Step 9 Passed: Candidate notifications automatically dispatched upon job publish.")

    print("\n=========================================================================")
    print("=== ALL PHASE 4 RECRUITER JOB POSTING WORKFLOW TESTS PASSED SUCCESSFULLY! ===")
    print("=========================================================================")

if __name__ == "__main__":
    run_phase4_job_posting_workflow_tests()
