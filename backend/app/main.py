from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.core.db import engine, Base
from app.api.v1 import auth, users, resume, interview, coding, aptitude, recruiter, admin, scheduling, websocket

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SmartHire AI Assessment Platform Production Backend API Engine",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text

        async def safe_execute(statement_str: str):
            try:
                if conn.dialect.name == "sqlite":
                    sql = statement_str.replace(" ADD COLUMN IF NOT EXISTS ", " ADD COLUMN ")
                else:
                    sql = statement_str
                await conn.execute(text(sql))
            except Exception:
                pass

        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Registered';")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruiter_notes TEXT;")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rating FLOAT DEFAULT 0.0;")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50) DEFAULT 'Remote';")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS education_required VARCHAR(255);")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS requirements TEXT;")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS perks TEXT;")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS selection_process TEXT;")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_contact VARCHAR(100);")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_email VARCHAR(255);")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS recruiter_phone VARCHAR(50);")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS interview_rounds JSON;")
        await safe_execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS hiring_timeline VARCHAR(100);")
        await safe_execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS address TEXT;")
        await safe_execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_ctc VARCHAR(50);")
        await safe_execute("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS expected_ctc VARCHAR(50);")
        await safe_execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);")
        await safe_execute("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS company_logo VARCHAR(500);")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS projects JSON;")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS certifications JSON;")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages JSON;")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_years VARCHAR(50);")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;")
        
        # Interview Sessions & Scheduled Interviews workflow columns
        await safe_execute("ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS job_application_id VARCHAR(36);")
        await safe_execute("ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS job_id VARCHAR(36);")
        await safe_execute("ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS resume_id VARCHAR(36);")
        await safe_execute("ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 6;")
        await safe_execute("ALTER TABLE scheduled_interviews ADD COLUMN IF NOT EXISTS config_json JSON;")

        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recruiter_id VARCHAR(36);")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_application_id VARCHAR(36);")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS job_id VARCHAR(36);")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS resume_id VARCHAR(36);")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS scheduled_interview_id VARCHAR(36);")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'Medium';")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 6;")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS interview_type VARCHAR(50) DEFAULT 'Recruiter';")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS config_json JSON;")

        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS grammar_score FLOAT DEFAULT 90.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS problem_solving_score FLOAT DEFAULT 85.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS recommendation VARCHAR(50) DEFAULT 'Shortlist';")
        
        tables = [
            "users", "candidates", "recruiters", "admins", "resumes", "job_descriptions",
            "saved_jobs", "interview_templates", "interview_sessions", "interview_questions",
            "interview_answers", "scoring_reports", "achievements", "activity_logs",
            "scheduled_interviews", "notifications", "job_postings", "job_applications", "offer_letters", "resume_views"
        ]
        for tbl in tables:
            await safe_execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;")
            await safe_execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';")

@app.middleware("http")
async def test_environment_middleware(request, call_next):
    is_test_env = (
        request.headers.get("X-Test-Environment") == "TEST" or 
        request.query_params.get("environment") == "TEST"
    )
    request.state.is_test_env = is_test_env
    response = await call_next(request)
    return response

import os
from fastapi.staticfiles import StaticFiles

uploads_dir = os.path.join(os.getcwd(), "static", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

from app.api.v1 import auth, users, resume, interview, coding, aptitude, recruiter, admin, scheduling, websocket, jobs, offers, notifications, uploads

# Mount API V1 Router Modules
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(uploads.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(offers.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(resume.router, prefix=settings.API_V1_STR)
app.include_router(interview.router, prefix=settings.API_V1_STR)
app.include_router(coding.router, prefix=settings.API_V1_STR)
app.include_router(aptitude.router, prefix=settings.API_V1_STR)
app.include_router(recruiter.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(scheduling.router, prefix=settings.API_V1_STR)
app.include_router(websocket.router)

# Convenience Redirects for Legacy or Alternative Doc Paths
@app.get("/api/v1/docs", include_in_schema=False)
async def redirect_api_v1_docs():
    return RedirectResponse(url="/docs")

@app.get("/api/v1/redoc", include_in_schema=False)
async def redirect_api_v1_redoc():
    return RedirectResponse(url="/redoc")

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def redirect_api_v1_openapi():
    return RedirectResponse(url="/openapi.json")

@app.get("/api/test/gemini", tags=["Gemini Diagnostic Test"])
async def test_gemini_endpoint():
    """Temporary test endpoint to verify raw Gemini API key execution without fallback."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {
            "status": "error",
            "api_key_configured": False,
            "error": "GEMINI_API_KEY environment variable is not set."
        }

    prompt = "Say hello in one sentence."
    candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
    results = {}

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name)
            res = await model.generate_content_async(prompt)
            if res and res.text:
                return {
                    "status": "success",
                    "api_key": f"{api_key[:8]}...{api_key[-4:]}",
                    "model_used": model_name,
                    "prompt": prompt,
                    "raw_response": res.text.strip()
                }
        except Exception as e:
            results[model_name] = {
                "error_type": type(e).__name__,
                "error_details": str(e)
            }

    return {
        "status": "error",
        "api_key": f"{api_key[:8]}...{api_key[-4:]}",
        "prompt": prompt,
        "model_attempts": results
    }

@app.get("/", tags=["Health Check"])
async def root():
    return {
        "message": "SmartHire AI Engine API operational",
        "swagger_docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "version": settings.VERSION,
        "status": "healthy"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
