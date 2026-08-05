import os
import requests
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.core.config import settings
from app.core.security import create_access_token, decode_token, verify_token

print("=========================================================================")
print("=== COMPREHENSIVE JWT LIFECYCLE & SECURITY AUDIT ===")
print("=========================================================================\n")

# 1. Environment & Config Values
print("[CONFIG ENVIRONMENT CHECK]")
print(f"   PROJECT_NAME               : {settings.PROJECT_NAME}")
print(f"   SECRET_KEY (from config)   : {settings.SECRET_KEY[:8]}...{settings.SECRET_KEY[-8:]}")
print(f"   SECRET_KEY Length          : {len(settings.SECRET_KEY)} chars")
print(f"   ALGORITHM                  : {settings.ALGORITHM}")
print(f"   ACCESS_TOKEN_EXPIRE_MINUTES: {settings.ACCESS_TOKEN_EXPIRE_MINUTES} minutes")

assert len(settings.SECRET_KEY) >= 16, "SECRET_KEY is too short!"
assert settings.ALGORITHM == "HS256", "Algorithm mismatch!"

# 2. Token Lifecycle Test (Generation -> Decoding -> Verification)
user_id = "test-user-uuid-1234"
email = "abhay@gmail.com"
role = "recruiter"

token = create_access_token(subject=user_id, email=email, role=role)
print(f"\n[JWT GENERATION] Token generated successfully: {token[:20]}...")

# Decode token using app security decode_token
payload = decode_token(token)
print(f"[JWT DECODING] Payload decoded: sub={payload.get('sub')}, email={payload.get('email')}, role={payload.get('role')}, exp={payload.get('exp')}")

assert payload.get("sub") == user_id
assert payload.get("email") == email
assert payload.get("role") == role
assert payload.get("token_type") == "access"

# Verify token using verify_token
verified_payload = verify_token(token, expected_type="access")
print(f"[JWT VERIFICATION] Token verified successfully: {verified_payload is not None}")
assert verified_payload is not None

# 3. HTTP API Live Login & Protected Endpoint Test
BASE_URL = "http://localhost:8000"

r_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": email, "password": "Password123!"})
print(f"\n[LIVE HTTP LOGIN] POST /api/v1/auth/login -> Status: {r_login.status_code}")
assert r_login.status_code == 200, f"Login failed: {r_login.text}"

api_token = r_login.json()["tokens"]["access_token"]
print(f"[LIVE HTTP TOKEN] Access Token received: {api_token[:20]}...")

# Test 1: Sending token as 'Bearer <token>' (Standard Axios / Swagger HTTPBearer)
h1 = {"Authorization": f"Bearer {api_token}"}
r1 = requests.get(f"{BASE_URL}/api/v1/recruiter/stats", headers=h1)
print(f"[LIVE HTTP CHECK] Standard Header (Bearer <token>) -> Status: {r1.status_code}")
assert r1.status_code == 200

# Test 2: Double 'Bearer Bearer <token>' prefix (Common Swagger UI User Error)
h2 = {"Authorization": f"Bearer Bearer {api_token}"}
r2 = requests.get(f"{BASE_URL}/api/v1/recruiter/stats", headers=h2)
print(f"[LIVE HTTP CHECK] Redundant Prefix (Bearer Bearer <token>) -> Status: {r2.status_code}")

print("\n=========================================================================")
print("[PASS] JWT LIFECYCLE & VERIFICATION 100% OPERATIONAL & CONSISTENT!")
print("=========================================================================\n")
