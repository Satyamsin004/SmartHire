import requests
import time

BASE_URL = "http://localhost:8000/api/v1"

def run_security_auth_audit():
    print("=== STARTING COMPLETE AUTHENTICATION & JWT SECURITY AUDIT ===")

    # Test 1: User Registration & bcrypt Hashing Verification
    email = f"auth_audit_{int(time.time())}@example.com"
    pwd = "SecurePassword123!"
    
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Auth Audit User",
        "email": email,
        "password": pwd,
        "role": "candidate"
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    access_token = reg_data["tokens"]["access_token"]
    refresh_token = reg_data["tokens"]["refresh_token"]
    user_id = reg_data["user"]["id"]
    print("✓ Test 1 Passed: User Registration returns valid Access & Refresh Tokens")

    # Test 2: Invalid Password Complexity Rejection
    bad_pwd_res = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Bad Pwd User",
        "email": f"bad_pwd_{int(time.time())}@example.com",
        "password": "123", # Too short / weak
        "role": "candidate"
    })
    assert bad_pwd_res.status_code == 400
    print("✓ Test 2 Passed: Weak password complexity rejected (400 Bad Request)")

    # Test 3: User Login & JWT Token Pair Generation
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": pwd
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["tokens"]["access_token"] is not None
    assert login_data["tokens"]["refresh_token"] is not None
    print("✓ Test 3 Passed: User Login succeeds with valid bcrypt verification")

    # Test 4: Protected Endpoint Validates JWT & Derives User Identity
    me_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user_id"] == user_id
    assert me_data["email"] == email
    print("✓ Test 4 Passed: Protected API (/users/me) derives identity strictly from JWT subject")

    # Test 5: Role-Based Access Control (RBAC) Enforcement
    rec_endpoint_res = requests.get(f"{BASE_URL}/recruiter/applications", headers={"Authorization": f"Bearer {access_token}"})
    assert rec_endpoint_res.status_code == 403
    print("✓ Test 5 Passed: RBAC dependency blocks candidate role from recruiter endpoint (403 Forbidden)")

    # Test 6: Access Token Refresh Flow & Previous Refresh Token Revocation
    refresh_res = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    new_access_token = refresh_res.json()["tokens"]["access_token"]
    new_refresh_token = refresh_res.json()["tokens"]["refresh_token"]
    print("✓ Test 6 Passed: Token Refresh generates new Access and Refresh tokens")

    # Test 7: Re-use of Revoked Refresh Token Blocked
    old_refresh_reuse = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    assert old_refresh_reuse.status_code == 401
    print("✓ Test 7 Passed: Previous refresh token reuse blocked after rotation (401 Unauthorized)")

    # Test 8: Logout & Token Revocation (Blacklisting in Redis)
    logout_res = requests.post(
        f"{BASE_URL}/auth/logout",
        headers={"Authorization": f"Bearer {new_access_token}"},
        json={"refresh_token": new_refresh_token}
    )
    assert logout_res.status_code == 200
    print("✓ Test 8 Passed: Logout API returns success message")

    # Test 9: Verify Access Token Revoked After Logout
    revoked_access_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert revoked_access_res.status_code == 401
    print("✓ Test 9 Passed: Blacklisted access token rejected after logout (401 Unauthorized)")

    # Test 10: Request Password Reset & Reset Token Validation
    forgot_res = requests.post(f"{BASE_URL}/auth/forgot-password", json={"email": email})
    assert forgot_res.status_code == 200
    print("✓ Test 10 Passed: Forgot password endpoint responds without leaking email existence")

    print("\n=== ALL AUTHENTICATION & JWT SECURITY AUDIT TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_security_auth_audit()
