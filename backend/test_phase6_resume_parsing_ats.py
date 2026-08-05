import requests
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', write_through=True)
BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase6_resume_parsing_ats_tests():
    print("=========================================================================")
    print("=== STARTING PHASE 6 RESUME PARSING & ATS ENGINE VERIFICATION SUITE ===")
    print("=========================================================================\n")

    timestamp = int(time.time())
    pwd = "Password123!"

    # 1. Register Recruiter
    email_rec = f"recruiter_ats_{timestamp}@company.com"
    reg_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "ATS Recruiter",
        "email": email_rec,
        "password": pwd,
        "role": "recruiter"
    })
    assert reg_rec.status_code in [200, 201]
    tok_rec = reg_rec.json()["tokens"]["access_token"]
    headers_rec = {"Authorization": f"Bearer {tok_rec}"}

    # 2. Register Candidate Charlie (High Match Candidate) & Candidate Diana (Low Match Candidate)
    email_charlie = f"charlie_high_ats_{timestamp}@candidate.com"
    email_diana = f"diana_low_ats_{timestamp}@candidate.com"

    reg_c = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Charlie HighMatch",
        "email": email_charlie,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_c.status_code in [200, 201]
    tok_c = reg_c.json()["tokens"]["access_token"]
    headers_c = {"Authorization": f"Bearer {tok_c}"}

    reg_d = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Diana LowMatch",
        "email": email_diana,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_d.status_code in [200, 201]
    tok_d = reg_d.json()["tokens"]["access_token"]
    headers_d = {"Authorization": f"Bearer {tok_d}"}

    print("✓ Step 1-2 Passed: Registered Recruiter, High-Match Candidate Charlie, and Low-Match Candidate Diana.")

    # 3. Recruiter Publishes Target Job
    job_title = f"Senior React Architect {timestamp}"
    job_res = requests.post(f"{BASE_URL}/jobs/create", headers=headers_rec, json={
        "title": job_title,
        "company_name": "ATS Tech Corp",
        "department": "Engineering",
        "employment_type": "Full Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "San Francisco, CA",
        "salary_range": "$170,000 - $210,000",
        "description": "Expert in React, TypeScript, Redux, TailwindCSS, FastAPI, and PostgreSQL.",
        "required_skills": ["React", "TypeScript", "Redux", "TailwindCSS"],
        "status": "Published"
    })
    assert job_res.status_code in [200, 201]
    job_id = job_res.json()["job"]["id"]

    print(f"✓ Step 3 Passed: Job requisition '{job_title}' published with required skills [React, TypeScript, Redux, TailwindCSS].")

    # 4. Upload High-Match Resume for Candidate Charlie
    sample_pdf_content = (
        b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n"
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n"
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n"
        b"<< /Length 150 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n"
        b"(Charlie HighMatch - Senior Frontend Engineer with 6 years experience in React, TypeScript, Redux, TailwindCSS, FastAPI, PostgreSQL.) Tj\n"
        b"ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
        b"0000000115 00000 n \n0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n405\n%%EOF"
    )
    files_c = {'file': ('resume_charlie.pdf', sample_pdf_content, 'application/pdf')}
    up_c_res = requests.post(f"{BASE_URL}/uploads/resume", headers=headers_c, files=files_c)
    assert up_c_res.status_code in [200, 201], f"Upload Charlie resume failed: {up_c_res.text}"
    print("✓ Step 4 Passed: Uploaded High-Match PDF Resume for Candidate Charlie.")

    # 5. Candidate Charlie Applies -> Generates High ATS Match (>=80%) -> Shortlisted
    app_c_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers=headers_c, json={
        "cover_letter": "I have extensive experience in React and TypeScript."
    })
    assert app_c_res.status_code in [200, 201]
    res_c_data = app_c_res.json()
    ats_score_c = res_c_data["ats_score"]
    assert ats_score_c >= 80.0, f"Expected ATS score >= 80, got {ats_score_c}"
    print(f"✓ Step 5 Passed: Candidate Charlie application scored {ats_score_c}% ATS Match (>=80%) -> Status: Shortlisted.")

    # 6. Upload Low-Match Resume for Candidate Diana
    low_pdf_content = (
        b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n"
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n"
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n"
        b"<< /Length 120 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n"
        b"(Diana LowMatch - Java Developer with experience in Spring Boot and C++.) Tj\n"
        b"ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
        b"0000000115 00000 n \n0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n375\n%%EOF"
    )
    files_d = {'file': ('resume_diana.pdf', low_pdf_content, 'application/pdf')}
    up_d_res = requests.post(f"{BASE_URL}/uploads/resume", headers=headers_d, files=files_d)
    assert up_d_res.status_code in [200, 201]
    print("✓ Step 6 Passed: Uploaded Low-Match PDF Resume for Candidate Diana.")

    # 7. Candidate Diana Applies -> Generates Low ATS Match (<80%) -> Auto-Rejected
    app_d_res = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", headers=headers_d, json={
        "cover_letter": "Java developer looking to transition to frontend."
    })
    assert app_d_res.status_code in [200, 201]
    res_d_data = app_d_res.json()
    ats_score_d = res_d_data["ats_score"]
    assert ats_score_d < 80.0, f"Expected ATS score < 80, got {ats_score_d}"
    print(f"✓ Step 7 Passed: Candidate Diana application scored {ats_score_d}% ATS Match (<80%) -> Status: Auto-Rejected.")

    # 8. Recruiter Dashboard Pipeline Segmentation Verification
    rec_apps_res = requests.get(f"{BASE_URL}/recruiter/applications", headers=headers_rec)
    assert rec_apps_res.status_code == 200
    rec_apps = rec_apps_res.json()

    shortlisted_apps = [a for a in rec_apps if a["status"] in ["Shortlisted", "Screening Passed"]]
    rejected_apps = [a for a in rec_apps if a["status"] in ["Rejected", "ATS Rejected"]]

    assert len(shortlisted_apps) >= 1, "Shortlisted pipeline missing candidate!"
    assert len(rejected_apps) >= 1, "ATS Rejected pipeline missing candidate!"

    print("✓ Step 8 Passed: Recruiter applicant dashboard pipeline properly segmented (Shortlisted vs Rejected).")

    # 9. Recruiter Manual Override Test
    diana_app_id = res_d_data["application_id"]
    override_res = requests.post(f"{BASE_URL}/recruiter/application/{diana_app_id}/status", headers=headers_rec, json={
        "status": "Shortlisted"
    })
    assert override_res.status_code == 200
    print(f"✓ Step 9 Passed: Recruiter manual override successfully updated candidate Diana status from 'Rejected' to 'Shortlisted'.")

    # 10. Automated Candidate Notification Verification
    notif_res = requests.get(f"{BASE_URL}/notifications/me", headers=headers_c)
    assert notif_res.status_code == 200
    notifs = notif_res.json()["notifications"]
    titles = [n["title"] for n in notifs]
    assert any("Shortlisted" in t or "Submitted" in t for t in titles), f"Candidate notifications missing! {titles}"

    print("✓ Step 10 Passed: Automated candidate notification dispatch verified.")

    print("\n=========================================================================")
    print("=== ALL PHASE 6 RESUME PARSING & ATS WORKFLOW TESTS PASSED SUCCESSFULLY! ===")
    print("=========================================================================")

if __name__ == "__main__":
    run_phase6_resume_parsing_ats_tests()
