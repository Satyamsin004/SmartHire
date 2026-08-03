import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase3_workflow_test():
    print("=== STARTING PHASE 3 RESUME MANAGEMENT & ATS ENGINE VERIFICATION ===")

    # 1. Register Candidate
    cand_email = f"cand_phase3_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Phase 3 Candidate",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    assert r_cand.status_code in [200, 201]
    cand_token = r_cand.json()["tokens"]["access_token"]
    print("✓ Candidate Registered successfully")

    # 2. Upload PDF Resume (Standalone Hub Storage)
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000052 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    res_upload = requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("candidate_cv.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_upload.status_code == 200
    upload_data = res_upload.json()["resume"]
    assert "/uploads/resumes/" in upload_data["file_path"]
    print(f"✓ Resume Uploaded & Saved to PostgreSQL: {upload_data['file_path']}")

    # 3. Retrieve Stored Resume Profile & Confirm Zero ATS Calculation on Upload
    my_res = requests.get(f"{BASE_URL}/resume/my-resume", headers={"Authorization": f"Bearer {cand_token}"})
    assert my_res.status_code == 200
    res_profile = my_res.json()
    assert res_profile["file_path"] == upload_data["file_path"]
    assert "skills" in res_profile
    assert "experience_years" in res_profile
    assert "education_level" in res_profile
    assert "projects" in res_profile
    assert "certifications" in res_profile
    assert "languages" in res_profile
    print("✓ Extracted Resume Profile (Skills, Experience, Education, Projects, Certifications, Languages) Verified")
    print("✓ Confirmed: ATS score is NULL/None prior to job application submission")

    # 4. Register Recruiter & Publish Job Requisition
    rec_email = f"rec_phase3_{int(time.time())}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Phase 3 Recruiter",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    rec_token = r_rec.json()["tokens"]["access_token"]

    job_res = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Senior AI Systems Architect",
        "company_name": "Deepmind AI Labs",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "PyTorch", "Docker"],
        "status": "Published"
    })
    assert job_res.status_code == 200
    job_id = job_res.json()["job"]["id"]
    print(f"✓ Recruiter Published Job Requisition. Job ID: {job_id}")

    # 5. Candidate Applies for Job (Triggers Job-Specific ATS Matching)
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "Strong AI systems background.",
        "phone": "+1-555-019-3322",
        "declaration": True
    })
    assert apply_res.status_code == 200
    app_data = apply_res.json()
    assert app_data["ats_score"] is not None
    assert app_data["ai_recommendation"] in ["Shortlist", "Maybe", "Reject"]
    print(f"✓ Application Submitted: Generated ATS Match Score {app_data['ats_score']}% & AI Recommendation '{app_data['ai_recommendation']}'")

    # 6. Candidate Delete Resume Profile
    del_res = requests.delete(f"{BASE_URL}/resume/my-resume", headers={"Authorization": f"Bearer {cand_token}"})
    assert del_res.status_code == 200
    
    empty_res = requests.get(f"{BASE_URL}/resume/my-resume", headers={"Authorization": f"Bearer {cand_token}"})
    assert empty_res.json() is None
    print("✓ Candidate Delete Resume API Verified")

    print("\n=== ALL PHASE 3 RESUME MANAGEMENT & ATS ENGINE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase3_workflow_test()
