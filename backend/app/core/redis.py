import asyncio
from typing import Optional
import redis.asyncio as aioredis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[aioredis.Redis] = None
_redis_loop: Optional[asyncio.AbstractEventLoop] = None

def get_redis_client() -> aioredis.Redis:
    global _redis_client, _redis_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _redis_client is not None and (_redis_loop is None or _redis_loop.is_closed() or (current_loop is not None and _redis_loop is not current_loop)):
        _redis_client = None
        _redis_loop = None

    if _redis_client is None:
        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5
        )
        _redis_loop = current_loop
    return _redis_client

class _RedisProxy:
    def __getattr__(self, name: str):
        client = get_redis_client()
        return getattr(client, name)

redis_client = _RedisProxy()

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
