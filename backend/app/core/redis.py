import redis.asyncio as aioredis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = aioredis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True
)

async def is_token_blacklisted(token: str) -> bool:
    try:
        val = await redis_client.get(f"blacklist:{token}")
        return val is not None
    except Exception as e:
        logger.warn(f"Redis connection fallback: {e}")
        return False

async def blacklist_token(token: str, expire_seconds: int = 604800):
    try:
        await redis_client.set(f"blacklist:{token}", "blacklisted", ex=expire_seconds)
    except Exception as e:
        logger.warn(f"Redis blacklist warning: {e}")
