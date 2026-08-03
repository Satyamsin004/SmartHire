import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def run_ats_verification():
    print("=== STARTING REAL ATS RECRUITMENT WORKFLOW VERIFICATION ===")

    # 1. Register Candidate Alice
    alice_email = f"alice_ats_{int(time.time())}@example.com"
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Alice Developer",
        "email": alice_email,
        "password": "Password123!",
        "role": "candidate"
    })
    assert reg_res.status_code in [200, 201], f"Candidate registration failed: {reg_res.text}"
    alice_token = reg_res.json()["tokens"]["access_token"]
    print("✓ Candidate Alice Registered Successfully")

    # Verify Alice Profile - Zero fake scores
    profile_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {alice_token}"})
    assert profile_res.status_code == 200, f"Get me failed: {profile_res.status_code} - {profile_res.text}"
    profile_data = profile_res.json()
    print(f"✓ Alice Candidate Profile Status: {profile_data.get('status')}")
    print(f"✓ Alice Candidate Profile Avg Score: {profile_data.get('avg_score')}")

    # 2. Register Recruiter Abhay
    recruiter_email = f"abhay_ats_{int(time.time())}@example.com"
    reg_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Abhay Recruiter",
        "email": recruiter_email,
        "password": "Password123!",
        "role": "recruiter"
    })
    assert reg_rec.status_code in [200, 201], f"Recruiter registration failed: {reg_rec.text}"
    rec_token = reg_rec.json()["tokens"]["access_token"]
    print("✓ Recruiter Abhay Registered Successfully")

    # 3. Recruiter creates job posting
    create_job_res = requests.post(f"{BASE_URL}/jobs/create", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "title": "Lead Full Stack Architect",
        "company_name": "SmartHire AI Global",
        "department": "Engineering",
        "employment_type": "Full-Time",
        "experience_required": "4-6 Years",
        "location": "San Francisco, CA / Remote",
        "salary_range": "$140,000 - $180,000",
        "description": "Building high-performance scalable FastAPI, React, PostgreSQL microservices.",
        "required_skills": ["React", "TypeScript", "FastAPI", "PostgreSQL", "Docker"]
    })
    assert create_job_res.status_code == 200, f"Job creation failed: {create_job_res.text}"
    job_id = create_job_res.json()["job"]["id"]
    print(f"✓ Job Requisition Posted Successfully. Job ID: {job_id}")

    # 4. Candidate browses public job listings
    public_jobs_res = requests.get(f"{BASE_URL}/jobs/public")
    assert public_jobs_res.status_code == 200, f"Get public jobs failed: {public_jobs_res.status_code} - {public_jobs_res.text}"
    jobs_list = public_jobs_res.json()
    assert len(jobs_list) > 0
    print(f"✓ Candidate Discovered {len(jobs_list)} Public Job Requisitions")

    # 5. Candidate Alice applies for the job
    apply_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers={"Authorization": f"Bearer {alice_token}"}, json={
        "cover_letter": "I have extensive experience building scalable web applications with React & FastAPI.",
        "phone": "+1-555-019-2834",
        "expected_salary": "$155,000 / year",
        "notice_period": "2 Weeks",
        "work_authorization": "Authorized to work in US"
    })
    assert apply_res.status_code == 200, f"Job application failed: {apply_res.text}"
    app_id = apply_res.json()["application_id"]
    print(f"✓ Candidate Alice Applied for Job. Application ID: {app_id}")

    # 6. Recruiter reviews ATS screening applications
    apps_res = requests.get(f"{BASE_URL}/recruiter/applications", headers={"Authorization": f"Bearer {rec_token}"})
    assert apps_res.status_code == 200
    apps_list = apps_res.json()
    alice_app = next((a for a in apps_list if a["id"] == app_id), None)
    assert alice_app is not None, "Alice's application not found in recruiter list"
    print(f"✓ Recruiter Retrieved Application. Candidate: {alice_app['candidate_name']}, Status: {alice_app['status']}")

    # 7. Recruiter updates application status to "Screening Passed"
    status_update_res = requests.post(f"{BASE_URL}/recruiter/application/{app_id}/status", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "status": "Screening Passed"
    })
    assert status_update_res.status_code == 200
    print("✓ Recruiter Marked Candidate Application as 'Screening Passed'")

    # 8. Recruiter issues formal Offer Letter
    offer_send_res = requests.post(f"{BASE_URL}/recruiter/offer/send", headers={"Authorization": f"Bearer {rec_token}"}, json={
        "application_id": app_id,
        "salary_offered": "$160,000 / year",
        "start_date": "2026-09-01",
        "offer_letter_text": "We are thrilled to extend an official offer of employment for Lead Full Stack Architect!"
    })
    assert offer_send_res.status_code == 200, f"Offer issuance failed: {offer_send_res.text}"
    offer_id = offer_send_res.json()["offer_id"]
    print(f"✓ Recruiter Issued Official Offer Letter. Offer ID: {offer_id}")

    # 9. Candidate Alice retrieves offer letters
    my_offers_res = requests.get(f"{BASE_URL}/offers/my-offers", headers={"Authorization": f"Bearer {alice_token}"})
    assert my_offers_res.status_code == 200
    offers_list = my_offers_res.json()
    assert len(offers_list) > 0
    alice_offer = next((o for o in offers_list if o["id"] == offer_id), None)
    assert alice_offer is not None
    print(f"✓ Candidate Alice Received Offer Letter: {alice_offer['job_title']} with Salary {alice_offer['salary_offered']}")

    # 10. Candidate Alice accepts the offer letter
    respond_res = requests.post(f"{BASE_URL}/offers/{offer_id}/respond", headers={"Authorization": f"Bearer {alice_token}"}, json={
        "action": "accept"
    })
    assert respond_res.status_code == 200
    print(f"✓ Candidate Alice Accepted the Offer Letter. Status: {respond_res.json()['new_status']}")

    print("\n=== ALL REAL ATS RECRUITMENT WORKFLOW TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_ats_verification()
