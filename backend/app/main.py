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
