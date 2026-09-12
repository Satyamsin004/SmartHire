import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load root environment variables (.env)
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartHire AI Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smarthire-ai-super-secret-production-key-2026-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgrespassword2026")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "smarthire_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    @property
    def EFFECTIVE_POSTGRES_SERVER(self) -> str:
        for k in ["POSTGRES_SERVER", "POSTGRES_HOST", "PGHOST"]:
            val = os.getenv(k)
            if val:
                val = val.strip()
                if not val.startswith("${{"):
                    return val
        val = (os.getenv("POSTGRES_SERVER") or os.getenv("PGHOST") or "").strip()
        if val.startswith("${{"):
            return "postgres.railway.internal"
        return val or "localhost"

    @property
    def EFFECTIVE_POSTGRES_PORT(self) -> str:
        for k in ["POSTGRES_PORT", "PGPORT"]:
            val = os.getenv(k)
            if val:
                val = val.strip()
                if not val.startswith("${{"):
                    return val
        return "5432"

    @property
    def EFFECTIVE_POSTGRES_USER(self) -> str:
        for k in ["POSTGRES_USER", "PGUSER"]:
            val = os.getenv(k)
            if val:
                val = val.strip()
                if not val.startswith("${{"):
                    return val
        return "postgres"

    @property
    def EFFECTIVE_POSTGRES_PASSWORD(self) -> str:
        for k in ["POSTGRES_PASSWORD", "PGPASSWORD"]:
            val = os.getenv(k)
            if val:
                val = val.strip()
                if not val.startswith("${{"):
                    return val
        return os.getenv("POSTGRES_PASSWORD", "postgrespassword2026")

    @property
    def EFFECTIVE_POSTGRES_DB(self) -> str:
        for k in ["POSTGRES_DB", "POSTGRES_DATABASE", "PGDATABASE"]:
            val = os.getenv(k)
            if val:
                val = val.strip()
                if not val.startswith("${{"):
                    return val
        return "railway" if os.getenv("ENVIRONMENT") == "production" else "smarthire_db"
    
    @property
    def CANONICAL_SQLITE_PATH(self) -> str:
        # Canonical location of primary SmartHire SQLite database with all historical sessions
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        canonical_path = os.path.join(backend_dir, "smarthire.db")
        return canonical_path.replace("\\", "/")

    @property
    def DATABASE_URL(self) -> str:
        for url_key in ["DATABASE_URL", "DATABASE_PRIVATE_URL", "DATABASE_PUBLIC_URL"]:
            db_override = os.getenv(url_key)
            if db_override and not db_override.startswith("${{"):
                db_override = db_override.strip()
                if db_override.startswith("postgres://"):
                    db_override = db_override.replace("postgres://", "postgresql+asyncpg://", 1)
                elif db_override.startswith("postgresql://") and "+asyncpg" not in db_override:
                    db_override = db_override.replace("postgresql://", "postgresql+asyncpg://", 1)
                return db_override

        use_sqlite = os.getenv("USE_SQLITE", "false" if os.getenv("ENVIRONMENT") == "production" else "true").lower() in ("true", "1")
        if use_sqlite:
            return f"sqlite+aiosqlite:///{self.CANONICAL_SQLITE_PATH}"

        return f"postgresql+asyncpg://{self.EFFECTIVE_POSTGRES_USER}:{self.EFFECTIVE_POSTGRES_PASSWORD}@{self.EFFECTIVE_POSTGRES_SERVER}:{self.EFFECTIVE_POSTGRES_PORT}/{self.EFFECTIVE_POSTGRES_DB}"
    
    @property
    def SYNC_DATABASE_URL(self) -> str:
        for url_key in ["SYNC_DATABASE_URL", "DATABASE_URL", "DATABASE_PRIVATE_URL", "DATABASE_PUBLIC_URL"]:
            db_override = os.getenv(url_key)
            if db_override and not db_override.startswith("${{"):
                db_override = db_override.strip()
                if db_override.startswith("postgresql+asyncpg://"):
                    db_override = db_override.replace("postgresql+asyncpg://", "postgresql://", 1)
                elif db_override.startswith("postgres://"):
                    db_override = db_override.replace("postgres://", "postgresql://", 1)
                return db_override

        use_sqlite = os.getenv("USE_SQLITE", "false" if os.getenv("ENVIRONMENT") == "production" else "true").lower() in ("true", "1")
        if use_sqlite:
            return f"sqlite:///{self.CANONICAL_SQLITE_PATH}"
        return f"postgresql://{self.EFFECTIVE_POSTGRES_USER}:{self.EFFECTIVE_POSTGRES_PASSWORD}@{self.EFFECTIVE_POSTGRES_SERVER}:{self.EFFECTIVE_POSTGRES_PORT}/{self.EFFECTIVE_POSTGRES_DB}"

    REDIS_HOST: str = os.getenv("REDIS_HOST", "127.0.0.1")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    GEMINI_API_KEY_1: str = os.getenv("GEMINI_API_KEY_1", "")
    GEMINI_API_KEY_2: str = os.getenv("GEMINI_API_KEY_2", "")
    GEMINI_API_KEY_3: str = os.getenv("GEMINI_API_KEY_3", "")
    GEMINI_API_KEY_4: str = os.getenv("GEMINI_API_KEY_4", "")
    OPENROUTER_API_KEY_1: str = os.getenv("OPENROUTER_API_KEY_1", "")
    OPENROUTER_API_KEY_2: str = os.getenv("OPENROUTER_API_KEY_2", "")
    GROQ_API_KEY_1: str = os.getenv("GROQ_API_KEY_1", "")
    GROQ_API_KEY_2: str = os.getenv("GROQ_API_KEY_2", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # OAuth & SMTP Credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    @property
    def GOOGLE_REDIRECT_URI(self) -> str:
        override = os.getenv("GOOGLE_REDIRECT_URI")
        if override:
            override = override.strip().rstrip('/')
            if not override.startswith("${{") and "your-production-domain.com" not in override:
                is_prod = (os.getenv("ENVIRONMENT") or "").lower() == "production" or bool(os.getenv("RAILWAY_ENVIRONMENT"))
                if is_prod and ("localhost" in override or "127.0.0.1" in override):
                    return "https://smarthire-production-675e.up.railway.app/api/v1/auth/google/callback"
                if not override.startswith("http://") and not override.startswith("https://"):
                    override = f"https://{override}"
                return override

        is_prod = (os.getenv("ENVIRONMENT") or "").lower() == "production" or bool(os.getenv("RAILWAY_ENVIRONMENT"))
        if is_prod:
            return "https://smarthire-production-675e.up.railway.app/api/v1/auth/google/callback"
        return "http://localhost:8000/api/v1/auth/google/callback"

    @property
    def FRONTEND_URL(self) -> str:
        override = os.getenv("FRONTEND_URL")
        if override:
            override = override.strip().rstrip('/')
            if not override.startswith("${{") and "your-production-domain.com" not in override:
                is_prod = (os.getenv("ENVIRONMENT") or "").lower() == "production" or bool(os.getenv("RAILWAY_ENVIRONMENT"))
                if is_prod and ("localhost" in override or "127.0.0.1" in override):
                    return "https://smarthireai.up.railway.app"
                if not override.startswith("http://") and not override.startswith("https://"):
                    override = f"https://{override}"
                return override

        is_prod = (os.getenv("ENVIRONMENT") or "").lower() == "production" or bool(os.getenv("RAILWAY_ENVIRONMENT"))
        if is_prod:
            return "https://smarthireai.up.railway.app"
        return "http://localhost:3001"
    
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "noreply@smarthire.ai")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "smtp-app-password")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@smarthire.ai")
    
    class Config:
        case_sensitive = True

settings = Settings()

import logging
_logger = logging.getLogger("smarthire.config")
_logger.info("==========================================")
_logger.info("CONFIG STARTUP INSTRUMENTATION")
_logger.info("settings.OPENROUTER_MODEL: %s", settings.OPENROUTER_MODEL)
_logger.info("os.environ['OPENROUTER_MODEL']: %s", os.getenv("OPENROUTER_MODEL"))
_logger.info("==========================================")
