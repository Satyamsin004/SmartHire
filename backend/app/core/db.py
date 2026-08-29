import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
from app.core.config import settings

Base = declarative_base()

_engine: Optional[AsyncEngine] = None
_engine_loop: Optional[asyncio.AbstractEventLoop] = None
_async_session_factory: Optional[async_sessionmaker] = None

def get_engine() -> AsyncEngine:
    global _engine, _engine_loop, _async_session_factory
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _engine is not None and current_loop is not None and _engine_loop is not None and _engine_loop is not current_loop:
        _engine = None
        _engine_loop = None
        _async_session_factory = None

    if _engine is None:
        connect_args = {}
        if settings.DATABASE_URL.startswith("sqlite"):
            connect_args["timeout"] = 60.0

        engine_kwargs = {
            "echo": False,
            "future": True,
            "pool_pre_ping": True,
            "connect_args": connect_args
        }

        if not settings.DATABASE_URL.startswith("sqlite"):
            engine_kwargs.update({
                "pool_size": 20,
                "max_overflow": 10,
                "pool_recycle": 1800,
                "pool_timeout": 30
            })

        _engine = create_async_engine(
            settings.DATABASE_URL,
            **engine_kwargs
        )
        _engine_loop = current_loop

        if settings.DATABASE_URL.startswith("sqlite"):
            @event.listens_for(_engine.sync_engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA busy_timeout=30000")
                cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.close()

    return _engine

def get_session_factory() -> async_sessionmaker:
    global _async_session_factory
    engine = get_engine()
    if _async_session_factory is None or _async_session_factory.kw.get("bind") is not engine:
        _async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
    return _async_session_factory

async def dispose_engine():
    global _engine, _engine_loop, _async_session_factory
    if _engine is not None:
        try:
            await _engine.dispose()
        except Exception:
            pass
        _engine = None
        _engine_loop = None
        _async_session_factory = None

def __getattr__(name: str):
    if name == "engine":
        return get_engine()
    elif name == "AsyncSessionLocal":
        return get_session_factory()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

async def get_db():
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
