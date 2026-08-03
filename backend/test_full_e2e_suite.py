import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_e2e_testing_suite():
    print("=========================================================================")
    print("=== STARTING COMPLETE END-TO-END (E2E) PLATFORM TESTING AUDIT ===")
    print("=========================================================================\n")

    timestamp = int(time.time())

    # -------------------------------------------------------------------------
    # WORKFLOW 1: ADMIN WORKFLOW
    # -------------------------------------------------------------------------
    print("--- WORKFLOW 1: ADMIN WORKFLOW ---")
    admin_email = f"admin_e2e_{timestamp}@example.com"
    r_adm_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "System Administrator",
        "email": admin_email,
        "password": "AdminPassword123!",
        "role": "admin"
    })
    assert r_adm_reg.status_code in [200, 201]
    admin_token = r_adm_reg.json()["tokens"]["access_token"]
    print("[OK] Admin Registered & Authenticated")

    admin_stats = requests.get(f"{BASE_URL}/admin/dashboard-stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_stats.status_code == 200
    print("[OK] Admin Dashboard Overview Stats Retrieved")

    admin_users = requests.get(f"{BASE_URL}/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_users.status_code == 200
    print(f"[OK] Admin User Management Query Verified ({len(admin_users.json())} Users Listed)")

    admin_recs = requests.get(f"{BASE_URL}/admin/recruiters", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_recs.status_code == 200
    print("[OK] Admin Recruiter Management Query Verified\n")

    # -------------------------------------------------------------------------
    # WORKFLOW 2: RECRUITER WORKFLOW
    # -------------------------------------------------------------------------
    print("--- WORKFLOW 2: RECRUITER WORKFLOW ---")
    rec_email = f"rec_e2e_{timestamp}@example.com"
    r_rec_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "VP of Talent Acquisition",
        "email": rec_email,
        "password": "RecruiterPassword123!",
        "role": "recruiter"
    })
    assert r_rec_reg.status_code in [200, 201]
    rec_token = r_rec_reg.json()["tokens"]["access_token"]
    print("[OK] Recruiter Registered & Authenticated")

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    logo_res = requests.post(
        f"{BASE_URL}/uploads/logo",
        headers={"Authorization": f"Bearer {rec_token}"},
        files={"file": ("corp_logo.png", png_bytes, "image/png")}
    )
    assert logo_res.status_code == 200
    logo_url = logo_res.json()["company_logo"]
    print(f"[OK] Company Logo Uploaded: {logo_url}")

    # Create Draft Job
    draft_job = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Lead Distributed Systems Architect",
        "company_name": "NextGen Systems",
        "company_logo": logo_url,
        "department": "Infrastructure",
        "status": "Draft"
    })
    assert draft_job.status_code == 200
    draft_job_id = draft_job.json()["job"]["id"]
    print(f"[OK] Requisition Saved as Draft (ID: {draft_job_id})")

    # Publish Job
    pub_job = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Senior AI Systems Engineer",
        "company_name": "NextGen AI",
        "company_logo": logo_url,
        "department": "Engineering",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "4+ Years",
        "location": "New York / Remote",
        "salary_range": "$170,000 - $210,000",
        "description": "Build high-throughput FastAPI microservices and PostgreSQL database clusters.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        "status": "Published"
    })
    assert pub_job.status_code == 200
    pub_job_id = pub_job.json()["job"]["id"]
    print(f"[OK] Requisition Published (ID: {pub_job_id})")

    # Edit Job
    edit_job = requests.put(f"{BASE_URL}/jobs/{pub_job_id}", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Lead Senior AI Systems Engineer",
        "salary_range": "$180,000 - $225,000"
    })
    assert edit_job.status_code == 200
    print("[OK] Published Requisition Edited Successfully\n")

    # -------------------------------------------------------------------------
    # WORKFLOW 3: CANDIDATE WORKFLOW
    # -------------------------------------------------------------------------
    print("--- WORKFLOW 3: CANDIDATE WORKFLOW ---")
    cand_email = f"cand_e2e_{timestamp}@example.com"
    r_cand_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Satyam Candidate",
        "email": cand_email,
        "password": "CandidatePassword123!",
        "role": "candidate"
    })
    assert r_cand_reg.status_code in [200, 201]
    cand_token = r_cand_reg.json()["tokens"]["access_token"]
    cand_user_id = r_cand_reg.json()["user"]["id"]
    print("[OK] Candidate Registered & Authenticated")

    # Avatar Upload
    avatar_res = requests.post(
        f"{BASE_URL}/uploads/avatar",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("satyam_avatar.png", png_bytes, "image/png")}
    )
    assert avatar_res.status_code == 200
    print("[OK] Profile Picture Uploaded Successfully")

    # PDF Resume Upload
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000052 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    res_up = requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("satyam_resume.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_up.status_code == 200
    print("[OK] PDF Resume Uploaded & Parsed into PostgreSQL")

    # Job Search & Details
    jobs_res = requests.get(f"{BASE_URL}/jobs/published", headers={"Authorization": f"Bearer {cand_token}"})
    assert jobs_res.status_code == 200
    all_published = jobs_res.json()
    target_job = next((j for j in all_published if j["id"] == pub_job_id), None)
    assert target_job is not None
    print(f"[OK] Job Search & Details Verified (Found Job: '{target_job['title']}')")

    # Candidate Bookmark Job
    bk_res = requests.post(f"{BASE_URL}/jobs/{pub_job_id}/bookmark", headers={"Authorization": f"Bearer {cand_token}"})
    assert bk_res.status_code == 200
    print("[OK] Candidate Job Bookmarked")

    # Application Submission & ATS Screening
    apply_res = requests.post(f"{BASE_URL}/jobs/{pub_job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "I bring extensive expertise in Python microservices, FastAPI, and PostgreSQL architecture.",
        "phone": "+1-555-019-9988",
        "linkedin_url": "https://linkedin.com/in/satyamcandidate",
        "github_url": "https://github.com/satyamcandidate",
        "expected_salary": "$190,000 / year",
        "notice_period": "Immediate",
        "declaration": True
    })
    assert apply_res.status_code == 200
    app_id = apply_res.json()["application_id"]
    print(f"[OK] Candidate Application Submitted & ATS Screening Report Generated (App ID: {app_id})\n")

    # -------------------------------------------------------------------------
    # WORKFLOW 4: SCREENING, SCHEDULING & INTERVIEW
    # -------------------------------------------------------------------------
    print("--- WORKFLOW 4: SCREENING, SCHEDULING & INTERVIEW ---")
    st_res = requests.post(f"{BASE_URL}/recruiter/application/{app_id}/status", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "status": "Shortlisted"
    })
    assert st_res.status_code == 200
    print("[OK] Recruiter Action: Shortlisted Candidate")

    sched_res = requests.post(f"{BASE_URL}/scheduling/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "candidate_ids": [cand_user_id],
        "round_type": "Technical",
        "scheduled_date": "2026-08-03T11:00:00Z",
        "duration_minutes": 15
    })
    assert sched_res.status_code == 200
    print("[OK] Recruiter Action: Technical Interview Scheduled & Dispatched")

    start_res = requests.post(f"{BASE_URL}/interview/start", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "role_target": "Lead Senior AI Systems Engineer",
        "round_type": "Technical",
        "difficulty": "Hard",
        "duration_minutes": 15
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["session_id"]
    q_id = start_res.json()["questions"][0]["question_id"]

    sub_res = requests.post(f"{BASE_URL}/interview/submit-answer", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "session_id": session_id,
        "question_id": q_id,
        "transcript_text": "We build scalable backend services with FastAPI, PostgreSQL async connection pools, and Redis caching layers.",
        "speech_duration_seconds": 38.0
    })
    assert sub_res.status_code == 200
    print("[OK] Live Interview Answer Submitted & Multimodal Metrics Processed")

    report_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {cand_token}"})
    assert report_res.status_code == 200
    print(f"[OK] AI Evaluation Report Generated (Overall Score: {report_res.json()['overall_score']})")

    offer_res = requests.post(f"{BASE_URL}/recruiter/offer/send", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "application_id": app_id,
        "salary_offered": "$200,000 / year",
        "start_date": "2026-08-15T09:00:00Z",
        "offer_letter_text": "Congratulations! We are delighted to extend an official offer."
    })
    assert offer_res.status_code == 200
    print("[OK] Recruiter Action: Official Offer Letter Sent to Candidate Dashboard\n")

    print("=========================================================================")
    print("[SUCCESS] ALL END-TO-END (E2E) PLATFORM WORKFLOW TESTS PASSED 100% SUCCESSFULLY!")
    print("=========================================================================")

if __name__ == "__main__":
    import asyncio
    import cleanup_test_data
    try:
        run_e2e_testing_suite()
    finally:
        asyncio.run(cleanup_test_data.run_cleanup())
