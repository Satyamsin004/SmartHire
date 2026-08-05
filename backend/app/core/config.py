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
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgrespassword2026")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "smarthire_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def DATABASE_URL(self) -> str:
        db_override = os.getenv("DATABASE_URL")
        if db_override:
            return db_override
        use_sqlite = os.getenv("USE_SQLITE", "true").lower() in ("true", "1")
        if use_sqlite:
            return "sqlite+aiosqlite:///./smarthire.db"

        # Check if Postgres 5432 port is reachable
        import socket
        try:
            s = socket.create_connection((self.POSTGRES_SERVER, int(self.POSTGRES_PORT)), timeout=1)
            s.close()
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        except Exception:
            return "sqlite+aiosqlite:///./smarthire.db"
    
    @property
    def SYNC_DATABASE_URL(self) -> str:
        return f"sqlite:///./smarthire.db"

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
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # OAuth & SMTP Credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3001")
    
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
