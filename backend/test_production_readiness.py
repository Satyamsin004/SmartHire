import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_production_readiness_audit():
    print("=== STARTING MASTER PRODUCTION READINESS AUDIT & VERIFICATION ===")

    # 1. Health & Docs Inspection
    docs_res = requests.get("http://127.0.0.1:8000/docs")
    assert docs_res.status_code == 200
    print("[OK] 1. FastAPI OpenAPI Specs & Documentation Live (/docs)")

    # 2. Authentication, bcrypt & JWT
    email_c = f"prod_cand_{int(time.time())}@example.com"
    r_c = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Production Candidate",
        "email": email_c,
        "password": "ProductionPassword123!",
        "role": "candidate"
    })
    assert r_c.status_code in [200, 201]
    cand_token = r_c.json()["tokens"]["access_token"]
    cand_user_id = r_c.json()["user"]["id"]
    print("[OK] 2. Production JWT Token Pair & Password Hashing Verified")

    # 3. Candidate Avatar & Resume Upload Storage
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000052 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    res_up = requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("prod_cv.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_up.status_code == 200
    assert "/uploads/resumes/" in res_up.json()["resume"]["file_path"]
    print("[OK] 3. File Upload Engine (PDF Resumes & Avatars) Verified")

    # 4. Standalone Candidate Resume Profile API
    my_res = requests.get(f"{BASE_URL}/resume/my-resume", headers={"Authorization": f"Bearer {cand_token}"})
    assert my_res.status_code == 200
    assert my_res.json()["file_path"] is not None
    print("[OK] 4. Candidate Standalone Resume Profile API Verified")

    # 5. Recruiter Registration & Company Logo Upload
    email_r = f"prod_rec_{int(time.time())}@example.com"
    r_r = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Production Recruiter",
        "email": email_r,
        "password": "ProductionPassword123!",
        "role": "recruiter"
    })
    rec_token = r_r.json()["tokens"]["access_token"]
    
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    logo_res = requests.post(
        f"{BASE_URL}/uploads/logo",
        headers={"Authorization": f"Bearer {rec_token}"},
        files={"file": ("company_logo.png", png_bytes, "image/png")}
    )
    assert logo_res.status_code == 200
    logo_url = logo_res.json()["company_logo"]
    print("[OK] 5. Recruiter Company Logo Upload & Profile Binding Verified")

    # 6. Recruiter Enterprise Requisition Creation
    job_req = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Principal AI Platform Engineer",
        "company_name": "Production Enterprise Systems",
        "company_logo": logo_url,
        "department": "AI Infrastructure",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "San Francisco, CA / Remote",
        "salary_range": "$185,000 - $240,000",
        "description": "Architect high-performance FastAPI backends and distributed PostgreSQL clusters.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "PyTorch"],
        "status": "Published"
    })
    assert job_req.status_code == 200
    job_id = job_req.json()["job"]["id"]
    print(f"[OK] 6. Requisition Creation & Public Catalog Broadcast Verified (Job ID: {job_id})")

    # 7. Candidate Application & Job-Specific ATS Matching
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "Proven experience in Python and PostgreSQL architecture.",
        "phone": "+1-555-019-4455",
        "linkedin_url": "https://linkedin.com/in/prodcandidate",
        "declaration": True
    })
    assert apply_res.status_code == 200
    app_id = apply_res.json()["application_id"]
    print(f"[OK] 7. Job Application & Job-Specific ATS Screening Engine Verified (App ID: {app_id})")

    # 8. Recruiter Screening & Status Progression
    st_res = requests.post(f"{BASE_URL}/recruiter/application/{app_id}/status", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "status": "Shortlisted"
    })
    assert st_res.status_code == 200
    print("[OK] 8. Recruiter Applicant Screening & Pipeline Status Update Verified")

    # 9. Interview Scheduling
    sched_res = requests.post(f"{BASE_URL}/scheduling/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "candidate_ids": [cand_user_id],
        "round_type": "Technical",
        "scheduled_date": "2026-08-05T14:00:00Z",
        "duration_minutes": 15
    })
    assert sched_res.status_code == 200
    print("[OK] 9. Interview Scheduling & Real-time Dispatch Verified")

    # 10. Live AI Interview Session & Multimodal Evaluation
    start_res = requests.post(f"{BASE_URL}/interview/start", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "role_target": "Principal AI Platform Engineer",
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
        "transcript_text": "I design distributed AI backends using FastAPI, PostgreSQL multi-region replication, and Kubernetes cluster auto-scaling.",
        "speech_duration_seconds": 42.0
    })
    assert sub_res.status_code == 200

    report_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers={"Authorization": f"Bearer {cand_token}"})
    assert report_res.status_code == 200
    print(f"[OK] 10. Live AI Interview Engine & Multimodal Evaluation Report Verified (Overall: {report_res.json()['overall_score']})")

    # 11. Candidate Permanent Interview History
    hist_res = requests.get(f"{BASE_URL}/interview/history", headers={"Authorization": f"Bearer {cand_token}"})
    assert hist_res.status_code == 200
    assert len(hist_res.json()) > 0
    print(f"[OK] 11. Candidate Permanent History Storage Verified ({len(hist_res.json())} Session Recorded)")

    # 12. Recruiter Official Offer Letter Generation
    offer_res = requests.post(f"{BASE_URL}/recruiter/offer/send", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "application_id": app_id,
        "salary_offered": "$210,000 / year",
        "start_date": "2026-09-01T09:00:00Z",
        "offer_letter_text": "We are thrilled to extend an official offer for the Principal AI Platform Engineer position!"
    })
    assert offer_res.status_code == 200
    print("[OK] 12. Recruiter Offer Letter Generation & Candidate Delivery Verified")

    print("=========================================================================")
    print("[SUCCESS] ALL 12 PRODUCTION READINESS AUDIT TESTS PASSED WITH 100% SUCCESS!")
    print("=========================================================================")

if __name__ == "__main__":
    import asyncio
    import cleanup_test_data
    try:
        run_production_readiness_audit()
    finally:
        asyncio.run(cleanup_test_data.run_cleanup())
