from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.core.db import engine, Base
from app.services.ai_engine import ai_engine
from app.services.ai_provider import ai_provider
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
    # Print all registered FastAPI routes safely
    print("\n================================================================================")
    print("=== REGISTERED FASTAPI ROUTES (VERIFYING BACKEND ENDPOINTS) ===")
    print("================================================================================")
    for route in app.routes:
        path = getattr(route, "path", None) or getattr(route, "path_format", str(type(route).__name__))
        methods = getattr(route, "methods", None)
        methods_str = ",".join(sorted(methods)) if methods else "MOUNT/WS"
        print(f"  {methods_str:<12} {path}")
    print("================================================================================\n")

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
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS headline VARCHAR(255);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location VARCHAR(255);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(255);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS employment_preference VARCHAR(100);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_authorization VARCHAR(100);")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;")
        await safe_execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS objective TEXT;")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS languages JSON;")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500);")
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
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_preferences JSON;")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_preferences JSON;")
        await safe_execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notification_settings JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS communication_metrics JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS confidence_metrics JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS technical_metrics JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS professionalism_metrics JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS missing_topics JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS ideal_answers JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS practice_suggestions JSON;")
        await safe_execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS fsm_state VARCHAR(50) DEFAULT 'WAITING_FOR_QUESTION';")
        
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

        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS grammar_score FLOAT DEFAULT 85.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS problem_solving_score FLOAT DEFAULT 84.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS behavior_score FLOAT DEFAULT 82.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS leadership_score FLOAT DEFAULT 78.0;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS overall_summary TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS technical_analysis TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS communication_analysis TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS behavioral_analysis TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS grammar_analysis TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS confidence_analysis TEXT;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS strengths JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS weaknesses JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS improvement_plan JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS learning_resources JSON;")
        await safe_execute("ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500);")
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

from app.api.v1 import auth, users, resume, interview, coding, aptitude, recruiter, admin, scheduling, websocket, jobs, offers, notifications, uploads, applications

# Mount API V1 Router Modules
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(uploads.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(applications.router, prefix=settings.API_V1_STR)
app.include_router(offers.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(resume.router, prefix=settings.API_V1_STR)
app.include_router(interview.router, prefix=settings.API_V1_STR)
app.include_router(coding.router, prefix=settings.API_V1_STR)
app.include_router(aptitude.router, prefix=settings.API_V1_STR)
app.include_router(recruiter.router, prefix=settings.API_V1_STR)
app.include_router(scheduling.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(websocket.router)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="SmartHire AI Assessment Platform Production Backend API Engine",
        routes=app.routes,
    )
    components = openapi_schema.setdefault("components", {})
    components["securitySchemes"] = {
        "HTTPBearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT Access Token (without 'Bearer ' prefix)."
        }
    }
    openapi_schema["security"] = [{"HTTPBearer": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

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
    api_key = settings.GEMINI_API_KEY_1
    if not api_key:
        return {
            "status": "error",
            "api_key_configured": False,
            "error": "GEMINI_API_KEY_1 environment variable is not set."
        }

    prompt = "Say hello in one sentence."
    response = await ai_engine._call_gemini_with_fallback(prompt)
    if response:
        return {
            "status": "success",
            "api_key_configured": True,
            "model_used": ai_engine.model_name,
            "prompt": prompt,
            "raw_response": response,
        }
    return {
        "status": "error",
        "api_key_configured": True,
        "model_used": ai_engine.model_name,
        "prompt": prompt,
        "error": "Gemini request failed; inspect structured Gemini request logs for the failure category.",
    }

@app.get("/api/v1/system/ai-status", tags=["System Diagnostics"])
async def get_ai_system_status():
    """Return health and status of Gemini, OpenRouter, and Groq AI Providers."""
    return ai_provider.health_status()

@app.post("/api/v1/system/simulate-cooldown", tags=["System Diagnostics"])
async def simulate_provider_cooldown(provider: str = "gemini", duration_seconds: float = 300.0):
    """Simulate a 429 quota error to test provider cooldown and failover."""
    ai_provider.set_provider_cooldown(provider, duration_sec=duration_seconds, error_reason="429")
    return {"status": "cooldown_set", "provider": provider, "duration_seconds": duration_seconds}

@app.post("/api/v1/system/reset-health", tags=["System Diagnostics"])
async def reset_provider_health(provider: str = "gemini"):
    """Reset provider state to healthy for testing."""
    ai_provider.reset_provider_health(provider)
    return {"status": "health_reset", "provider": provider}

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
