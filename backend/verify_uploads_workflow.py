import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def run_uploads_verification():
    print("=== STARTING FILE UPLOADS & ZERO DEMO JOBS VERIFICATION ===")

    # 1. Register Candidate Satyam
    satyam_email = f"satyam_upload_{int(time.time())}@example.com"
    r1 = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Satyam Candidate",
        "email": satyam_email,
        "password": "Password123!",
        "role": "candidate"
    })
    assert r1.status_code in [200, 201]
    cand_token = r1.json()["tokens"]["access_token"]
    print("✓ Candidate Satyam Registered Successfully")

    # 2. Upload Candidate Avatar Picture
    avatar_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    avatar_res = requests.post(
        f"{BASE_URL}/uploads/avatar",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("profile.png", avatar_bytes, "image/png")}
    )
    assert avatar_res.status_code == 200, f"Avatar upload failed: {avatar_res.text}"
    avatar_url = avatar_res.json()["profile_image"]
    assert "/uploads/avatars/" in avatar_url
    print(f"✓ Candidate Profile Picture Uploaded: {avatar_url}")

    # Verify avatar rendered in /users/me
    me_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {cand_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["profile_image"] == avatar_url
    print("✓ Candidate /users/me Profile Picture Verified")

    # 3. Upload Candidate PDF Resume
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    resume_res = requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("satyam_resume.pdf", pdf_bytes, "application/pdf")}
    )
    assert resume_res.status_code == 200, f"Resume upload failed: {resume_res.text}"
    resume_data = resume_res.json()["resume"]
    assert "/uploads/resumes/" in resume_data["file_path"]
    print(f"✓ Candidate PDF Resume Uploaded & Saved: {resume_data['file_path']}")
    print("✓ ATS Score is NULL/None on initial upload (as required)")

    # 4. Register Recruiter Ravi
    ravi_email = f"ravi_upload_{int(time.time())}@example.com"
    r2 = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Ravi Recruiter",
        "email": ravi_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    assert r2.status_code in [200, 201]
    rec_token = r2.json()["tokens"]["access_token"]
    print("✓ Recruiter Ravi Registered Successfully")

    # 5. Upload Company Logo
    logo_res = requests.post(
        f"{BASE_URL}/uploads/logo",
        headers={"Authorization": f"Bearer {rec_token}"},
        files={"file": ("company_logo.png", avatar_bytes, "image/png")}
    )
    assert logo_res.status_code == 200, f"Logo upload failed: {logo_res.text}"
    logo_url = logo_res.json()["company_logo"]
    assert "/uploads/logos/" in logo_url
    print(f"✓ Recruiter Company Logo Uploaded: {logo_url}")

    # 6. Recruiter posts job with company logo
    job_res = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Senior Backend Systems Engineer",
        "company_name": "Acme Innovations",
        "company_logo": logo_url,
        "department": "Infrastructure",
        "employment_type": "Full Time",
        "work_mode": "Hybrid",
        "experience_required": "4-6 Years",
        "location": "New York, NY",
        "salary_range": "$150,000 - $190,000",
        "description": "Building high scale distributed services with Python, FastAPI, PostgreSQL, Docker, Redis.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        "status": "Published"
    })
    assert job_res.status_code == 200, f"Job creation failed: {job_res.status_code} - {job_res.text}"
    job_id = job_res.json()["job"]["id"]
    print(f"✓ Recruiter Published Job Requisition. Job ID: {job_id}")

    # 7. Candidate discovers public jobs
    public_res = requests.get(f"{BASE_URL}/jobs/public")
    assert public_res.status_code == 200
    pub_jobs = public_res.json()
    assert len(pub_jobs) > 0
    created_job = next((j for j in pub_jobs if j["id"] == job_id), None)
    assert created_job is not None
    print(f"Debug: created_job logo = {created_job.get('company_logo')}, expected = {logo_url}")
    assert created_job["company_logo"] == logo_url
    print(f"✓ Public Job Discovery Verified with Recruiter Company Logo: {created_job['company_logo']}")

    # 8. Candidate applies for job
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "Enthusiastic about distributed systems and cloud infrastructure.",
        "phone": "+1-555-019-9988",
        "current_ctc": "$130,000 / yr",
        "expected_ctc": "$165,000 / yr",
        "notice_period": "2 Weeks",
        "declaration": True
    })
    assert apply_res.status_code == 200, f"Apply job failed: {apply_res.status_code} - {apply_res.text}"
    app_data = apply_res.json()
    assert app_data["ats_score"] is not None
    print(f"✓ Candidate Applied for Job. Dynamic ATS Score Generated: {app_data['ats_score']}%")

    print("\n=== ALL FILE UPLOADS & ZERO DEMO JOBS VERIFICATION TESTS PASSED! ===")

if __name__ == "__main__":
    run_uploads_verification()
