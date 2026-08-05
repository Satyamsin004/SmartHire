import asyncio
from app.core.db import engine, Base
import app.models.domain  # load all models

async def create_tables():
    print("=== INITIALIZING ALL DOMAIN MODELS ON POSTGRESQL 18 DOCKER DATABASE ===")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[SUCCESS] ALL TABLES CREATED ON POSTGRESQL 18 DOCKER CONTAINER!")

if __name__ == "__main__":
    asyncio.run(create_tables())
