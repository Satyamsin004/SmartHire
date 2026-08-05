import asyncio
import uuid
from datetime import datetime
from app.core.db import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.domain import User, Candidate, Recruiter, JobPosting, JobApplication, ScheduledInterview

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("=== SEEDING REAL LIVE PRODUCTION DATA INTO POSTGRESQL 18 DOCKER DATABASE ===")
        
        # 1. Create Recruiter User: abhay@gmail.com
        pwd_hash = get_password_hash("Password123!")
        rec_u = User(
            id=str(uuid.uuid4()),
            email="abhay@gmail.com",
            password_hash=pwd_hash,
            full_name="abhay",
            role="recruiter",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(rec_u)
        await db.flush()

        rec_p = Recruiter(
            id=str(uuid.uuid4()),
            user_id=rec_u.id,
            company_name="SmartHire Corp",
            subscription_tier="Enterprise",
            created_at=datetime.utcnow()
        )
        db.add(rec_p)
        await db.flush()

        # 2. Create Job Postings
        job1 = JobPosting(
            id=str(uuid.uuid4()),
            recruiter_id=rec_p.id,
            company_name="SmartHire Corp",
            title="Senior Full Stack Engineer",
            department="Engineering",
            location="Remote / New York",
            employment_type="Full-Time",
            description="Looking for an experienced Full Stack Engineer with Python and React skills.",
            required_skills=["Python", "FastAPI", "React", "PostgreSQL"],
            experience_required="5+ years",
            status="Published",
            created_at=datetime.utcnow()
        )
        job2 = JobPosting(
            id=str(uuid.uuid4()),
            recruiter_id=rec_p.id,
            company_name="SmartHire Corp",
            title="AI / ML Architect",
            department="AI Research",
            location="San Francisco, CA",
            employment_type="Full-Time",
            description="Architect next-gen LLM applications.",
            required_skills=["Python", "PyTorch", "Gemini", "PostgreSQL"],
            experience_required="6+ years",
            status="Published",
            created_at=datetime.utcnow()
        )
        db.add_all([job1, job2])
        await db.flush()

        # 3. Create 12 Registered Candidates
        candidate_users = []
        candidate_profiles = []
        applications = []
        interviews = []

        candidate_names = [
            ("Satyam Kumar", "satyamsin004@gmail.com", "Senior Software Engineer", 6),
            ("Alice Smith", "alice.smith@example.com", "Frontend Specialist", 4),
            ("Bob Jones", "bob.jones@example.com", "Backend Developer", 5),
            ("Charlie Brown", "charlie.b@example.com", "DevOps Engineer", 7),
            ("Diana Prince", "diana.p@example.com", "Full Stack Engineer", 3),
            ("Ethan Hunt", "ethan.h@example.com", "Security Engineer", 8),
            ("Fiona Gallagher", "fiona.g@example.com", "QA Automation Lead", 5),
            ("George Clark", "george.c@example.com", "Data Scientist", 4),
            ("Hannah Abbott", "hannah.a@example.com", "UI/UX Designer", 3),
            ("Ian Malcolm", "ian.m@example.com", "ML Specialist", 6),
            ("Julia Roberts", "julia.r@example.com", "Cloud Architect", 9),
            ("Kevin Bacon", "kevin.b@example.com", "Systems Engineer", 5),
        ]

        for idx, (name, email, role_title, exp) in enumerate(candidate_names):
            cand_u = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=pwd_hash,
                full_name=name,
                role="candidate",
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            candidate_users.append(cand_u)
            db.add(cand_u)
            await db.flush()

            cand_p = Candidate(
                id=str(uuid.uuid4()),
                user_id=cand_u.id,
                phone=f"+1-555-010{idx}",
                location="San Francisco, CA",
                headline=role_title,
                target_role=role_title,
                experience_level=f"{exp} years",
                status="Registered" if idx >= 6 else ("Shortlisted" if idx in [2, 3] else "Applied"),
                created_at=datetime.utcnow()
            )
            candidate_profiles.append(cand_p)
            db.add(cand_p)
            await db.flush()

            # Create Applications for first 6 candidates
            if idx < 6:
                app_status = "Applied" if idx < 2 else ("Shortlisted" if idx < 4 else "Interviewed")
                app = JobApplication(
                    id=str(uuid.uuid4()),
                    candidate_id=cand_p.id,
                    job_id=job1.id if idx % 2 == 0 else job2.id,
                    status=app_status,
                    ats_score=85.0 + idx,
                    ai_recommendation="Shortlist" if idx < 4 else "Maybe",
                    applied_at=datetime.utcnow()
                )
                applications.append(app)
                db.add(app)
                await db.flush()

                if idx in [2, 3, 4, 5]:
                    intv = ScheduledInterview(
                        id=str(uuid.uuid4()),
                        candidate_id=cand_p.id,
                        recruiter_id=rec_p.id,
                        job_application_id=app.id,
                        scheduled_date=datetime.utcnow(),
                        round_type="Technical" if idx % 2 == 0 else "HR",
                        status="Scheduled" if idx < 4 else "Completed",
                        created_at=datetime.utcnow()
                    )
                    interviews.append(intv)
                    db.add(intv)

        await db.commit()
        print("\n=========================================================================")
        print(f"[SUCCESS] POSTGRESQL 18 DOCKER DATABASE SEEDED SUCCESSFULLY!")
        print(f"   Recruiter Account       : abhay@gmail.com (Password123!)")
        print(f"   Total Users in DB       : {len(candidate_users) + 1}")
        print(f"   Registered Candidates   : {len(candidate_profiles)}")
        print(f"   Active Job Postings     : 2")
        print(f"   Applications Created    : {len(applications)}")
        print(f"   Interviews Scheduled    : {len(interviews)}")
        print("=========================================================================\n")

if __name__ == "__main__":
    asyncio.run(seed_data())
