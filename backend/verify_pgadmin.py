import asyncio
import urllib.request
import json
from sqlalchemy import text
from app.core.db import AsyncSessionLocal

async def test_db_pgadmin():
    print("=== STEP 5: VERIFYING POSTGRESQL CONNECTION ===")
    async with AsyncSessionLocal() as db:
        v = (await db.execute(text("SELECT version();"))).scalar()
        d = (await db.execute(text("SELECT current_database();"))).scalar()
        u = (await db.execute(text("SELECT current_user;"))).scalar()
        print(f"✓ PostgreSQL Version: {v[:40]}...")
        print(f"✓ Current Database: {d}")
        print(f"✓ Current User: {u}")

    print("\n=== STEP 6: VERIFYING TABLES IN PUBLIC SCHEMA ===")
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';"))
        tables = [r[0] for r in res.fetchall()]
        print(f"✓ Found {len(tables)} tables in PostgreSQL public schema:")
        print(sorted(tables))
        assert "users" in tables, "Missing users table!"
        assert "candidates" in tables, "Missing candidates table!"

    print("\n=== STEP 7: REGISTERING TEST USER VIA AUTH API & VERIFYING ROW ===")
    url_reg = "http://localhost:8000/api/v1/auth/register"
    data_reg = json.dumps({
        "email": "pgadmin_verifier@smarthire.ai",
        "password": "Password123!",
        "full_name": "PgAdmin Verifier User",
        "role": "recruiter"
    }).encode("utf-8")

    req = urllib.request.Request(url_reg, data=data_reg, headers={"Content-Type": "application/json"})
    try:
        res_http = urllib.request.urlopen(req)
        print("✓ API Register HTTP Status:", res_http.getcode())
    except urllib.error.HTTPError as e:
        print("API Register HTTP Response:", e.code, e.read().decode())

    async with AsyncSessionLocal() as db:
        res_users = await db.execute(text("SELECT id, email, full_name, role, password_hash, created_at FROM users WHERE email='pgadmin_verifier@smarthire.ai';"))
        row = res_users.fetchone()
        assert row is not None, "User record not found in PostgreSQL!"
        print("✓ User Record stored in PostgreSQL:")
        print(f"  - UUID Primary Key: {row[0]}")
        print(f"  - Email: {row[1]}")
        print(f"  - Full Name: {row[2]}")
        print(f"  - Role: {row[3]}")
        print(f"  - Bcrypt Password Hash: {row[4][:30]}...")
        print(f"  - Created At: {row[5]}")

    print("\n>>> ALL PGADMIN & POSTGRESQL VERIFICATIONS PASSED 100%! <<<")

if __name__ == "__main__":
    asyncio.run(test_db_pgadmin())
