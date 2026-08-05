import requests

BASE_URL = "http://localhost:8000"

print("=========================================================================")
print("=== VERIFYING SWAGGER OPENAPI SECURITY SCHEME & AUTHORIZATION ===")
print("=========================================================================\n")

# 1. Fetch OpenAPI Specification Schema
r_openapi = requests.get(f"{BASE_URL}/openapi.json")
print(f"[OPENAPI SCHEMA] GET /openapi.json -> Status Code: {r_openapi.status_code}")
assert r_openapi.status_code == 200

schema = r_openapi.json()
security_schemes = schema.get("components", {}).get("securitySchemes", {})
global_security = schema.get("security", [])

print(f"[SECURITY SCHEMES] Configured Schemes: {list(security_schemes.keys())}")
print(f"   HTTPBearer Scheme: {security_schemes.get('HTTPBearer')}")
print(f"[GLOBAL SECURITY] Configured Security: {global_security}")

assert "HTTPBearer" in security_schemes, "HTTPBearer missing from components.securitySchemes!"
assert security_schemes["HTTPBearer"]["type"] == "http"
assert security_schemes["HTTPBearer"]["scheme"] == "bearer"
assert {"HTTPBearer": []} in global_security, "HTTPBearer missing from global security array!"

print("\n[OK] OpenAPI Specification contains HTTPBearer Security Scheme and Global Security Requirement.")
print("[OK] Swagger UI (/docs) WILL DISPLAY THE AUTHORIZE (LOCK) BUTTON!")

# 2. Test Authenticated Requests using Authorization header as Swagger UI sends
r_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": "abhay@gmail.com", "password": "Password123!"})
assert r_login.status_code == 200, f"Login failed: {r_login.text}"
token = r_login.json()["tokens"]["access_token"]

swagger_headers = {"Authorization": f"Bearer {token}"}

# Test GET /api/v1/recruiter/stats via Swagger header
r_stats = requests.get(f"{BASE_URL}/api/v1/recruiter/stats", headers=swagger_headers)
print(f"\n[SWAGGER TEST] GET /api/v1/recruiter/stats -> Status: {r_stats.status_code}")
print(f"   Stats Data: {r_stats.json()}")
assert r_stats.status_code == 200

# Test GET /api/v1/recruiter/registered-candidates via Swagger header
r_cands = requests.get(f"{BASE_URL}/api/v1/recruiter/registered-candidates", headers=swagger_headers)
print(f"[SWAGGER TEST] GET /api/v1/recruiter/registered-candidates -> Status: {r_cands.status_code}")
print(f"   Candidates Count: {len(r_cands.json())}")
assert r_cands.status_code == 200

print("\n=========================================================================")
print("[PASS] SWAGGER UI OPENAPI SECURITY SCHEME AND BEARER AUTH 100% OPERATIONAL!")
print("=========================================================================\n")
