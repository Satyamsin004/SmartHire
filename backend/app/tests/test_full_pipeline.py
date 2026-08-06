import os
import sys
import json
import uuid
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import dispose_engine
import unittest

BASE_URL = "/api/v1"

class TestFullSmartHirePipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        global requests
        requests = cls.client
        # 1. Login Recruiter
        rec_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "abhay@gmail.com",
            "password": "Password123!",
            "role": "recruiter"
        })
        if rec_res.status_code != 200:
            rec_res = requests.post(f"{BASE_URL}/auth/register", json={
                "email": "abhay@gmail.com",
                "password": "Password123!",
                "full_name": "Abhay Raj Yadav",
                "role": "recruiter"
            })
            if rec_res.status_code == 409:
                rec_res = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": "abhay@gmail.com",
                    "password": "Password123!"
                })
        assert rec_res.status_code in [200, 201], f"Recruiter auth failed: {rec_res.text}"
        cls.rec_token = rec_res.json()["tokens"]["access_token"]
        cls.rec_headers = {"Authorization": f"Bearer {cls.rec_token}"}

        # 2. Login Candidate
        cand_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "satyamsin004@gmail.com",
            "password": "Password123!",
            "role": "candidate"
        })
        if cand_res.status_code != 200:
            cand_res = requests.post(f"{BASE_URL}/auth/register", json={
                "email": "satyamsin004@gmail.com",
                "password": "Password123!",
                "full_name": "Satyam Singh",
                "role": "candidate"
            })
            if cand_res.status_code == 409:
                cand_res = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": "satyamsin004@gmail.com",
                    "password": "Password123!"
                })
        assert cand_res.status_code in [200, 201], f"Candidate auth failed: {cand_res.text}"
        cls.cand_token = cand_res.json()["tokens"]["access_token"]
        cls.cand_headers = {"Authorization": f"Bearer {cls.cand_token}"}

        # 3. Upload Candidate Resume so job applications pass validation
        resume_pdf_bytes = b"%PDF-1.4 \n1 0 obj\n<< /Title (Satyam Singh Resume) >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 200 >>\nstream\nBT /F1 12 Tf 50 700 Td (Satyam Singh - Software Engineer. Experienced in Python, FastAPI, React, PostgreSQL, Docker, Redis.) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        requests.post(
            f"{BASE_URL}/uploads/resume",
            files={"file": ("satyam_resume.pdf", resume_pdf_bytes, "application/pdf")},
            headers=cls.cand_headers
        )

    @classmethod
    def tearDownClass(cls):
        asyncio.run(dispose_engine())
        cls.client.close()

    def test_01_health_and_gemini_diagnostics(self):
        """PHASE 1: Verify API health and Gemini live connection."""
        res = requests.get("/api/test/gemini")
        self.assertEqual(res.status_code, 200, f"Gemini API test endpoint failed: {res.text}")
        data = res.json()
        self.assertIn("status", data)
        print(f"✓ PHASE 1 PASS: API Health Verified (Gemini Status: {data.get('status')})")

    def test_02_job_creation_and_application(self):
        """PHASE 2 & 9: Recruiter creates job, Candidate applies, ATS calculated."""
        unique_title = f"Lead AI Engineer Test {uuid.uuid4().hex[:6]}"
        job_payload = {
            "title": unique_title,
            "company_name": "SmartHire Corporate",
            "department": "Engineering",
            "employment_type": "Full Time",
            "work_mode": "Remote",
            "experience_required": "3-5 Years",
            "salary_range": "$140,000 - $180,000",
            "location": "San Francisco, CA / Remote",
            "openings": 2,
            "education_required": "Bachelor's Degree in CS",
            "required_skills": ["Python", "FastAPI", "React", "PostgreSQL", "Docker"],
            "preferred_skills": ["Redis", "System Design"],
            "description": "Design and build AI-powered hiring platforms and microservices.",
            "responsibilities": "Develop scalable REST APIs and full-stack features.",
            "requirements": "Strong Python, FastAPI, and database background.",
            "benefits": "Competitive pay, health, 401(k).",
            "status": "Published"
        }
        res_job = requests.post(f"{BASE_URL}/jobs/create", json=job_payload, headers=self.rec_headers)
        self.assertEqual(res_job.status_code, 200, f"Job creation failed: {res_job.text}")
        TestFullSmartHirePipeline.job_id = res_job.json()["job"]["id"]

        app_payload = {
            "phone": "+1 (555) 019-2834",
            "expected_salary": "$150,000",
            "notice_period": "Immediate",
            "cover_letter": "Enthusiastic AI developer eager to build innovative hiring workflows."
        }
        res_app = requests.post(f"{BASE_URL}/jobs/{TestFullSmartHirePipeline.job_id}/apply", json=app_payload, headers=self.cand_headers)
        self.assertEqual(res_app.status_code, 200, f"Candidate application failed: {res_app.text}")
        app_data = res_app.json()
        self.assertIsNotNone(app_data.get("ats_score"))
        self.assertGreaterEqual(app_data.get("ats_score"), 0.0)
        TestFullSmartHirePipeline.application_id = app_data["application_id"]
        print(f"✓ PHASE 2 & 9 PASS: Job Created & Application Submitted (ATS Score: {app_data['ats_score']}%)")

    def test_03_recruiter_ats_segregation(self):
        """PHASE 7: Verify ATS Passed (>=80%) vs ATS Rejected (<80%) segregation."""
        res_evals = requests.get(f"{BASE_URL}/recruiter/evaluations", headers=self.rec_headers)
        self.assertEqual(res_evals.status_code, 200)
        evals = res_evals.json()
        for e in evals:
            self.assertGreaterEqual(e["ats_score"], 80.0)

        res_rej = requests.get(f"{BASE_URL}/recruiter/ats-rejected", headers=self.rec_headers)
        self.assertEqual(res_rej.status_code, 200)
        rejs = res_rej.json()
        for r in rejs:
            self.assertTrue(r["ats_score"] < 80.0 or r["status"] == "Rejected")

        print(f"✓ PHASE 7 PASS: ATS Threshold Segregation Verified (Evaluations: {len(evals)}, Rejected: {len(rejs)})")

    def test_04_interview_scheduling_and_direct_entry(self):
        """PHASE 3: Recruiter schedules interview, Candidate retrieves detail."""
        res_cand_prof = requests.get(f"{BASE_URL}/recruiter/registered-candidates", headers=self.rec_headers)
        self.assertEqual(res_cand_prof.status_code, 200)
        candidates = res_cand_prof.json()
        self.assertGreater(len(candidates), 0)
        candidate_id = candidates[0]["id"]

        sched_payload = {
            "candidate_ids": [candidate_id],
            "round_type": "Technical",
            "scheduled_date": "2026-08-01T15:00:00Z",
            "duration_minutes": 10,
            "difficulty": "Medium",
            "instructions": "Be prepared to discuss Python architecture and system design."
        }
        res_sched = requests.post(f"{BASE_URL}/scheduling/create", json=sched_payload, headers=self.rec_headers)
        self.assertEqual(res_sched.status_code, 200, f"Interview schedule failed: {res_sched.text}")
        schedules = res_sched.json()["schedules"]
        self.assertGreater(len(schedules), 0)
        schedule_id = schedules[0]["id"]

        res_det = requests.get(f"{BASE_URL}/scheduling/detail/{schedule_id}", headers=self.cand_headers)
        self.assertEqual(res_det.status_code, 200)
        det = res_det.json()
        self.assertEqual(det["difficulty"], "Medium")
        TestFullSmartHirePipeline.schedule_id = schedule_id
        print(f"✓ PHASE 3 PASS: Interview Scheduled (Schedule ID: {schedule_id}) & Direct Entry Parameters Verified")

    def test_05_interview_engine_execution_and_auto_completion(self):
        """PHASE 3, 4, 5, 10: Conduct full live interview session with transcripts."""
        start_payload = {
            "role_target": "Software Engineer",
            "round_type": "Technical",
            "difficulty": "Medium",
            "duration_minutes": 10,
            "schedule_id": getattr(TestFullSmartHirePipeline, "schedule_id", None)
        }
        res_start = requests.post(f"{BASE_URL}/interview/start", json=start_payload, headers=self.cand_headers)
        self.assertEqual(res_start.status_code, 200, f"Interview start failed: {res_start.text}")
        start_data = res_start.json()
        session_id = start_data["session_id"]
        q1 = start_data["first_question"]
        self.assertIsNotNone(q1)

        questions_asked = [q1["question_text"]]
        curr_q = q1

        for i in range(4):
            ans_payload = {
                "session_id": session_id,
                "question_id": curr_q["question_id"],
                "transcript_text": f"For {curr_q.get('category', 'Technical')}, I implemented clean microservices architecture using Python FastAPI, PostgreSQL databases with indexed queries, and Redis caching to ensure high throughput and minimal latency.",
                "duration_seconds": 25,
                "eye_contact_percentage": 92.5,
                "confidence_percentage": 89.0
            }
            res_ans = requests.post(f"{BASE_URL}/interview/submit-answer", json=ans_payload, headers=self.cand_headers)
            self.assertEqual(res_ans.status_code, 200, f"Submit answer failed: {res_ans.text}")
            ans_data = res_ans.json()

            if ans_data.get("is_completed"):
                break
            
            next_q = ans_data.get("next_question")
            if not next_q:
                break
            
            self.assertNotIn(next_q["question_text"], questions_asked, "Duplicate question generated!")
            questions_asked.append(next_q["question_text"])
            curr_q = next_q

        res_rep = requests.get(f"{BASE_URL}/interview/report/{session_id}", headers=self.cand_headers)
        self.assertEqual(res_rep.status_code, 200, f"Fetch report failed: {res_rep.text}")
        report = res_rep.json()

        self.assertGreater(report["overall_score"], 0.0)
        self.assertGreater(report["technical_score"], 0.0)
        self.assertGreater(report["communication_score"], 0.0)

        res_scheds = requests.get(f"{BASE_URL}/scheduling/candidate", headers=self.cand_headers)
        self.assertEqual(res_scheds.status_code, 200)
        active_scheds = res_scheds.json()
        sched_ids = [s["id"] for s in active_scheds]
        if getattr(TestFullSmartHirePipeline, "schedule_id", None):
            self.assertNotIn(TestFullSmartHirePipeline.schedule_id, sched_ids, "Completed scheduled interview banner was NOT auto-cleared!")

        print(f"✓ PHASE 3, 4, 5, 10 PASS: Interview Session Completed (Session ID: {session_id}), Report Generated (Overall: {report['overall_score']}%), Schedule Banner Cleared")

    def test_06_recruiter_offer_workflow(self):
        """PHASE 12: Recruiter sends offer, Candidate accepts, Status becomes Hired."""
        app_id = getattr(TestFullSmartHirePipeline, "application_id", None)
        self.assertIsNotNone(app_id)

        offer_payload = {
            "application_id": app_id,
            "job_title": "Lead AI Engineer",
            "salary_offered": "$160,000 USD / Year",
            "start_date": "2026-08-15",
            "offer_letter_text": "We are thrilled to offer you the position of Lead AI Engineer at SmartHire Corporate."
        }
        res_offer = requests.post(f"{BASE_URL}/recruiter/offer/send", json=offer_payload, headers=self.rec_headers)
        self.assertEqual(res_offer.status_code, 200, f"Send offer failed: {res_offer.text}")
        offer_id = res_offer.json()["offer_id"]

        res_resp = requests.post(f"{BASE_URL}/offers/{offer_id}/respond", json={"action": "accept"}, headers=self.cand_headers)
        self.assertEqual(res_resp.status_code, 200, f"Accept offer failed: {res_resp.text}")
        self.assertEqual(res_resp.json()["new_status"], "Accepted")

        res_my_apps = requests.get(f"{BASE_URL}/jobs/my-applications", headers=self.cand_headers)
        self.assertEqual(res_my_apps.status_code, 200)
        apps = res_my_apps.json()
        matching_app = next((a for a in apps if a["id"] == app_id), None)
        self.assertIsNotNone(matching_app)
        self.assertEqual(matching_app["status"], "Hired")

        print(f"✓ PHASE 12 PASS: Offer Issued (ID: {offer_id}), Accepted by Candidate, Application Status advanced to 'Hired'")

if __name__ == "__main__":
    unittest.main()
