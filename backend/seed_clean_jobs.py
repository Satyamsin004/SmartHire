import asyncio
import uuid
from sqlalchemy import text, select
from app.core.db import AsyncSessionLocal
from app.models.domain import JobPosting, User, Recruiter

CLEAN_JOBS = [
    {
        "title": "Senior Full Stack Engineer",
        "company_name": "SmartHire AI Systems",
        "company_logo": None,
        "department": "Engineering",
        "employment_type": "Full-Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "San Francisco, CA / Remote",
        "salary_range": "$160,000 - $210,000",
        "description": "We are seeking a Senior Full Stack Engineer to lead the design and implementation of high-throughput web applications and AI-driven candidate evaluation systems.",
        "education_required": "Bachelor's in Computer Science or equivalent experience",
        "required_skills": ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker"],
        "preferred_skills": ["GraphQL", "Redis", "Kafka", "AWS"],
        "responsibilities": [
            "Architect and build microservices with Python/FastAPI and React/TypeScript.",
            "Optimize PostgreSQL database queries and real-time streaming integrations.",
            "Collaborate with AI researchers to deploy ML scoring models to production."
        ],
        "requirements": [
            "5+ years of full-stack software development experience.",
            "Strong proficiency in modern JavaScript/TypeScript and Python async frameworks.",
            "Proven track record building production web applications."
        ],
        "benefits": ["Full Medical/Dental/Vision", "401(k) Matching", "Unlimited PTO", "Remote Stipend"],
        "perks": ["Flexible Working Hours", "Learning & Conference Allowance"],
        "openings": 3,
        "status": "Published"
    },
    {
        "title": "Lead AI / ML Infrastructure Engineer",
        "company_name": "SmartHire Systems",
        "company_logo": None,
        "department": "AI Research & Platform",
        "employment_type": "Full-Time",
        "work_mode": "Hybrid",
        "experience_required": "6+ Years",
        "location": "New York, NY",
        "salary_range": "$180,000 - $240,000",
        "description": "Join our AI Platform team to build low-latency inference pipelines, LLM orchestration layers, and real-time multimodal evaluation algorithms.",
        "education_required": "Master's or Ph.D. in Computer Science, Machine Learning, or related field",
        "required_skills": ["Python", "PyTorch", "LLMs", "Vector Databases", "FastAPI", "CUDA"],
        "preferred_skills": ["LangChain", "LlamaIndex", "vLLM", "Kubernetes"],
        "responsibilities": [
            "Design ultra-low latency LLM inference backends and streaming APIs.",
            "Implement fine-tuning and evaluation pipelines for speech and text analysis models.",
            "Ensure high availability and fault tolerance of AI services."
        ],
        "requirements": [
            "6+ years experience engineering AI/ML platform infrastructure.",
            "Deep understanding of Transformer architectures, embeddings, and vector indices.",
            "Experience operating GPU clusters in cloud environments."
        ],
        "benefits": ["Competitive Equity Package", "Full Health Benefits", "Annual Research Grant"],
        "perks": ["Top-tier Workstation Hardware", "Commuter Subsidy"],
        "openings": 2,
        "status": "Published"
    },
    {
        "title": "Senior Backend Engineer (Python / FastAPI)",
        "company_name": "CloudScale Tech",
        "company_logo": None,
        "department": "Cloud Platform",
        "employment_type": "Full-Time",
        "work_mode": "Remote",
        "experience_required": "4+ Years",
        "location": "Austin, TX / Remote",
        "salary_range": "$150,000 - $195,000",
        "description": "CloudScale Tech is looking for a Backend Systems Engineer to scale event-driven microservices, REST APIs, and distributed data pipelines.",
        "education_required": "Bachelor's in Computer Science or Software Engineering",
        "required_skills": ["Python", "FastAPI", "SQLAlchemy", "PostgreSQL", "Redis", "Celery"],
        "preferred_skills": ["RabbitMQ", "gRPC", "Docker", "Terraform"],
        "responsibilities": [
            "Develop high-performance RESTful APIs using Python FastAPI.",
            "Design database schemas and optimize query execution plans.",
            "Implement caching strategies with Redis and asynchronous queues with Celery."
        ],
        "requirements": [
            "4+ years of professional backend software development experience.",
            "Expert knowledge of Python async programming and relational databases.",
            "Experience with microservice communication patterns."
        ],
        "benefits": ["Health/Vision/Dental", "Flexible Time Off", "Home Office Budget"],
        "perks": ["Wellness Allowance", "Annual Team Retreats"],
        "openings": 4,
        "status": "Published"
    },
    {
        "title": "Frontend Tech Lead (React & TypeScript)",
        "company_name": "NextGen Platforms",
        "company_logo": None,
        "department": "Product Frontend",
        "employment_type": "Full-Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "Seattle, WA / Remote",
        "salary_range": "$155,000 - $200,000",
        "description": "Lead frontend development for interactive dashboard applications, real-time video interview rooms, and dynamic analytics visualizers.",
        "education_required": "Bachelor's Degree in CS, Design, or related field",
        "required_skills": ["React", "TypeScript", "Tailwind CSS", "Redux/Zustand", "WebRTC", "Vite"],
        "preferred_skills": ["Next.js", "WebSockets", "Canvas/Chart.js", "Jest/Cypress"],
        "responsibilities": [
            "Lead frontend architectural decisions and build modular component libraries.",
            "Implement WebRTC video streaming and Web Speech API integrations.",
            "Maintain high UI performance, accessibility, and responsive layouts."
        ],
        "requirements": [
            "5+ years building modern web interfaces with React and TypeScript.",
            "Solid expertise in responsive CSS, state management, and web media APIs.",
            "Strong UI/UX design sensibility."
        ],
        "benefits": ["Comprehensive Insurance", "401(k) Match", "Parental Leave"],
        "perks": ["Sabbatical Program", "Professional Coaching"],
        "openings": 2,
        "status": "Published"
    },
    {
        "title": "DevOps & Cloud Security Architect",
        "company_name": "Enterprise Cloud Labs",
        "company_logo": None,
        "department": "Infrastructure & Security",
        "employment_type": "Full-Time",
        "work_mode": "Hybrid",
        "experience_required": "6+ Years",
        "location": "Boston, MA",
        "salary_range": "$165,000 - $215,000",
        "description": "Oversee enterprise cloud infrastructure, Kubernetes clusters, CI/CD automated deployment pipelines, and SOC2 security compliance.",
        "education_required": "Bachelor's in Information Technology, Computer Science, or Cybersecurity",
        "required_skills": ["AWS/GCP", "Kubernetes", "Docker", "Terraform", "CI/CD", "Security Standards"],
        "preferred_skills": ["Helm", "Prometheus", "Grafana", "Vault"],
        "responsibilities": [
            "Maintain automated multi-environment Kubernetes deployments.",
            "Manage IAM policies, cloud security auditing, and automated vulnerability scanning.",
            "Optimize cloud infrastructure cost and reliability metrics."
        ],
        "requirements": [
            "6+ years experience in DevOps, Site Reliability, or Infrastructure Engineering.",
            "Hands-on experience with Terraform Infrastructure as Code.",
            "Proven track record managing zero-downtime production environments."
        ],
        "benefits": ["Executive Health Plan", "Discretionary Bonus", "401(k) Contribution"],
        "perks": ["On-site Gym & Meals", "Tuition Reimbursement"],
        "openings": 1,
        "status": "Published"
    },
    {
        "title": "Staff Data Engineer",
        "company_name": "Analytics Intelligence Corp",
        "company_logo": None,
        "department": "Data Platform",
        "employment_type": "Full-Time",
        "work_mode": "Remote",
        "experience_required": "5+ Years",
        "location": "Chicago, IL / Remote",
        "salary_range": "$170,000 - $220,000",
        "description": "Drive real-time telemetry processing, analytics aggregation pipelines, and machine learning feature stores for candidate evaluation metrics.",
        "education_required": "Bachelor's or Master's in Computer Science or Data Engineering",
        "required_skills": ["Python", "SQL", "Spark", "Kafka", "PostgreSQL", "Snowflake"],
        "preferred_skills": ["dbt", "Airflow", "Databricks"],
        "responsibilities": [
            "Design scalable ETL/ELT pipelines for streaming and batch data processing.",
            "Model database schemas for high-speed analytical queries.",
            "Collaborate with product teams to build candidate readiness telemetry."
        ],
        "requirements": [
            "5+ years building production data pipelines and analytical datamarts.",
            "Expert SQL authoring and database optimization skills.",
            "Experience with event streaming frameworks."
        ],
        "benefits": ["Health & Wellness Benefits", "Unlimited Vacation", "Annual Stock Grants"],
        "perks": ["Ergonomic Equipment Allowance", "Conference Stipend"],
        "openings": 2,
        "status": "Published"
    }
]

async def purge_and_seed_jobs():
    async with AsyncSessionLocal() as db:
        # Get recruiter to attach jobs to
        res_r = await db.execute(select(Recruiter))
        recruiter = res_r.scalars().first()
        rec_id = recruiter.id if recruiter else None

        if not rec_id:
            # Check user table for recruiter
            res_u = await db.execute(select(User).where(User.role == "recruiter"))
            u_rec = res_u.scalars().first()
            if u_rec:
                new_rec = Recruiter(user_id=u_rec.id, company_name="SmartHire AI Systems", department="Engineering")
                db.add(new_rec)
                await db.commit()
                await db.refresh(new_rec)
                rec_id = new_rec.id

        # Clear existing test jobs
        await db.execute(text("DELETE FROM job_postings"))
        await db.commit()
        print("[OK] All previous auto-generated test jobs purged from database!")

        # Seed clean professional jobs
        for job_data in CLEAN_JOBS:
            job = JobPosting(
                id=str(uuid.uuid4()),
                recruiter_id=rec_id,
                title=job_data["title"],
                company_name=job_data["company_name"],
                company_logo=job_data["company_logo"],
                department=job_data["department"],
                employment_type=job_data["employment_type"],
                work_mode=job_data["work_mode"],
                experience_required=job_data["experience_required"],
                location=job_data["location"],
                salary_range=job_data["salary_range"],
                description=job_data["description"],
                education_required=job_data["education_required"],
                required_skills=job_data["required_skills"],
                preferred_skills=job_data["preferred_skills"],
                responsibilities="\n".join(job_data["responsibilities"]),
                requirements="\n".join(job_data["requirements"]),
                benefits="\n".join(job_data["benefits"]),
                perks="\n".join(job_data["perks"]),
                openings=job_data["openings"],
                status=job_data["status"]
            )
            db.add(job)

        await db.commit()
        print(f"[OK] Seeded {len(CLEAN_JOBS)} clean professional job requisitions!")

if __name__ == "__main__":
    asyncio.run(purge_and_seed_jobs())
