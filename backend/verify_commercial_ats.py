import requests
import time

BASE_URL = "http://localhost:8000/api/v1"

def run_commercial_ats_verification():
    print("=== STARTING COMMERCIAL ATS END-TO-END VERIFICATION ===")

    # 1. Register Candidate Satyam with explicit role parameter
    cand_email = f"satyam_ats_{int(time.time())}@example.com"
    r1 = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Satyam Developer",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    assert r1.status_code in [200, 201]
    cand_token = r1.json()["tokens"]["access_token"]
    cand_user_id = r1.json()["user"]["id"]
    print(f"✓ Candidate Satyam Registered with Role: Candidate (ID: {cand_user_id})")

    # 2. Candidate PDF Resume Upload (Standalone Hub Storage)
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    res_upload = requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("satyam_cv.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_upload.status_code == 200
    res_data = res_upload.json()["resume"]
    assert "/uploads/resumes/" in res_data["file_path"]
    print(f"✓ Candidate PDF Resume Uploaded & Saved to PostgreSQL: {res_data['file_path']}")

    # 3. Retrieve Stored Resume via Standalone Hub API
    my_res = requests.get(f"{BASE_URL}/resume/my-resume", headers={"Authorization": f"Bearer {cand_token}"})
    assert my_res.status_code == 200
    assert my_res.json()["file_path"] == res_data["file_path"]
    print("✓ Standalone Resume Hub API (/resume/my-resume) Verified")

    # 4. Register Recruiter Ravi
    rec_email = f"ravi_recruiter_{int(time.time())}@example.com"
    r2 = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Ravi Recruiter",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    assert r2.status_code in [200, 201]
    rec_token = r2.json()["tokens"]["access_token"]
    print("✓ Recruiter Ravi Registered with Role: Recruiter")

    # 5. Upload Company Logo
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    logo_res = requests.post(
        f"{BASE_URL}/uploads/logo",
        headers={"Authorization": f"Bearer {rec_token}"},
        files={"file": ("techcorp_logo.png", png_bytes, "image/png")}
    )
    assert logo_res.status_code == 200
    logo_url = logo_res.json()["company_logo"]
    print(f"✓ Recruiter Company Logo Uploaded: {logo_url}")

    # 6. Recruiter creates & publishes Job Requisition with Logo & Enterprise Fields
    job_req = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Staff Cloud Systems Architect",
        "company_name": "TechCorp Global",
        "company_logo": logo_url,
        "department": "Infrastructure",
        "employment_type": "Full Time",
        "work_mode": "Hybrid",
        "experience_required": "5+ Years",
        "location": "San Francisco, CA",
        "salary_range": "$170,000 - $220,000",
        "description": "Design resilient microservices, FastAPI gateways, PostgreSQL clusters, and Kubernetes infrastructure.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "Docker"],
        "status": "Published"
    })
    assert job_req.status_code == 200
    job_id = job_req.json()["job"]["id"]
    print(f"✓ Recruiter Published Job Requisition. Job ID: {job_id}")

    # 7. Candidate discovers job requisition
    pub_res = requests.get(f"{BASE_URL}/jobs/public")
    assert pub_res.status_code == 200
    pub_jobs = pub_res.json()
    assert len(pub_jobs) > 0
    created_job = next((j for j in pub_jobs if j["id"] == job_id), None)
    assert created_job is not None
    assert created_job["company_logo"] == logo_url
    print(f"✓ Candidate Discovered Published Job Requisition with Company Logo: {created_job['company_logo']}")

    # 8. Candidate applies for job (triggers Job-Specific ATS Matching)
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "Strong distributed systems background in Python and FastAPI.",
        "phone": "+1-555-019-9988",
        "current_ctc": "$140,000 / yr",
        "expected_ctc": "$180,000 / yr",
        "notice_period": "2 Weeks",
        "declaration": True
    })
    assert apply_res.status_code == 200
    app_data = apply_res.json()
    assert app_data["ats_score"] is not None
    print(f"✓ Candidate Applied for Job. Job-Specific ATS Match Score: {app_data['ats_score']}% ({app_data['status']})")

    # 9. Start Live AI Interview Session
    interview_req = requests.post(f"{BASE_URL}/interview/start", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "role_target": "Staff Cloud Systems Architect",
        "round_type": "Technical",
        "difficulty": "Hard",
        "duration_minutes": 10
    })
    assert interview_req.status_code == 200
    session_id = interview_req.json()["session_id"]
    print(f"✓ Live AI Interview Session Started. Session ID: {session_id}")

    # 10. Verify Candidate Identity Authorization (Prevent User B from accessing Session ID)
    r_other = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Ravi Candidate",
        "email": f"other_{int(time.time())}@example.com",
        "password": "Password123!",
        "role": "candidate"
    })
    other_token = r_other.json()["tokens"]["access_token"]
    unauth_report = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert unauth_report.status_code == 403
    print("✓ Interview Identity Isolation Verified (Forbidden 403 returned on cross-user access)")

    # 11. Complete Interview Evaluation
    report_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {cand_token}"})
    assert report_res.status_code == 200
    rep = report_res.json()
    print(f"✓ Interview Report Generated. Overall Score: {rep['overall_score']}")

    # 12. Recruiter Applications Pipeline Retrieval
    rec_apps = requests.get(f"{BASE_URL}/recruiter/applications", headers={"Authorization": f"Bearer {rec_token}"})
    assert rec_apps.status_code == 200
    app_list = rec_apps.json()
    assert len(app_list) > 0
    print(f"✓ Recruiter Applicant Pipeline Verified ({len(app_list)} Candidates Submitted)")

    print("\n=== ALL COMMERCIAL ATS END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_commercial_ats_verification()
