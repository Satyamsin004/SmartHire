from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Callable, Optional
import logging

from app.core.db import get_db
from app.core.security import verify_token
from app.core.redis import is_token_blacklisted
from app.repositories.user_repository import UserRepository
from app.models.domain import User

logger = logging.getLogger("smarthire.auth")

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif authorization:
        token = authorization

    if token:
        token = token.strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()

    if not token:
        logger.warning("AUTH FAIL: No token provided. credentials=%s, authorization=%s",
                       bool(credentials), bool(authorization))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or invalid format."
        )

    if await is_token_blacklisted(token):
        logger.warning("AUTH FAIL: Token is blacklisted (first 20 chars): %s...", token[:20])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or logged out."
        )

    payload = verify_token(token, expected_type="access")
    if not payload:
        logger.warning("AUTH FAIL: Token verification failed (first 20 chars): %s...", token[:20])
        # Try to decode without verification to see what's wrong
        from app.core.security import decode_token
        raw_payload = decode_token(token)
        if raw_payload:
            logger.warning("AUTH FAIL: Token decoded but type mismatch. token_type=%s, expected=access",
                           raw_payload.get("token_type"))
        else:
            logger.warning("AUTH FAIL: Token could not be decoded at all (invalid/expired JWT)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired."
        )

    user_id = payload.get("sub")
    logger.info("AUTH: Token valid for user_id=%s, email=%s", user_id, payload.get("email"))
    
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if not user and payload.get("email"):
        user = await user_repo.get_by_email(payload.get("email"))

    if not user or not user.is_active:
        logger.warning("AUTH FAIL: User not found or inactive. user_id=%s, email=%s, found=%s", user_id, payload.get("email"), bool(user))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found."
        )

    logger.info("AUTH SUCCESS: user=%s role=%s", user.email, user.role)
    return user

def require_role(allowed_roles: List[str]) -> Callable:
    """
    Reusable Role-Based Access Control (RBAC) dependency factory.
    Example: Depends(require_role(["admin", "recruiter"]))
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.lower()
        normalized_allowed = [r.lower() for r in allowed_roles]
        
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{current_user.role}' lacks required permissions."
            )
        return current_user

    return role_checker
