import requests
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase5_candidate_application_workflow_tests():
    print("=========================================================================")
    print("=== STARTING PHASE 5 CANDIDATE APPLICATION WORKFLOW VERIFICATION SUITE ===")
    print("=========================================================================\n")

    timestamp = int(time.time())
    pwd = "Password123!"

    # 1. Register Recruiter Alice
    email_rec_a = f"alice_rec_{timestamp}@company.com"
    reg_rec_a = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Alice Manager",
        "email": email_rec_a,
        "password": pwd,
        "role": "recruiter"
    })
    assert reg_rec_a.status_code in [200, 201]
    tok_rec_a = reg_rec_a.json()["tokens"]["access_token"]
    headers_rec_a = {"Authorization": f"Bearer {tok_rec_a}"}

    # 2. Register Recruiter Bob
    email_rec_b = f"bob_rec_{timestamp}@company.com"
    reg_rec_b = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Bob Lead",
        "email": email_rec_b,
        "password": pwd,
        "role": "recruiter"
    })
    assert reg_rec_b.status_code in [200, 201]
    tok_rec_b = reg_rec_b.json()["tokens"]["access_token"]
    headers_rec_b = {"Authorization": f"Bearer {tok_rec_b}"}

    # 3. Register Candidate Charlie & Candidate Diana
    email_cand_c = f"charlie_cand_{timestamp}@candidate.com"
    email_cand_d = f"diana_cand_{timestamp}@candidate.com"

    reg_cand_c = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Charlie Candidate",
        "email": email_cand_c,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_cand_c.status_code in [200, 201]
    tok_cand_c = reg_cand_c.json()["tokens"]["access_token"]
    headers_cand_c = {"Authorization": f"Bearer {tok_cand_c}"}

    reg_cand_d = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Diana Candidate",
        "email": email_cand_d,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_cand_d.status_code in [200, 201]
    tok_cand_d = reg_cand_d.json()["tokens"]["access_token"]
    headers_cand_d = {"Authorization": f"Bearer {tok_cand_d}"}

    print("✓ Step 1-3 Passed: Created Recruiter Alice, Recruiter Bob, Candidate Charlie, Candidate Diana.")

    # 4. Recruiter Alice publishes Job A
    job_a_title = f"Lead Python Architect {timestamp}"
    job_a_res = requests.post(f"{BASE_URL}/jobs/create", headers=headers_rec_a, json={
        "title": job_a_title,
        "company_name": "Alice Systems",
        "department": "Engineering",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "6+ Years",
        "location": "Boston, MA",
        "salary_range": "$170,000 - $210,000",
        "description": "Lead Python & FastAPI microservices architecture.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL"],
        "status": "Published"
    })
    assert job_a_res.status_code in [200, 201]
    job_a_id = job_a_res.json()["job"]["id"]

    # 5. Recruiter Bob publishes Job B
    job_b_title = f"Lead DevOps Engineer {timestamp}"
    job_b_res = requests.post(f"{BASE_URL}/jobs/create", headers=headers_rec_b, json={
        "title": job_b_title,
        "company_name": "Bob Cloud Labs",
        "department": "DevOps",
        "employment_type": "Full Time",
        "work_mode": "Hybrid",
        "experience_required": "5+ Years",
        "location": "Austin, TX",
        "salary_range": "$150,000 - $190,000",
        "description": "Manage Kubernetes & CI/CD release pipelines.",
        "required_skills": ["Docker", "Kubernetes", "AWS"],
        "status": "Published"
    })
    assert job_b_res.status_code in [200, 201]
    job_b_id = job_b_res.json()["job"]["id"]

    print("✓ Step 4-5 Passed: Requisitions Job A and Job B published successfully.")

    # 6. Candidate Charlie applies for Job A (Alice's job)
    app_c_res = requests.post(f"{BASE_URL}/jobs/{job_a_id}/apply", headers=headers_cand_c, json={
        "cover_letter": "I am an expert Python architect excited about Alice Systems.",
        "phone": "+1-555-0199",
        "current_ctc": "$150,000",
        "expected_ctc": "$180,000",
        "notice_period": "30 Days"
    })
    assert app_c_res.status_code in [200, 201], f"Candidate C apply failed: {app_c_res.text}"
    app_c_id = app_c_res.json()["application_id"]

    # 7. Candidate Diana applies for Job B (Bob's job)
    app_d_res = requests.post(f"{BASE_URL}/jobs/{job_b_id}/apply", headers=headers_cand_d, json={
        "cover_letter": "I have 6 years experience running production Kubernetes clusters.",
        "phone": "+1-555-0288",
        "current_ctc": "$140,000",
        "expected_ctc": "$165,000",
        "notice_period": "15 Days"
    })
    assert app_d_res.status_code in [200, 201], f"Candidate D apply failed: {app_d_res.text}"
    app_d_id = app_d_res.json()["application_id"]

    print("✓ Step 6-7 Passed: Candidate Charlie applied to Job A; Candidate Diana applied to Job B.")

    # 8. Candidate Application Isolation Verification
    my_apps_c = requests.get(f"{BASE_URL}/jobs/my-applications", headers=headers_cand_c).json()
    ids_c = [a["id"] for a in my_apps_c]
    assert app_c_id in ids_c, "Charlie missing own application!"
    assert app_d_id not in ids_c, "DATA LEAK: Charlie can see Diana's application!"

    my_apps_d = requests.get(f"{BASE_URL}/jobs/my-applications", headers=headers_cand_d).json()
    ids_d = [a["id"] for a in my_apps_d]
    assert app_d_id in ids_d, "Diana missing own application!"
    assert app_c_id not in ids_d, "DATA LEAK: Diana can see Charlie's application!"

    print("✓ Step 8 Passed: Candidate application history isolation verified (Zero Data Leakage).")

    # 9. Recruiter Application Inbox Isolation Verification
    rec_apps_a = requests.get(f"{BASE_URL}/recruiter/applications", headers=headers_rec_a).json()
    ids_rec_a = [a["id"] for a in rec_apps_a]
    assert app_c_id in ids_rec_a, "Alice missing Charlie's application to Job A!"
    assert app_d_id not in ids_rec_a, "DATA LEAK: Alice can see application to Bob's Job B!"

    rec_apps_b = requests.get(f"{BASE_URL}/recruiter/applications", headers=headers_rec_b).json()
    ids_rec_b = [a["id"] for a in rec_apps_b]
    assert app_d_id in ids_rec_b, "Bob missing Diana's application to Job B!"
    assert app_c_id not in ids_rec_b, "DATA LEAK: Bob can see application to Alice's Job A!"

    print("✓ Step 9 Passed: Recruiter application inbox isolation verified (Zero Data Leakage).")

    # 10. Notification Verification
    notifs_cand = requests.get(f"{BASE_URL}/notifications", headers=headers_cand_c).json()
    titles_cand = [n["title"] for n in notifs_cand]
    assert any("Application Submitted" in t for t in titles_cand), f"Candidate submission notification missing! {titles_cand}"

    notifs_rec = requests.get(f"{BASE_URL}/notifications", headers=headers_rec_a).json()
    titles_rec = [n["title"] for n in notifs_rec]
    assert any("New Application Received" in t for t in titles_rec), f"Recruiter application notification missing! {titles_rec}"

    print("✓ Step 10 Passed: Automated candidate submission & recruiter inbox notifications verified.")

    print("\n=========================================================================")
    print("=== ALL PHASE 5 CANDIDATE APPLICATION WORKFLOW TESTS PASSED SUCCESSFULLY! ===")
    print("=========================================================================")

if __name__ == "__main__":
    run_phase5_candidate_application_workflow_tests()
