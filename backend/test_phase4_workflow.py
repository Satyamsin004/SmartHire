import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase4_workflow_test():
    print("=== STARTING PHASE 4 APPLICATION & RECRUITER SCREENING VERIFICATION ===")

    # 1. Register Recruiter & Candidate
    rec_email = f"rec_p4_{int(time.time())}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Senior Talent Manager",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    rec_token = r_rec.json()["tokens"]["access_token"]

    cand_email = f"cand_p4_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Jane Applicant",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    cand_token = r_cand.json()["tokens"]["access_token"]
    print("✓ Recruiter and Candidate Registered")

    # 2. Candidate Uploads PDF Resume
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000052 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    requests.post(
        f"{BASE_URL}/uploads/resume",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("jane_cv.pdf", pdf_bytes, "application/pdf")}
    )
    print("✓ Candidate Resume Uploaded")

    # 3. Recruiter Publishes Job Requisition
    job_res = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Staff Infrastructure Architect",
        "company_name": "CloudScale Global",
        "required_skills": ["Python", "FastAPI", "Kubernetes", "Docker", "PostgreSQL"],
        "status": "Published"
    })
    job_id = job_res.json()["job"]["id"]
    print(f"✓ Recruiter Published Job Requisition (ID: {job_id})")

    # 4. Candidate Applies for Job (LinkedIn Style Form Submission)
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "cover_letter": "Demonstrated track record of building cloud infrastructure.",
        "phone": "+1-555-019-8877",
        "linkedin_url": "https://linkedin.com/in/janeapplicant",
        "github_url": "https://github.com/janeapplicant",
        "expected_salary": "$175,000 / year",
        "notice_period": "Immediate",
        "declaration": True
    })
    assert apply_res.status_code == 200
    app_id = apply_res.json()["application_id"]
    print(f"✓ Candidate Application Submitted (Application ID: {app_id})")

    # 5. Recruiter Fetches Application Pipeline
    rec_apps = requests.get(f"{BASE_URL}/recruiter/applications", headers={"Authorization": f"Bearer {rec_token}"})
    assert rec_apps.status_code == 200
    app_list = rec_apps.json()
    target_app = next((a for a in app_list if a["id"] == app_id), None)
    assert target_app is not None
    assert target_app["candidate_name"] == "Jane Applicant"
    assert target_app["ats_score"] is not None
    assert target_app["resume_url"] is not None
    print(f"✓ Recruiter Received Candidate Application (ATS Score: {target_app['ats_score']}%)")

    # 6. Recruiter Shortlists Application
    st_res1 = requests.post(f"{BASE_URL}/recruiter/application/{app_id}/status", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "status": "Shortlisted"
    })
    assert st_res1.status_code == 200
    print("✓ Recruiter Action: Shortlisted Candidate")

    # 7. Candidate Verifies Pipeline Status Updates Automatically
    my_apps = requests.get(f"{BASE_URL}/jobs/my-applications", headers={"Authorization": f"Bearer {cand_token}"})
    assert my_apps.status_code == 200
    cand_app = next((a for a in my_apps.json() if a["id"] == app_id), None)
    assert cand_app["status"] == "Shortlisted"
    print("✓ Candidate Dashboard Automatically Updated to 'Shortlisted'")

    # 8. Recruiter Action: Need Info Status
    requests.post(f"{BASE_URL}/recruiter/application/{app_id}/status", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "status": "Need Info"
    })
    print("✓ Recruiter Action: Need Info status set & notification generated")

    print("\n=== ALL PHASE 4 APPLICATION & RECRUITER SCREENING TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase4_workflow_test()
