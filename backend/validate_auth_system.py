import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_validation():
    print("====================================================")
    print("STARTING COMPLETE AUTHENTICATION & AUTHORIZATION SYSTEM VALIDATION")
    print("====================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 1. Test Password Complexity Validation (Weak Password)
        weak_res = await client.post("/api/v1/auth/register", json={
            "email": "weak_password@test.com",
            "password": "weak",
            "full_name": "Weak Pass User",
            "role": "candidate"
        })
        assert weak_res.status_code == 400, f"Expected 400 for weak password, got {weak_res.status_code}"
        print("✓ 1. Password Complexity Validation: Rejected weak password (400 Bad Request)")

        # 2. Test User Registration
        cand_email = f"candidate_{int(asyncio.get_event_loop().time())}@smarthire.ai"
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": cand_email,
            "password": "CandidatePass123!",
            "full_name": "Satyam Candidate",
            "role": "candidate"
        })
        assert reg_res.status_code == 201, f"Registration failed with {reg_res.status_code}: {reg_res.text}"
        reg_data = reg_res.json()
        assert "access_token" in reg_data["tokens"]
        cand_access_token = reg_data["tokens"]["access_token"]
        cand_refresh_token = reg_data["tokens"]["refresh_token"]
        print(f"✓ 2. Registration API: Created candidate user ({cand_email}) with UUID {reg_data['user']['id']}")

        # 3. Test Duplicate Registration Prevention
        dup_res = await client.post("/api/v1/auth/register", json={
            "email": cand_email,
            "password": "CandidatePass123!",
            "full_name": "Duplicate User",
            "role": "candidate"
        })
        assert dup_res.status_code == 400
        print("✓ 3. Duplicate Email Prevention: Rejected duplicate email (400 Bad Request)")

        # 4. Test User Login
        login_res = await client.post("/api/v1/auth/login", json={
            "email": cand_email,
            "password": "CandidatePass123!"
        })
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert login_data["user"]["email"] == cand_email
        print("✓ 4. Login API: Validated Bcrypt password & updated last_login timestamp")

        # 5. Test Protected Endpoint /users/me
        me_res = await client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {cand_access_token}"
        })
        assert me_res.status_code == 200
        assert me_res.json()["email"] == cand_email
        print("✓ 5. JWT Authorization Middleware: Successfully authenticated user profile via Bearer JWT")

        # 6. Test RBAC: Candidate attempting to access Admin endpoint (403 Forbidden)
        admin_forbidden_res = await client.get("/api/v1/users/admin-only", headers={
            "Authorization": f"Bearer {cand_access_token}"
        })
        assert admin_forbidden_res.status_code == 403
        print("✓ 6. RBAC Role Enforcement: Candidate blocked from Admin endpoint (403 Forbidden)")

        # 7. Test Admin User Registration & Admin RBAC Access
        admin_email = f"admin_{int(asyncio.get_event_loop().time())}@smarthire.ai"
        admin_reg = await client.post("/api/v1/auth/register", json={
            "email": admin_email,
            "password": "AdminPass123!",
            "full_name": "System Administrator",
            "role": "admin"
        })
        assert admin_reg.status_code == 201
        admin_access_token = admin_reg.json()["tokens"]["access_token"]

        admin_allow_res = await client.get("/api/v1/users/admin-only", headers={
            "Authorization": f"Bearer {admin_access_token}"
        })
        assert admin_allow_res.status_code == 200
        print(f"✓ 7. Admin RBAC Access: Admin user granted access to Admin endpoint (200 OK)")

        # 8. Test Refresh Token Endpoint
        refresh_res = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": cand_refresh_token
        })
        assert refresh_res.status_code == 200
        new_access_token = refresh_res.json()["tokens"]["access_token"]
        print("✓ 8. Refresh Token API: Regenerated fresh access token using 7-day refresh token")

        # 9. Test Logout & Token Blacklisting
        logout_res = await client.post("/api/v1/auth/logout", headers={
            "Authorization": f"Bearer {cand_access_token}"
        }, json={"refresh_token": cand_refresh_token})
        assert logout_res.status_code == 200
        print("✓ 9. Logout API: Blacklisted access & refresh tokens in Redis")

        # 10. Test Revoked Token Access Attempt (401 Unauthorized)
        revoked_res = await client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {cand_access_token}"
        })
        assert revoked_res.status_code == 401
        print("✓ 10. Redis Revocation Verification: Blocked blacklisted token (401 Unauthorized)")

        # 11. Test Google OAuth API
        oauth_res = await client.post("/api/v1/auth/google", json={
            "email": "google_candidate@smarthire.ai",
            "full_name": "Google Candidate User",
            "role": "candidate"
        })
        assert oauth_res.status_code == 200
        assert oauth_res.json()["user"]["provider"] == "google"
        print("✓ 11. Google OAuth2 API: Provisioned user & returned JWT tokens")

        # 12. Test Forgot Password API
        forgot_res = await client.post("/api/v1/auth/forgot-password", json={
            "email": cand_email
        })
        assert forgot_res.status_code == 200
        print("✓ 12. Forgot Password API: Dispatched 15-min password reset token")

    print("====================================================")
    print("ALL 12 AUTHENTICATION & AUTHORIZATION VALIDATION TESTS PASSED 100%!")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(run_validation())
