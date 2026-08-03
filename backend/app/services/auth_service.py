from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import Dict, Any, Optional

from app.repositories.user_repository import UserRepository
from app.core.security import (
    validate_password_complexity, get_password_hash, verify_password,
    create_access_token, create_refresh_token, create_action_token,
    decode_token, verify_token
)
from app.core.redis import blacklist_token, is_token_blacklisted
from app.services.email_service import email_service

class AuthService:
    def __init__(self, db: AsyncSession):
        self.user_repo = UserRepository(db)

    async def register_user(self, email: str, password: str, full_name: str, role: str = "candidate") -> Dict[str, Any]:
        if not validate_password_complexity(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long, contain uppercase, lowercase, number, and a special character."
            )

        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered."
            )

        hashed_pwd = get_password_hash(password)
        user = await self.user_repo.create_user(
            email=email,
            password_hash=hashed_pwd,
            full_name=full_name,
            role=role,
            provider="local",
            is_verified=False
        )

        verify_token_str = create_action_token(subject=user.id, action="verify_email", expires_minutes=1440)
        await email_service.send_verification_email(user.email, verify_token_str)

        access_token = create_access_token(subject=user.id, email=user.email, role=user.role)
        refresh_token = create_refresh_token(subject=user.id, email=user.email, role=user.role)

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "provider": user.provider,
                "is_verified": user.is_verified,
                "is_active": user.is_active
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": 900 # 15 minutes
            }
        }

    async def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials provided."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated."
            )

        await self.user_repo.update_last_login(user.id)

        access_token = create_access_token(subject=user.id, email=user.email, role=user.role)
        refresh_token = create_refresh_token(subject=user.id, email=user.email, role=user.role)

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "provider": user.provider,
                "is_verified": user.is_verified,
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": 900
            }
        }

    async def refresh_session_tokens(self, refresh_token: str) -> Dict[str, Any]:
        if await is_token_blacklisted(refresh_token):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked.")

        payload = verify_token(refresh_token, expected_type="refresh")
        if not payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token.")

        user_id = payload.get("sub")
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account inactive or not found.")

        # Invalidate old refresh token
        await blacklist_token(refresh_token, expire_seconds=604800)

        new_access_token = create_access_token(subject=user.id, email=user.email, role=user.role)
        new_refresh_token = create_refresh_token(subject=user.id, email=user.email, role=user.role)

        return {
            "tokens": {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": 900
            }
        }

    async def logout_user(self, access_token: str, refresh_token: Optional[str] = None):
        if access_token:
            await blacklist_token(access_token, expire_seconds=900)
        if refresh_token:
            await blacklist_token(refresh_token, expire_seconds=604800)
        return True

    async def google_oauth_login(self, email: str, full_name: str, profile_image: Optional[str] = None, role: str = "candidate") -> Dict[str, Any]:
        user = await self.user_repo.get_by_email(email)
        if not user:
            random_pwd_hash = get_password_hash("OAuth2GoogleSecuredPass2026!")
            user = await self.user_repo.create_user(
                email=email,
                password_hash=random_pwd_hash,
                full_name=full_name,
                role=role,
                provider="google",
                is_verified=True
            )
        else:
            await self.user_repo.update_last_login(user.id)

        access_token = create_access_token(subject=user.id, email=user.email, role=user.role)
        refresh_token = create_refresh_token(subject=user.id, email=user.email, role=user.role)

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "provider": user.provider,
                "is_verified": user.is_verified
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": 900
            }
        }

    async def verify_email_token(self, token: str) -> bool:
        payload = decode_token(token)
        if not payload or payload.get("action") != "verify_email":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token.")

        user_id = payload.get("sub")
        await self.user_repo.set_verified(user_id)
        return True

    async def request_password_reset(self, email: str) -> bool:
        user = await self.user_repo.get_by_email(email)
        if not user:
            # Prevent email enumeration by returning True
            return True

        reset_token = create_action_token(subject=user.id, action="reset_password", expires_minutes=15)
        await email_service.send_password_reset_email(user.email, reset_token)
        return True

    async def reset_password_with_token(self, token: str, new_password: str) -> bool:
        payload = decode_token(token)
        if not payload or payload.get("action") != "reset_password":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

        if not validate_password_complexity(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters long, contain uppercase, lowercase, number, and a special character."
            )

        user_id = payload.get("sub")
        hashed_pwd = get_password_hash(new_password)
        await self.user_repo.update_password(user_id, hashed_pwd)
        return True
