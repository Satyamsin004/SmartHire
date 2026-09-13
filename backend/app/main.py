import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s: %(message)s')
logging.getLogger("smarthire.auth").setLevel(logging.DEBUG)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import RedirectResponse
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text
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

# High-Performance GZip Compression (compresses payloads > 1000 bytes by 70-85%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Configuration
is_production = settings.ENVIRONMENT.lower() == "production"

cors_origins = [settings.FRONTEND_URL]
production_origins = [
    "https://smarthireai.up.railway.app",
    "https://smarthire-production-675e.up.railway.app",
]
for p_o in production_origins:
    if p_o not in cors_origins:
        cors_origins.append(p_o)

if settings.CORS_ORIGINS:
    for o in settings.CORS_ORIGINS.split(","):
        clean_o = o.strip()
        if clean_o and clean_o not in cors_origins:
            cors_origins.append(clean_o)

if not is_production:
    dev_origins = [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    for d_o in dev_origins:
        if d_o not in cors_origins:
            cors_origins.append(d_o)

cors_kwargs = {
    "allow_origins": cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if not is_production:
    cors_kwargs["allow_origin_regex"] = r"https?://.*"

app.add_middleware(CORSMiddleware, **cors_kwargs)

@app.on_event("startup")
async def startup():
    from app.models import domain as _domain_models  # Registers all 25+ domain models with Base.metadata
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        for col_def in [
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS recording_status VARCHAR(50) DEFAULT 'PENDING';",
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(50) DEFAULT 'CLEAN';",
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS integrity_score FLOAT DEFAULT 100.0;",
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS total_integrity_incidents INTEGER DEFAULT 0;",
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(255);",
            "ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP;",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS candidate_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS transcript_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS vision_analysis_id VARCHAR(36);",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'COMPLETED';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS question_evaluations JSON DEFAULT '[]';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS practice_recommendations JSON DEFAULT '[]';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS speech_timeline JSON DEFAULT '[]';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS gaze_timeline JSON DEFAULT '[]';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS emotion_timeline JSON DEFAULT '[]';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'smart-hire-v2.0.0';",
            "ALTER TABLE scoring_reports ADD COLUMN IF NOT EXISTS analysis_version VARCHAR(50) DEFAULT 'evidence_based_v2';",
            "ALTER TABLE interview_visual_observations ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'smart-hire-behavior-v2.0';",
            "ALTER TABLE interview_visual_observations ADD COLUMN IF NOT EXISTS probability_distribution JSON DEFAULT '{}';",
            "ALTER TABLE interview_visual_observations ADD COLUMN IF NOT EXISTS observation_status VARCHAR(50) DEFAULT 'VALID';",
            "ALTER TABLE interview_visual_observations ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE interview_visual_observations ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'smart-hire-behavior-v2.0';",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS emotion_distribution JSON DEFAULT '{}';",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS emotion_timeline JSON DEFAULT '[]';",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS head_pose_stability FLOAT DEFAULT 0.0;",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS long_away_periods INTEGER DEFAULT 0;",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE interview_visual_metrics ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS filler_breakdown JSON DEFAULT '{}';",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS grammar_errors_sample JSON DEFAULT '[]';",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS pronunciation_status VARCHAR(100) DEFAULT 'Available';",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS long_pause_count INTEGER DEFAULT 0;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS average_pause_duration FLOAT DEFAULT 0.0;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS response_latency_avg FLOAT DEFAULT 0.0;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS vocabulary_richness FLOAT DEFAULT 0.0;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE interview_speech_metrics ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';",
            "ALTER TABLE interview_transcript_segments ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE interview_transcript_segments ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'PRODUCTION';",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS interview_id VARCHAR(36);",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(500);",
            "CREATE INDEX IF NOT EXISTS ix_interview_sessions_candidate_id ON interview_sessions (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_interview_sessions_job_app_id ON interview_sessions (job_application_id);",
            "CREATE INDEX IF NOT EXISTS ix_interview_sessions_status ON interview_sessions (status);",
            "CREATE INDEX IF NOT EXISTS ix_scoring_reports_session_id ON scoring_reports (session_id);",
            "CREATE INDEX IF NOT EXISTS ix_scoring_reports_candidate_id ON scoring_reports (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_scheduled_interviews_candidate_id ON scheduled_interviews (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_scheduled_interviews_job_id ON scheduled_interviews (job_id);",
            "CREATE INDEX IF NOT EXISTS ix_scheduled_interviews_job_app_id ON scheduled_interviews (job_application_id);",
            "CREATE INDEX IF NOT EXISTS ix_offer_letters_candidate_id ON offer_letters (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_offer_letters_job_app_id ON offer_letters (job_application_id);",
            "CREATE INDEX IF NOT EXISTS ix_resumes_candidate_id ON resumes (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_assessment_sessions_job_app_id ON assessment_sessions (job_application_id);",
            "CREATE INDEX IF NOT EXISTS ix_assessment_sessions_candidate_id ON assessment_sessions (candidate_id);",
            "CREATE INDEX IF NOT EXISTS ix_assessment_sessions_job_id ON assessment_sessions (job_id);",
            "CREATE INDEX IF NOT EXISTS ix_assessment_results_session_id ON assessment_results (session_id);",
            "CREATE INDEX IF NOT EXISTS ix_job_applications_cand_job ON job_applications (candidate_id, job_id);",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_interview_type ON notifications(user_id, interview_id, notification_type) WHERE interview_id IS NOT NULL;",
            "ALTER TABLE interview_questions ALTER COLUMN category TYPE VARCHAR(255);",
            "ALTER TABLE interview_questions ALTER COLUMN difficulty TYPE VARCHAR(100);",
            "ALTER TABLE speech_analysis ALTER COLUMN tone TYPE VARCHAR(255);",
            "ALTER TABLE emotion_analysis ALTER COLUMN dominant_emotion TYPE VARCHAR(100);"
        ]:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(col_def))
            except Exception:
                pass
    except Exception as e:
        print(f"Notice during startup DB schema check: {e}")

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

    # Start periodic reminder background worker
    import asyncio
    global _reminder_worker_task
    _reminder_worker_task = asyncio.create_task(_periodic_reminder_worker())

@app.on_event("shutdown")
async def shutdown():
    global _reminder_worker_task
    if _reminder_worker_task:
        _reminder_worker_task.cancel()

_reminder_worker_task = None

async def _periodic_reminder_worker():
    """Background task running every 60 seconds to process due interview reminders."""
    import asyncio
    from app.core.db import AsyncSessionLocal
    from app.services.reminder_service import reminder_service

    while True:
        try:
            await asyncio.sleep(60)
            async with AsyncSessionLocal() as db:
                await reminder_service.process_due_reminders(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.getLogger("smarthire.scheduler").warning("Background reminder worker notice: %s", e)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    logging.getLogger("smarthire.server").error(f"GLOBAL SERVER EXCEPTION on {request.method} {request.url.path}: {exc}\n{traceback.format_exc()}")
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=500, content={"detail": f"Server Error: {type(exc).__name__} - {str(exc)}"})

import os
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

class CachedStaticFiles(StaticFiles):
    """Static file server with automatic HTTP 1-day browser cache headers and dynamic PDF resume fallback."""
    async def get_response(self, path: str, scope) -> Response:
        try:
            response = await super().get_response(path, scope)
            if response.status_code == 200:
                response.headers["Cache-Control"] = "public, max-age=86400"
                return response
        except Exception:
            pass

        # If static resume file is absent from disk (e.g. ephemeral restart), dynamically generate from database
        clean_path = path.replace("\\", "/").strip("/")
        if "resume" in clean_path.lower():
            import io
            from app.core.db import AsyncSessionLocal
            from app.models.domain import Resume
            from sqlalchemy.future import select
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            fname = os.path.basename(clean_path)
            try:
                async with AsyncSessionLocal() as db:
                    res_r = await db.execute(
                        select(Resume).where(
                            (Resume.file_path.ilike(f"%{fname}%")) |
                            (Resume.file_name.ilike(f"%{fname}%"))
                        ).order_by(Resume.created_at.desc())
                    )
                    r_obj = res_r.scalars().first()
                    raw_text = r_obj.raw_text if (r_obj and r_obj.raw_text) else "Submitted Resume details recorded in database."

                    buf = io.BytesIO()
                    c = canvas.Canvas(buf, pagesize=letter)
                    c.setFont("Helvetica-Bold", 16)
                    c.drawString(50, 750, f"Resume: {r_obj.file_name if r_obj else fname}")
                    c.setFont("Helvetica", 9)
                    c.setFillColorRGB(0.3, 0.3, 0.3)
                    c.drawString(50, 735, "Verified Digital Candidate Submission • SmartHire Enterprise")
                    c.setFillColorRGB(0, 0, 0)
                    y = 705
                    for line in raw_text.splitlines():
                        line_clean = line.strip()
                        if not line_clean:
                            y -= 8
                            continue
                        if y < 60:
                            c.showPage()
                            c.setFont("Helvetica", 9)
                            y = 740
                        c.drawString(50, y, line_clean[:110])
                        y -= 13
                    c.save()
                    pdf_bytes = buf.getvalue()

                    # Save to static uploads directory so subsequent calls read directly from disk
                    disk_target = os.path.join(uploads_dir, "resumes", fname)
                    os.makedirs(os.path.dirname(disk_target), exist_ok=True)
                    with open(disk_target, "wb") as f:
                        f.write(pdf_bytes)

                    return Response(
                        content=pdf_bytes,
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": f"inline; filename={fname if fname.endswith('.pdf') else fname + '.pdf'}",
                            "Cache-Control": "public, max-age=86400"
                        }
                    )
            except Exception as e:
                pass

        return Response(status_code=404, content="File Not Found")

uploads_dir = os.path.join(os.getcwd(), "static", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", CachedStaticFiles(directory=uploads_dir), name="uploads")

from app.api.v1 import auth, users, resume, interview, coding, aptitude, recruiter, admin, scheduling, websocket, jobs, offers, notifications, uploads, applications, analytics

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
app.include_router(analytics.router, prefix=settings.API_V1_STR)
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

@app.get("/api/v1/system/db-status", tags=["System Diagnostics"])
async def get_db_status():
    """Returns real-time verification of database engine, tables, indexes, and application row counts."""
    from app.core.db import get_engine
    engine = get_engine()
    async with engine.connect() as conn:
        dialect = conn.dialect.name
        if dialect == "postgresql":
            tables_res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"))
            tables = [row[0] for row in tables_res.fetchall()]
            
            idx_res = await conn.execute(text("SELECT count(*) FROM pg_indexes WHERE schemaname='public';"))
            total_indexes = idx_res.scalar()
            
            fk_res = await conn.execute(text("SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';"))
            total_fks = fk_res.scalar()
        else:
            tables_res = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"))
            tables = [row[0] for row in tables_res.fetchall()]
            total_indexes = 0
            total_fks = 0
            
        total_rows = 0
        table_row_counts = {}
        for t in tables:
            try:
                cnt_res = await conn.execute(text(f'SELECT count(*) FROM "{t}";'))
                cnt = cnt_res.scalar()
                table_row_counts[t] = cnt
                total_rows += cnt
            except Exception:
                table_row_counts[t] = -1

    return {
        "database_engine": dialect,
        "total_tables": len(tables),
        "tables": tables,
        "total_indexes": total_indexes,
        "total_foreign_keys": total_fks,
        "total_application_rows": total_rows,
        "table_row_counts": table_row_counts,
        "schema_complete": len(tables) >= 51,
        "is_empty_of_records": total_rows == 0
    }

@app.post("/api/v1/system/run-migrations", tags=["System Diagnostics"])
async def trigger_run_migrations():
    """Trigger the existing SmartHire migrations and schema creation on demand."""
    from app.core.migrations import run_migrations
    success = await run_migrations()
    return {"status": "success" if success else "failed", "migrated": True}

@app.get("/health", tags=["Health Check"])
@app.get("/api/v1/health", tags=["Health Check"])
async def health():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "service": settings.PROJECT_NAME
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
