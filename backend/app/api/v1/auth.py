import json
import urllib.parse
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.config import settings
from app.core.db import get_db
from app.services.auth_service import AuthService
from app.schemas.domain import (
    UserRegister, UserLogin, TokenResponse, RefreshTokenRequest,
    EmailVerifyRequest, ForgotPasswordRequest, ResetPasswordRequest, GoogleOAuthRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication & Authorization"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, summary="User Registration")
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    """Registers a new user with password complexity validation and dispatches verification email."""
    auth_service = AuthService(db)
    return await auth_service.register_user(
        email=user_in.email,
        password=user_in.password,
        full_name=user_in.full_name,
        role=user_in.role
    )

@router.post("/login", response_model=TokenResponse, summary="User Login")
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticates credentials, updates last_login, and returns Access (15m) + Refresh (7d) JWT tokens."""
    auth_service = AuthService(db)
    return await auth_service.authenticate_user(
        email=user_in.email,
        password=user_in.password
    )

@router.post("/refresh", summary="Regenerate Access Token")
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Validates refresh token, revokes previous refresh token, and returns new token pair."""
    auth_service = AuthService(db)
    return await auth_service.refresh_session_tokens(refresh_token=body.refresh_token)

@router.post("/logout", summary="User Logout & Token Revocation")
async def logout(
    authorization: Optional[str] = Header(None),
    body: Optional[RefreshTokenRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """Blacklists Access and Refresh JWT tokens in Redis."""
    access_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None
    refresh_token = body.refresh_token if body else None
    auth_service = AuthService(db)
    await auth_service.logout_user(access_token=access_token, refresh_token=refresh_token)
    return {"message": "Successfully logged out and revoked tokens."}

@router.get("/google/login", summary="Initiate Google OAuth2 Authorization Code Flow")
async def google_login(role: Optional[str] = "candidate"):
    """Redirects the user to Google OAuth2 consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID is not configured in backend environment variables."
        )

    user_role = role if role in ["candidate", "recruiter", "admin"] else "candidate"
    
    params = {
        "response_type": "code",
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "scope": "openid email profile",
        "state": user_role,
        "access_type": "offline",
        "prompt": "select_account consent"
    }

    google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=google_oauth_url)

@router.get("/google/callback", summary="Google OAuth2 Redirect Callback Handler")
async def google_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    state: Optional[str] = "candidate",
    db: AsyncSession = Depends(get_db)
):
    """Exchanges Google auth code for access token, fetches user profile, provisions account, and redirects to frontend with JWT."""
    if error or not code:
        err_msg = urllib.parse.quote(error or "Authorization code was not provided.")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error={err_msg}")

    # 1. Exchange authorization code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_res = await client.post(token_url, data=token_payload)
        if token_res.status_code != 200:
            err_details = token_res.json().get("error_description", "Failed to exchange Google OAuth code.")
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error={urllib.parse.quote(err_details)}")

        tokens_data = token_res.json()
        google_access_token = tokens_data.get("access_token")

        # 2. Fetch Google user info profile
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        userinfo_res = await client.get(userinfo_url, headers={"Authorization": f"Bearer {google_access_token}"})
        if userinfo_res.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=Failed%20to%20fetch%20Google%20user%20profile")

        profile = userinfo_res.json()

    email = profile.get("email")
    full_name = profile.get("name", email.split("@")[0] if email else "Google User")
    profile_image = profile.get("picture")
    user_role = state if state in ["candidate", "recruiter", "admin"] else "candidate"

    if not email:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=Google%20account%20did%20not%20provide%20an%20email%20address.")

    # 3. Provision or authenticate user in SmartHire AI PostgreSQL database
    auth_service = AuthService(db)
    result = await auth_service.google_oauth_login(
        email=email,
        full_name=full_name,
        profile_image=profile_image,
        role=user_role
    )

    access_token = result["tokens"]["access_token"]
    user_data_encoded = urllib.parse.quote(json.dumps(result["user"]))

    # 4. Redirect to frontend with token and user data
    target_url = f"{settings.FRONTEND_URL}/login?token={access_token}&user={user_data_encoded}"
    return RedirectResponse(url=target_url)

@router.post("/google", response_model=TokenResponse, summary="Google OAuth2 Authentication (Direct API)")
async def google_oauth_login(body: GoogleOAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates or provisions user via Google OAuth2 direct payload."""
    auth_service = AuthService(db)
    return await auth_service.google_oauth_login(
        email=body.email,
        full_name=body.full_name,
        profile_image=body.profile_image,
        role=body.role or "candidate"
    )

@router.post("/verify-email", summary="Account Activation")
async def verify_email(body: EmailVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Activates candidate/recruiter account using email verification token."""
    auth_service = AuthService(db)
    await auth_service.verify_email_token(token=body.token)
    return {"message": "Email address verified successfully. Your account is activated."}

@router.post("/forgot-password", summary="Request Password Reset")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Generates a 15-minute reset token and sends password reset email."""
    auth_service = AuthService(db)
    await auth_service.request_password_reset(email=body.email)
    return {"message": "If the email is registered, a password reset link has been sent."}

@router.post("/reset-password", summary="Reset Password with Token")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validates 15-minute reset token and updates password hash in PostgreSQL."""
    auth_service = AuthService(db)
    await auth_service.reset_password_with_token(token=body.token, new_password=body.new_password)
    return {"message": "Password has been reset successfully."}
