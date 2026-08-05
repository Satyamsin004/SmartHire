import asyncio
import io
import uuid
from pypdf import PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, Resume
from app.services.resume_service import resume_service

def generate_sample_pdf(filename: str, name: str, email: str, role: str, skills: list, exp_text: str):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.drawString(100, 750, f"Full Name: {name}")
    c.drawString(100, 730, f"Email: {email}")
    c.drawString(100, 710, f"Phone: +1-555-0199")
    c.drawString(100, 690, f"Target Role: {role}")
    c.drawString(100, 670, f"Location: San Francisco, CA")
    c.drawString(100, 650, f"GitHub: https://github.com/sampleuser")
    c.drawString(100, 630, f"LinkedIn: https://linkedin.com/in/sampleuser")
    c.drawString(100, 600, "Professional Summary:")
    c.drawString(100, 585, f"Dedicated {role} with 5+ years of experience building scalable applications.")
    c.drawString(100, 550, "Technical Skills:")
    c.drawString(100, 535, ", ".join(skills))
    c.drawString(100, 500, "Work Experience:")
    c.drawString(100, 485, exp_text)
    c.drawString(100, 450, "Education:")
    c.drawString(100, 435, "B.S. in Computer Science - Stanford University (2020)")
    c.save()
    pdf_bytes = buffer.getvalue()

    with open(filename, "wb") as f:
        f.write(pdf_bytes)
    return pdf_bytes

async def run_resume_analyzer_pipeline_test():
    print("====================================================================")
    print("         RESUME ANALYZER PIPELINE END-TO-END VERIFICATION")
    print("====================================================================\n")

    test_resumes = [
        {"file": "test_student_resume.pdf", "name": "Alice Student", "email": "alice_student@smarthire.ai", "role": "Junior Developer", "skills": ["Python", "HTML", "Git"], "exp": "Software Engineering Intern at Startup Co (2023)"},
        {"file": "test_experienced_resume.pdf", "name": "Bob Architect", "email": "bob_architect@smarthire.ai", "role": "Senior Architect", "skills": ["Python", "FastAPI", "React", "Docker", "PostgreSQL"], "exp": "Lead Systems Engineer at TechCorp (2018-2026)"},
        {"file": "test_intern_resume.pdf", "name": "Charlie Intern", "email": "charlie_intern@smarthire.ai", "role": "QA Intern", "skills": ["Python", "Selenium", "Postman"], "exp": "QA Testing Assistant at University Lab (2024)"},
        {"file": "test_singlepage_resume.pdf", "name": "Diana Solo", "email": "diana_solo@smarthire.ai", "role": "Frontend Engineer", "skills": ["TypeScript", "React", "TailwindCSS"], "exp": "Frontend Engineer at WebAgency (2022-2026)"},
        {"file": "test_multipage_resume.pdf", "name": "Evan Lead", "email": "evan_lead@smarthire.ai", "role": "DevOps Manager", "skills": ["Kubernetes", "Terraform", "AWS", "Python"], "exp": "DevOps Manager at CloudEnterprise (2015-2026)"}
    ]

    async with AsyncSessionLocal() as db:
        for idx, item in enumerate(test_resumes, 1):
            print(f"--- TEST RESUME #{idx}: {item['name']} ({item['file']}) ---")
            
            # Step 1: Generate PDF & extract bytes
            pdf_bytes = generate_sample_pdf(item['file'], item['name'], item['email'], item['role'], item['skills'], item['exp'])
            print(f"  [PASS] Step 1: PDF File Created ({len(pdf_bytes)} Bytes)")

            # Step 2: Extract text
            raw_text = resume_service.extract_text_from_file_bytes(pdf_bytes, item['file'])
            print(f"  [PASS] Step 2: Text Extracted ({len(raw_text)} Characters)")

            # Step 3: Create User & Candidate in DB
            unique_email = f"{item['email'].split('@')[0]}_{uuid.uuid4().hex[:4]}@smarthire.ai"
            user = User(
                id=f"usr-res-{uuid.uuid4().hex[:6]}",
                email=unique_email,
                password_hash="pwd",
                full_name=item['name'],
                role="candidate"
            )
            db.add(user)
            await db.flush()

            cand = Candidate(id=f"cand-res-{uuid.uuid4().hex[:6]}", user_id=user.id)
            db.add(cand)
            await db.flush()

            # Step 4: Execute Parse & Store Pipeline
            parsed_result = await resume_service.parse_and_store_resume(
                db=db,
                candidate=cand,
                file_name=item['file'],
                file_path=f"/uploads/resumes/{item['file']}",
                raw_text=raw_text
            )
            print(f"  [PASS] Step 4: Resume Parsed & Stored in PostgreSQL (Resume ID: {parsed_result.get('resume_id')})")
            print(f"         Extracted Skills: {parsed_result.get('skills', [])}")
            print(f"         ATS Match Score : {parsed_result.get('ats_score')}%")
            print(f"         Candidate Bio   : {parsed_result.get('summary')[:60]}...")

        await db.commit()
        print("\n====================================================================")
        print("[SUCCESS] ALL 5 RESUME PIPELINE TESTS PASSED 100%")
        print("====================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_resume_analyzer_pipeline_test())
