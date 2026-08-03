import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase2_workflow_test():
    print("=== STARTING PHASE 2 RECRUITER & CANDIDATE CORE WORKFLOW VERIFICATION ===")

    # 1. Register Recruiter
    rec_email = f"rec_phase2_{int(time.time())}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Naukri Enterprise Recruiter",
        "email": rec_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    assert r_rec.status_code in [200, 201]
    rec_token = r_rec.json()["tokens"]["access_token"]
    print("✓ Recruiter Registered successfully")

    # 2. Upload Company Logo
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    logo_res = requests.post(
        f"{BASE_URL}/uploads/logo",
        headers={"Authorization": f"Bearer {rec_token}"},
        files={"file": ("company_logo.png", png_bytes, "image/png")}
    )
    assert logo_res.status_code == 200
    logo_url = logo_res.json()["company_logo"]
    print(f"✓ Company Logo Uploaded: {logo_url}")

    # 3. Recruiter creates DRAFT Job
    draft_req = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Draft Internal Engineer",
        "company_name": "Acme Inc",
        "status": "Draft"
    })
    assert draft_req.status_code == 200
    draft_job_id = draft_req.json()["job"]["id"]
    print(f"✓ Draft Job Requisition Created. ID: {draft_job_id}")

    # 4. Verify DRAFT job does NOT appear in Candidate Public Portal
    pub_res1 = requests.get(f"{BASE_URL}/jobs/public")
    assert pub_res1.status_code == 200
    public_jobs1 = pub_res1.json()
    assert not any(j["id"] == draft_job_id for j in public_jobs1)
    print("✓ Draft job confirmed isolated (NOT visible to candidates)")

    # 5. Recruiter creates PUBLISHED Job Requisition
    pub_req = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Principal Distributed Systems Engineer",
        "company_name": "Acme Global Systems",
        "company_logo": logo_url,
        "department": "Platform Infrastructure",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "6+ Years",
        "location": "New York, NY / Remote",
        "salary_range": "$180,000 - $230,000",
        "description": "Lead high-throughput FastAPI and PostgreSQL backend microservices.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "preferred_skills": ["Redis", "Kubernetes"],
        "openings": 3,
        "status": "Published"
    })
    assert pub_req.status_code == 200
    pub_job_id = pub_req.json()["job"]["id"]
    print(f"✓ Published Job Requisition Created. ID: {pub_job_id}")

    # 6. Candidate Registers & Browses Jobs
    cand_email = f"cand_phase2_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Candidate Tester",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    cand_token = r_cand.json()["tokens"]["access_token"]
    
    pub_res2 = requests.get(f"{BASE_URL}/jobs/public")
    assert pub_res2.status_code == 200
    public_jobs2 = pub_res2.json()
    target_job = next((j for j in public_jobs2 if j["id"] == pub_job_id), None)
    assert target_job is not None
    assert target_job["company_logo"] == logo_url
    print("✓ Published Job Requisition dynamically visible on Candidate Dashboard")

    # 7. Candidate Bookmarks / Saves Job
    bm_res = requests.post(f"{BASE_URL}/jobs/{pub_job_id}/bookmark", headers={"Authorization": f"Bearer {cand_token}"})
    assert bm_res.status_code == 200
    assert bm_res.json()["bookmarked"] is True
    
    saved_res = requests.get(f"{BASE_URL}/jobs/bookmarks", headers={"Authorization": f"Bearer {cand_token}"})
    assert saved_res.status_code == 200
    assert any(b["id"] == pub_job_id for b in saved_res.json())
    print("✓ Candidate Job Bookmarking & Saved Jobs API Verified")

    # 8. Recruiter Edits Job Requisition
    edit_res = requests.put(f"{BASE_URL}/jobs/{pub_job_id}", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Principal Distributed Systems Architect",
        "salary_range": "$190,000 - $240,000"
    })
    assert edit_res.status_code == 200
    print("✓ Recruiter Edit Job Requisition Verified")

    # 9. Recruiter Closes Job Requisition
    close_res = requests.patch(f"{BASE_URL}/jobs/{pub_job_id}/close", headers={"Authorization": f"Bearer {rec_token}"})
    assert close_res.status_code == 200
    print("✓ Recruiter Close Job Requisition Verified")

    # 10. Recruiter Deletes Draft Job
    del_res = requests.delete(f"{BASE_URL}/jobs/{draft_job_id}", headers={"Authorization": f"Bearer {rec_token}"})
    assert del_res.status_code == 200
    print("✓ Recruiter Delete Job Requisition Verified")

    print("\n=== ALL PHASE 2 RECRUITER & CANDIDATE WORKFLOW TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase2_workflow_test()
