import asyncio
import io
import os
import uuid
import docx
from datetime import datetime
from sqlalchemy.future import select

from app.core.db import AsyncSessionLocal, engine, Base
from app.models.domain import (
    User, Candidate, Resume, ResumeSkill, ResumeEducation,
    ResumeExperience, ResumeInternship, ResumeProject, ResumeCertification,
    ResumeAchievement, ResumeLanguage, ResumeATS
)
from app.services.resume_service import resume_service
from app.api.v1.resume import (
    get_recruiter_candidate_view, get_interview_resume_context, get_resume_versions
)

# Helper function to generate dummy PDF bytes using reportlab
def generate_sample_pdf(lines: list) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    y = 750
    for line in lines:
        if y < 50:
            c.showPage()
            y = 750
        c.drawString(50, y, line)
        y -= 15
    c.save()
    return buf.getvalue()

# Helper function to generate dummy DOCX bytes
def generate_sample_docx(text_blocks: list) -> bytes:
    doc = docx.Document()
    for block in text_blocks:
        doc.add_paragraph(block)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

async def run_resume_parsing_pipeline_verification():
    # 1. Ensure DB schema exists & columns migrated
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS objective TEXT;"))
        except Exception:
            pass

    async with AsyncSessionLocal() as db:
        print("\n================================================================================")
        print("SMARTHIRE AI — PRODUCTION RESUME PARSING PIPELINE VERIFICATION SUITE")
        print("================================================================================\n")

        # -------------------------------------------------------------------------
        # TEST 1: EXPERIENCED RESUME PARSING & POSTGRESQL NORMALIZATION (PDF / TEXT)
        # -------------------------------------------------------------------------
        print("--------------------------------------------------------------------------------")
        print("[TEST 1/4] EXPERIENCED RESUME PARSING & POSTGRESQL NORMALIZATION")
        print("--------------------------------------------------------------------------------")

        exp_user_id = f"test-usr-exp-{uuid.uuid4().hex[:8]}"
        exp_user = User(
            id=exp_user_id,
            email=f"alex_exp_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="secret_pass_123",
            full_name="Alexander Wright",
            role="candidate"
        )
        db.add(exp_user)
        await db.flush()

        exp_cand = Candidate(id=f"cand-exp-{uuid.uuid4().hex[:8]}", user_id=exp_user.id)
        db.add(exp_cand)
        await db.flush()

        raw_exp_text = """
        Alexander Wright
        Email: alex.wright@example.com | Phone: +1 (555) 234-5678 | Location: San Francisco, CA
        LinkedIn: linkedin.com/in/alexwright | GitHub: github.com/alexwright

        PROFESSIONAL SUMMARY
        Senior Backend Architect with 6+ years of experience designing scalable microservices in Python, FastAPI, and PostgreSQL.

        WORK EXPERIENCE
        TechCorp Inc. — Senior Backend Engineer (Jan 2021 – Present)
        - Architected high-throughput REST APIs handling 10,000 requests/sec using FastAPI and PostgreSQL read-replicas.
        - Implemented Redis caching layer reducing database query latency by 45%.
        - Led migration to Kubernetes and Docker containers on AWS.

        DataScale LLC — Software Engineer (Jun 2018 – Dec 2020)
        - Developed distributed ETL data pipelines using Python and Celery.
        - Managed PostgreSQL database schema migrations and indexing strategies.

        PROJECTS
        Enterprise Microservice Core
        - Designed event-driven messaging service using RabbitMQ, Python, and PostgreSQL.
        - Hosted on AWS ECS with Docker containerization.

        EDUCATION
        B.S. in Computer Science — Stanford University (2014 – 2018) | CGPA: 3.9/4.0

        TECHNICAL SKILLS
        Programming Languages: Python, Go, C++, SQL
        Frameworks: FastAPI, Django, Flask
        Databases: PostgreSQL, Redis, MongoDB
        DevOps & Cloud: Docker, Kubernetes, AWS, Terraform
        Certifications: AWS Certified Solutions Architect (2022)
        Achievements: 1st Place TechCorp Hackathon 2022
        Languages: English (Native), Spanish (Conversational)
        """

        pdf_bytes = generate_sample_pdf([line.strip() for line in raw_exp_text.splitlines() if line.strip()])
        # Validate & Extract Clean Text via pdfplumber
        clean_exp_text = resume_service.extract_text_from_file_bytes(pdf_bytes, "alex_resume.pdf")
        print(" -> Clean PDF Text Extracted & Validated via pdfplumber [OK]")

        # Parse, Version (v1), Normalize into DB
        parsed_exp_v1 = await resume_service.parse_and_store_resume(
            db=db,
            candidate=exp_cand,
            file_name="alex_resume_v1.pdf",
            file_path="/uploads/resumes/alex_resume_v1.pdf",
            raw_text=clean_exp_text
        )

        assert parsed_exp_v1["version"] == 1, "First upload MUST be version 1"
        assert parsed_exp_v1["is_active"] == True, "Newest upload MUST be marked active"
        assert len(parsed_exp_v1["work_experience"]) >= 1, "Work experience MUST be extracted"
        assert len(parsed_exp_v1["skills"]) >= 3, "Technical skills MUST be extracted"
        assert parsed_exp_v1["ats_analysis"]["ats_score"] > 0, "ATS score MUST be calculated"
        print(" -> Experienced Resume v1 Parsed & Persisted into PostgreSQL [OK]")

        # Verify Auto Profile Sync
        res_cand_ref = await db.execute(select(Candidate).where(Candidate.id == exp_cand.id))
        updated_cand = res_cand_ref.scalar_one()
        assert updated_cand.phone == "+1 (555) 234-5678", "Candidate phone MUST be auto-updated"
        assert updated_cand.github_url == "github.com/alexwright", "GitHub URL MUST be auto-updated"
        print(" -> Candidate Profile Auto-Populated from Resume Data [OK]")

        # -------------------------------------------------------------------------
        # TEST 2: VERSIONING PIPELINE (Upload v2 for Experienced Candidate)
        # -------------------------------------------------------------------------
        print("\n--------------------------------------------------------------------------------")
        print("[TEST 2/4] RESUME VERSIONING PIPELINE (v1 -> v2 UPDATE)")
        print("--------------------------------------------------------------------------------")

        raw_exp_v2_text = raw_exp_text + "\nCertifications: AWS Certified DevOps Engineer (2023)\n"
        pdf_v2_bytes = generate_sample_pdf([line.strip() for line in raw_exp_v2_text.splitlines() if line.strip()])
        clean_v2_text = resume_service.extract_text_from_file_bytes(pdf_v2_bytes, "alex_resume_v2.pdf")

        parsed_exp_v2 = await resume_service.parse_and_store_resume(
            db=db,
            candidate=exp_cand,
            file_name="alex_resume_v2.pdf",
            file_path="/uploads/resumes/alex_resume_v2.pdf",
            raw_text=clean_v2_text
        )

        assert parsed_exp_v2["version"] == 2, "Second upload MUST be version 2"
        assert parsed_exp_v2["is_active"] == True, "Version 2 MUST be marked active"

        # Verify v1 was deactivated
        res_v1_check = await db.execute(select(Resume).where(Resume.id == parsed_exp_v1["resume_id"]))
        v1_db = res_v1_check.scalar_one()
        assert v1_db.is_active == False, "Version 1 MUST be deactivated"
        print(" -> Resume Versioning Verified (v1 deactivated, v2 set active) [OK]")

        versions = await resume_service.get_resume_versions(db, exp_cand.id)
        assert len(versions) == 2, "Version history MUST return 2 records"
        print(" -> Version History Query Verified [OK]")

        # -------------------------------------------------------------------------
        # TEST 3: STUDENT & INTERN RESUME PARSING (DOCX FILE EXTRACTION)
        # -------------------------------------------------------------------------
        print("\n--------------------------------------------------------------------------------")
        print("[TEST 3/4] STUDENT & INTERN RESUME PARSING (DOCX EXTRACTION)")
        print("--------------------------------------------------------------------------------")

        intern_user_id = f"test-usr-int-{uuid.uuid4().hex[:8]}"
        intern_user = User(
            id=intern_user_id,
            email=f"maya_intern_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="secret_pass_123",
            full_name="Maya Lin",
            role="candidate"
        )
        db.add(intern_user)
        await db.flush()

        intern_cand = Candidate(id=f"cand-int-{uuid.uuid4().hex[:8]}", user_id=intern_user.id)
        db.add(intern_cand)
        await db.flush()

        docx_blocks = [
            "Maya Lin",
            "Email: maya.lin@university.edu | Phone: +1 415 999 8877",
            "LinkedIn: linkedin.com/in/mayalin | Portfolio: mayalin.dev",
            "OBJECTIVE: Seeking a Software Engineering Internship for Summer 2024.",
            "INTERNSHIPS",
            "Acme Tech — Frontend Developer Intern (May 2023 – Aug 2023)",
            "- Developed responsive UI components using React, TypeScript, and CSS.",
            "- Collaborated with UX designers to build accessible web forms.",
            "PROJECTS",
            "Smart Campus Mobility App",
            "- Built React Native mobile application for student shuttle tracking.",
            "- Integrated Google Maps API and Firebase realtime database.",
            "EDUCATION",
            "B.S. in Computer Engineering — UC Berkeley (2021 – 2025)",
            "CGPA: 3.85 / 4.0",
            "SKILLS: React, TypeScript, JavaScript, Python, Git, HTML, Tailwind CSS",
            "ACHIEVEMENTS: UC Berkeley Dean's Honors List 2022-2023"
        ]

        docx_bytes = generate_sample_docx(docx_blocks)
        clean_docx_text = resume_service.extract_text_from_file_bytes(docx_bytes, "maya_lin_resume.docx")
        print(" -> DOCX File Extracted & Validated Successfully [OK]")

        parsed_intern = await resume_service.parse_and_store_resume(
            db=db,
            candidate=intern_cand,
            file_name="maya_lin_resume.docx",
            file_path="/uploads/resumes/maya_lin_resume.docx",
            raw_text=clean_docx_text
        )

        assert len(parsed_intern["internships"]) >= 1, "Internship experience MUST be extracted"
        assert len(parsed_intern["projects"]) >= 1, "Projects MUST be extracted"
        assert len(parsed_intern["education"]) >= 1, "Education MUST be extracted"
        print(" -> Intern Resume Parsed & Persisted into PostgreSQL [OK]")

        # -------------------------------------------------------------------------
        # TEST 4: AI INTERVIEW CONTEXT & RECRUITER CANDIDATE VIEW
        # -------------------------------------------------------------------------
        print("\n--------------------------------------------------------------------------------")
        print("[TEST 4/4] AI INTERVIEW CONTEXT & RECRUITER CANDIDATE VIEW")
        print("--------------------------------------------------------------------------------")

        # 1. Recruiter View
        rec_usr = User(id=f"rec-view-usr-{uuid.uuid4().hex[:8]}", email="recruiter_view@example.com", password_hash="123", full_name="Recruiter", role="recruiter")
        db.add(rec_usr)
        await db.flush()

        rec_view_data = await get_recruiter_candidate_view(candidate_id=exp_cand.id, user=rec_usr, db=db)
        assert rec_view_data["candidate_id"] == exp_cand.id, "Candidate ID MUST match"
        assert len(rec_view_data["work_experience"]) >= 1, "Recruiter view MUST contain work experience"
        assert len(rec_view_data["skills"]) >= 1, "Recruiter view MUST contain skills"
        assert rec_view_data["ats_analysis"]["ats_score"] > 0, "Recruiter view MUST contain ATS breakdown"
        print(" -> Recruiter Candidate View Verified [OK]")

        # 2. AI Interview Context
        ai_ctx = await get_interview_resume_context(candidate_id=exp_cand.id, user=exp_user, db=db)
        assert len(ai_ctx["skills"]) >= 1, "AI Context MUST contain skills"
        assert len(ai_ctx["projects"]) >= 1, "AI Context MUST contain projects"
        print(" -> AI Interview Context Payload Verified [OK]")

        print("\n================================================================================")
        print("OVERALL RESUME PIPELINE STATUS: PASSED (100% SUCCESS ACROSS ALL TESTS)")
        print("================================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_resume_parsing_pipeline_verification())
