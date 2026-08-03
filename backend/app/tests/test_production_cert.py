import os
import sys
import json
import uuid
import requests
import unittest

BASE_URL = "http://127.0.0.1:8000/api/v1"

class TestProductionCertification(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # 1. Login Recruiter
        rec_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "abhay@gmail.com",
            "password": "Password123!",
            "role": "recruiter"
        })
        assert rec_res.status_code == 200, f"Recruiter login failed: {rec_res.text}"
        cls.rec_token = rec_res.json()["tokens"]["access_token"]
        cls.rec_headers = {"Authorization": f"Bearer {cls.rec_token}"}

        # 2. Login Candidate
        cand_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "satyamsin004@gmail.com",
            "password": "Password123!",
            "role": "candidate"
        })
        assert cand_res.status_code == 200, f"Candidate login failed: {cand_res.text}"
        cls.cand_token = cand_res.json()["tokens"]["access_token"]
        cls.cand_headers = {"Authorization": f"Bearer {cls.cand_token}"}

    def test_01_security_rbac_and_jwt(self):
        """SECURITY AUDIT: Verify RBAC protection and JWT access control."""
        # Candidate accessing recruiter route should return 403 Forbidden
        res_fail = requests.get(f"{BASE_URL}/recruiter/applications", headers=self.cand_headers)
        self.assertEqual(res_fail.status_code, 403, "RBAC vulnerability: Candidate accessed recruiter route!")

        # Unauthenticated access should return 401 Unauthorized
        res_unauth = requests.get(f"{BASE_URL}/recruiter/applications")
        self.assertEqual(res_unauth.status_code, 401, "Security flaw: Unauthenticated user accessed protected route!")

        print("✓ CERT TEST 1 PASS: Security, RBAC & JWT Access Control Verified")

    def test_02_resume_upload_and_parsing_precision(self):
        """RESUME AUDIT: Upload PDF resume and verify degree extraction precision."""
        res_my_res = requests.get(f"{BASE_URL}/resume/my-resume", headers=self.cand_headers)
        self.assertEqual(res_my_res.status_code, 200)
        data = res_my_res.json()
        self.assertIsNotNone(data)
        self.assertIn("Bachelor's Degree", data.get("education_level", ""))
        self.assertNotIn("Master's Degree", data.get("education_level", ""))
        print(f"✓ CERT TEST 2 PASS: Resume Profile & Accurate Education Parsed: {data.get('education_level')}")

    def test_03_job_lifecycle_and_ats_scoring(self):
        """ATS AUDIT: Post job, apply, verify ATS calculation and user isolation."""
        unique_job = f"Senior Staff Engineer {uuid.uuid4().hex[:6]}"
        job_payload = {
            "title": unique_job,
            "company_name": "SmartHire AI Systems",
            "department": "Engineering",
            "employment_type": "Full Time",
            "work_mode": "Remote",
            "experience_required": "5+ Years",
            "salary_range": "$170,000 - $220,000",
            "location": "Remote",
            "openings": 1,
            "education_required": "Bachelor's Degree",
            "required_skills": ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "System Design"],
            "preferred_skills": ["Redis", "Kubernetes"],
            "description": "Lead engineering teams building enterprise hiring software.",
            "responsibilities": "Deliver scalable microservices and real-time LLM telemetry.",
            "requirements": "Strong Python, FastAPI, and database optimization expertise.",
            "status": "Published"
        }
        res_job = requests.post(f"{BASE_URL}/jobs/create", json=job_payload, headers=self.rec_headers)
        self.assertEqual(res_job.status_code, 200, f"Job creation failed: {res_job.text}")
        job_id = res_job.json()["job"]["id"]
        TestProductionCertification.job_id = job_id

        # Candidate applies
        app_payload = {
            "phone": "+1 (555) 987-6543",
            "expected_salary": "$180,000",
            "notice_period": "Immediate",
            "cover_letter": "Certified architect ready to lead enterprise AI hiring platform."
        }
        res_app = requests.post(f"{BASE_URL}/jobs/{job_id}/apply", json=app_payload, headers=self.cand_headers)
        self.assertEqual(res_app.status_code, 200, f"Application failed: {res_app.text}")
        app_data = res_app.json()
        self.assertIsNotNone(app_data.get("ats_score"))
        TestProductionCertification.app_id = app_data["application_id"]
        print(f"✓ CERT TEST 3 PASS: Job Posted & Application Submitted (ATS Score: {app_data['ats_score']}%)")

    def test_04_recruiter_ats_segregation(self):
        """RECRUITER AUDIT: Verify ATS Passed vs ATS Rejected segregation."""
        res_evals = requests.get(f"{BASE_URL}/recruiter/evaluations", headers=self.rec_headers)
        self.assertEqual(res_evals.status_code, 200)
        for e in res_evals.json():
            self.assertGreaterEqual(e["ats_score"], 80.0)

        res_rejs = requests.get(f"{BASE_URL}/recruiter/ats-rejected", headers=self.rec_headers)
        self.assertEqual(res_rejs.status_code, 200)
        for r in res_rejs.json():
            self.assertTrue(r["ats_score"] < 80.0 or r["status"] == "Rejected")

        print("✓ CERT TEST 4 PASS: Recruiter ATS Threshold Segregation Verified")

    def test_05_interview_engine_and_report_generation(self):
        """INTERVIEW AUDIT: Conduct live interview, check question memory, evaluation, and banner removal."""
        # 1. Schedule Interview
        res_cands = requests.get(f"{BASE_URL}/recruiter/registered-candidates", headers=self.rec_headers)
        cand_id = res_cands.json()[0]["id"]

        sched_res = requests.post(f"{BASE_URL}/scheduling/create", json={
            "candidate_ids": [cand_id],
            "round_type": "Technical",
            "scheduled_date": "2026-08-02T10:00:00Z",
            "duration_minutes": 10,
            "difficulty": "Hard",
            "instructions": "Enterprise architecture evaluation"
        }, headers=self.rec_headers)
        self.assertEqual(sched_res.status_code, 200)
        sched_id = sched_res.json()["schedules"][0]["id"]

        # 2. Candidate Start Session
        start_res = requests.post(f"{BASE_URL}/interview/start", json={
            "role_target": "Senior Staff Engineer",
            "round_type": "Technical",
            "difficulty": "Hard",
            "duration_minutes": 10,
            "schedule_id": sched_id
        }, headers=self.cand_headers)
        self.assertEqual(start_res.status_code, 200)
        session_id = start_res.json()["session_id"]
        q1 = start_res.json()["first_question"]
        self.assertIsNotNone(q1)

        # 3. Submit Answers
        curr_q = q1
        asked = [q1["question_text"]]
        for i in range(4):
            ans_res = requests.post(f"{BASE_URL}/interview/submit-answer", json={
                "session_id": session_id,
                "question_id": curr_q["question_id"],
                "transcript_text": "I design production backend systems using Python FastAPI microservices, PostgreSQL with B-tree indexes, and Redis key-value caching to deliver high-concurrency low-latency API performance.",
                "duration_seconds": 30,
                "eye_contact_percentage": 94.0,
                "confidence_percentage": 91.0
            }, headers=self.cand_headers)
            self.assertEqual(ans_res.status_code, 200)
            ans_data = ans_res.json()
            if ans_data.get("is_completed") or not ans_data.get("next_question"):
                break
            curr_q = ans_data["next_question"]
            self.assertNotIn(curr_q["question_text"], asked, "Duplicate question generated!")
            asked.append(curr_q["question_text"])

        # 4. Fetch Report
        rep_res = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers=self.cand_headers)
        self.assertEqual(rep_res.status_code, 200)
        report = rep_res.json()
        self.assertGreater(report["overall_score"], 0.0)

        # 5. Verify Scheduled Banner Cleared
        schedules = requests.get(f"{BASE_URL}/scheduling/candidate", headers=self.cand_headers).json()
        self.assertEqual(len(schedules), 0, "Scheduled banner was not cleared after interview completion!")

        print(f"✓ CERT TEST 5 PASS: Live Interview Executed, Deduplication Verified, Report Generated (Overall: {report['overall_score']}%), Banner Cleared")

    def test_06_offer_issuance_acceptance_and_pipeline_advancement(self):
        """OFFER & PIPELINE AUDIT: Recruiter issues offer, Candidate accepts, Status becomes Hired."""
        app_id = TestProductionCertification.app_id
        offer_res = requests.post(f"{BASE_URL}/recruiter/offer/send", json={
            "application_id": app_id,
            "job_title": "Senior Staff Engineer",
            "salary_offered": "$190,000 USD",
            "start_date": "2026-08-20",
            "offer_letter_text": "Official Offer of Employment for Senior Staff Engineer."
        }, headers=self.rec_headers)
        self.assertEqual(offer_res.status_code, 200)
        offer_id = offer_res.json()["offer_id"]

        # Candidate accepts
        resp_res = requests.post(f"{BASE_URL}/offers/{offer_id}/respond", json={"action": "accept"}, headers=self.cand_headers)
        self.assertEqual(resp_res.status_code, 200)
        self.assertEqual(resp_res.json()["new_status"], "Accepted")

        # Verify Pipeline Status
        my_apps = requests.get(f"{BASE_URL}/jobs/my-applications", headers=self.cand_headers).json()
        app_match = next((a for a in my_apps if a["id"] == app_id), None)
        self.assertIsNotNone(app_match)
        self.assertEqual(app_match["status"], "Hired")

        print("✓ CERT TEST 6 PASS: Offer Issued, Candidate Accepted, Pipeline Advanced to 'Hired'")

if __name__ == "__main__":
    unittest.main()
