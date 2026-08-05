import redis.asyncio as aioredis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = aioredis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_connect_timeout=0.5,
    socket_timeout=0.5
)

_memory_blacklist = set()

async def is_token_blacklisted(token: str) -> bool:
    try:
        val = await redis_client.get(f"blacklist:{token}")
        if val is not None:
            return True
    except Exception as e:
        logger.warning(f"Redis connection fallback: {e}")
    return token in _memory_blacklist

async def blacklist_token(token: str, expire_seconds: int = 604800):
    _memory_blacklist.add(token)
    try:
        await redis_client.set(f"blacklist:{token}", "blacklisted", ex=expire_seconds)
    except Exception as e:
        logger.warning(f"Redis blacklist warning: {e}")
