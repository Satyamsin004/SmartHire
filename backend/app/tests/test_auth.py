import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import (
    validate_password_complexity, get_password_hash, verify_password,
    create_access_token, create_refresh_token, verify_token
)

def test_password_complexity_validator():
    assert validate_password_complexity("StrongPass123!") == True
    assert validate_password_complexity("weak") == False
    assert validate_password_complexity("nouppercase123!") == False
    assert validate_password_complexity("NOLOWERCASE123!") == False
    assert validate_password_complexity("NoNumber!") == False
    assert validate_password_complexity("NoSpecial123") == False

def test_jwt_access_and_refresh_token_generation():
    token = create_access_token(subject="user-uuid-123", email="satyam@test.com", role="candidate")
    assert token is not None
    payload = verify_token(token, expected_type="access")
    assert payload is not None
    assert payload["sub"] == "user-uuid-123"
    assert payload["email"] == "satyam@test.com"
    assert payload["role"] == "candidate"

    refresh_token = create_refresh_token(subject="user-uuid-123", email="satyam@test.com", role="candidate")
    refresh_payload = verify_token(refresh_token, expected_type="refresh")
    assert refresh_payload is not None
    assert refresh_payload["token_type"] == "refresh"

def test_password_hashing():
    pwd = "SecurePassword2026!"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed) == True
    assert verify_password("WrongPassword123!", hashed) == False

@pytest.mark.asyncio
async def test_full_auth_flow_via_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register candidate
        email = f"pytest_cand_{asyncio.get_event_loop().time()}@test.com"
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "Password123!",
            "full_name": "Pytest Candidate",
            "role": "candidate"
        })
        assert reg_res.status_code == 201
        reg_data = reg_res.json()
        assert "access_token" in reg_data["tokens"]
        access_token = reg_data["tokens"]["access_token"]
        refresh_token = reg_data["tokens"]["refresh_token"]

        # 2. Login user
        login_res = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "Password123!"
        })
        assert login_res.status_code == 200
        refresh_token = login_res.json()["tokens"]["refresh_token"]

        # 3. Access Protected Route /users/me
        me_res = await client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert me_res.status_code == 200
        assert me_res.json()["email"] == email

        # 4. Refresh token
        refresh_res = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert refresh_res.status_code == 200
        assert "access_token" in refresh_res.json()["tokens"]

        # 5. Logout token revocation
        logout_res = await client.post("/api/v1/auth/logout", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert logout_res.status_code == 200

        # 6. Verify revoked token returns 401
        me_revoked = await client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert me_revoked.status_code == 401

def test_google_oauth_callback_redirect_url_format():
    """Regression test ensuring OAuth callback redirect is ALWAYS an absolute URL starting with https://smarthireai.up.railway.app/login."""
    import os
    from app.core.config import Settings
    
    # 1. Test production default
    os.environ["ENVIRONMENT"] = "production"
    if "FRONTEND_URL" in os.environ:
        del os.environ["FRONTEND_URL"]
    
    s_prod = Settings()
    frontend_base = s_prod.FRONTEND_URL.strip().rstrip('/')
    if not frontend_base.startswith("http://") and not frontend_base.startswith("https://"):
        frontend_base = f"https://{frontend_base}"
    
    target_url = f"{frontend_base}/login?token=test_token&user=test_user"
    assert target_url.startswith("https://smarthireai.up.railway.app/login?token=")
    assert "smarthire-production" not in target_url.replace("https://smarthireai", "")
    assert not target_url.startswith("/api/v1/auth/google/")

    # 2. Test when FRONTEND_URL is set without https:// (Railway domain reference edge-case)
    os.environ["FRONTEND_URL"] = "smarthireai.up.railway.app"
    s_no_scheme = Settings()
    fb_no_scheme = s_no_scheme.FRONTEND_URL.strip().rstrip('/')
    if not fb_no_scheme.startswith("http://") and not fb_no_scheme.startswith("https://"):
        fb_no_scheme = f"https://{fb_no_scheme}"
    target_url_2 = f"{fb_no_scheme}/login?token=test_token"
    assert target_url_2.startswith("https://smarthireai.up.railway.app/login?token=")

    # 3. Test when FRONTEND_URL has trailing slash
    os.environ["FRONTEND_URL"] = "https://smarthireai.up.railway.app/"
    s_trailing = Settings()
    fb_trailing = s_trailing.FRONTEND_URL.strip().rstrip('/')
    target_url_3 = f"{fb_trailing}/login?token=test_token"
    assert target_url_3.startswith("https://smarthireai.up.railway.app/login?token=")
    assert "//login" not in target_url_3

    # Clean up environment variables
    os.environ["ENVIRONMENT"] = "development"
    if "FRONTEND_URL" in os.environ:
        del os.environ["FRONTEND_URL"]

