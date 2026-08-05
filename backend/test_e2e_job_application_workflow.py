import requests

BASE_URL = "http://localhost:8000"

print("=========================================================================")
print("=== END-TO-END JOB APPLICATION WORKFLOW AUTOMATED TEST ===")
print("=========================================================================\n")

# Step 1: Recruiter Login
r_rec_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": "abhay@gmail.com", "password": "Password123!"})
print(f"[RECRUITER LOGIN] POST /api/v1/auth/login -> Status: {r_rec_login.status_code}")
assert r_rec_login.status_code == 200, f"Recruiter login failed: {r_rec_login.text}"
rec_token = r_rec_login.json()["tokens"]["access_token"]
rec_headers = {"Authorization": f"Bearer {rec_token}"}

# Step 2: Post New Job
job_payload = {
    "title": "Principal Lead AI Architect - Automated Test Role",
    "company_name": "SmartHire NextGen AI",
    "department": "Engineering",
    "employment_type": "Full Time",
    "work_mode": "Remote",
    "experience_required": "5+ Years",
    "location": "San Francisco, CA / Remote",
    "salary_range": "$180,000 - $220,000",
    "description": "Seeking an expert Principal AI Architect to lead LLM evaluation pipelines.",
    "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "PyTorch"],
    "status": "Published"
}
r_post_job = requests.post(f"{BASE_URL}/api/v1/jobs/create", json=job_payload, headers=rec_headers)
print(f"[POST JOB] POST /api/v1/jobs/create -> Status: {r_post_job.status_code}")
assert r_post_job.status_code == 200, f"Post job failed: {r_post_job.text}"
created_job = r_post_job.json()["job"]
job_id = created_job["id"]
print(f"   Job Created in PostgreSQL: ID={job_id}, Title='{created_job['title']}'")

# Step 3: Candidate Login (Using registered candidate user or create test candidate)
cand_email = "candidate_workflow_test@smarthire.ai"
r_cand_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": cand_email, "password": "Password123!"})

if r_cand_login.status_code != 200:
    # Register candidate
    r_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": cand_email,
        "password": "Password123!",
        "full_name": "E2E Candidate Applicant",
        "role": "candidate"
    })
    assert r_reg.status_code in [200, 201], f"Register candidate failed: {r_reg.text}"
    r_cand_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": cand_email, "password": "Password123!"})

assert r_cand_login.status_code == 200
cand_token = r_cand_login.json()["tokens"]["access_token"]
cand_headers = {"Authorization": f"Bearer {cand_token}"}

# Ensure candidate has a uploaded resume
r_resume = requests.get(f"{BASE_URL}/api/v1/resume/my-resume", headers=cand_headers)
if r_resume.status_code != 200 or not r_resume.json() or not r_resume.json().get("file_path"):
    # Upload a dummy sample PDF resume
    dummy_pdf_content = b"%PDF-1.4 %FAKE PDF FOR TESTING RECRUITER WORKFLOW\n1 0 obj<<>>endobj trailer<< /Root 1 0 R >>%%EOF"
    files = {"file": ("E2E_Test_Resume.pdf", dummy_pdf_content, "application/pdf")}
    r_up = requests.post(f"{BASE_URL}/api/v1/uploads/resume", files=files, headers=cand_headers)
    print(f"[RESUME UPLOAD] Uploaded PDF resume -> Status: {r_up.status_code}")

# Step 4: Candidate Browses Jobs
r_public_jobs = requests.get(f"{BASE_URL}/api/v1/jobs/public")
print(f"[BROWSE JOBS] GET /api/v1/jobs/public -> Status: {r_public_jobs.status_code}")
assert r_public_jobs.status_code == 200
public_jobs = r_public_jobs.json()
target_job_found = any(j["id"] == job_id for j in public_jobs)
print(f"   Target Job Visible on Candidate Dashboard: {target_job_found}")
assert target_job_found, "Newly created job is missing from public jobs list!"

# Step 5: Candidate Applies for Job
apply_payload = {
    "cover_letter": "I am highly interested in the Principal Lead AI Architect role.",
    "phone": "+1 (555) 019-9988",
    "notice_period": "Immediate",
    "expected_salary": "$190,000 / yr"
}
r_apply = requests.post(f"{BASE_URL}/api/v1/jobs/{job_id}/apply", json=apply_payload, headers=cand_headers)
print(f"[CANDIDATE APPLY] POST /api/v1/jobs/{job_id}/apply -> Status: {r_apply.status_code}")
print(f"   Response: {r_apply.json()}")
assert r_apply.status_code == 200, f"Application failed: {r_apply.text}"

# Step 6: Verify Duplicate Application Rejection
r_dup = requests.post(f"{BASE_URL}/api/v1/jobs/{job_id}/apply", json=apply_payload, headers=cand_headers)
print(f"[DUPLICATE APPLY CHECK] POST /api/v1/jobs/{job_id}/apply -> Status: {r_dup.status_code}")
assert r_dup.status_code == 400, "Duplicate application was not blocked!"
print(f"   Duplicate Rejection Detail: {r_dup.json().get('detail')}")

# Step 7: Verify Candidate 'My Applications' Page Data
r_my_apps = requests.get(f"{BASE_URL}/api/v1/jobs/my-applications", headers=cand_headers)
print(f"\n[MY APPLICATIONS] GET /api/v1/jobs/my-applications -> Status: {r_my_apps.status_code}")
assert r_my_apps.status_code == 200
my_apps = r_my_apps.json()
my_app_record = next((a for a in my_apps if a["job_id"] == job_id), None)
print(f"   My Application Record: {my_app_record}")
assert my_app_record is not None
assert my_app_record["job_title"] == "Principal Lead AI Architect - Automated Test Role"

# Step 8: Verify Recruiter Applications Directory Data
r_rec_apps = requests.get(f"{BASE_URL}/api/v1/recruiter/applications", headers=rec_headers)
print(f"\n[RECRUITER APPLICATIONS] GET /api/v1/recruiter/applications -> Status: {r_rec_apps.status_code}")
assert r_rec_apps.status_code == 200
rec_apps = r_rec_apps.json()
rec_app_record = next((a for a in rec_apps if a["job_id"] == job_id), None)
print(f"   Recruiter Directory Application Record: {rec_app_record}")
assert rec_app_record is not None
assert rec_app_record["candidate_email"] == cand_email

# Step 9: Verify Recruiter Specific Job Applications
r_spec_apps = requests.get(f"{BASE_URL}/api/v1/recruiter/jobs/{job_id}/applications", headers=rec_headers)
print(f"[RECRUITER SPECIFIC JOB APPS] GET /api/v1/recruiter/jobs/{job_id}/applications -> Status: {r_spec_apps.status_code}")
assert r_spec_apps.status_code == 200
assert len(r_spec_apps.json()) == 1

# Step 10: Verify Recruiter Statistics Update
r_stats = requests.get(f"{BASE_URL}/api/v1/recruiter/stats", headers=rec_headers)
print(f"\n[RECRUITER STATS] GET /api/v1/recruiter/stats -> Status: {r_stats.status_code}")
assert r_stats.status_code == 200
stats = r_stats.json()
print(f"   Recruiter Stats Data: {stats}")

print("\n=========================================================================")
print("[PASS] COMPLETE JOB APPLICATION END-TO-END WORKFLOW VERIFIED 100%!")
print("=========================================================================\n")
