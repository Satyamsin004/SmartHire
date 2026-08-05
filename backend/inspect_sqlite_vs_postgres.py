import sqlite3
import psycopg2

print("=== 1. CHECKING SQLITE DATABASE (backend/smarthire.db) ===")
try:
    conn_sqlite = sqlite3.connect("smarthire.db")
    cur = conn_sqlite.cursor()
    cur.execute("SELECT count(*) FROM users;")
    sqlite_users_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM candidates;")
    sqlite_cand_count = cur.fetchone()[0]
    print(f"SQLite (backend/smarthire.db) Users Count: {sqlite_users_count}")
    print(f"SQLite (backend/smarthire.db) Candidates Count: {sqlite_cand_count}")
    
    cur.execute("SELECT count(*) FROM users WHERE role='candidate';")
    print(f"SQLite Registered Candidates (role='candidate'): {cur.fetchone()[0]}")
    conn_sqlite.close()
except Exception as e:
    print(f"SQLite check error: {e}")

print("\n=== 2. CHECKING POSTGRESQL DATABASE (port 5433 / smarthire_db) ===")
try:
    conn_pg = psycopg2.connect(host="127.0.0.1", port=5433, dbname="smarthire_db", user="postgres", password="postgrespassword2026")
    cur = conn_pg.cursor()
    cur.execute("SELECT count(*) FROM users;")
    pg_users_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM candidates;")
    pg_cand_count = cur.fetchone()[0]
    print(f"PostgreSQL (smarthire_db) Users Count: {pg_users_count}")
    print(f"PostgreSQL (smarthire_db) Candidates Count: {pg_cand_count}")
    
    cur.execute("SELECT count(*) FROM users WHERE role='candidate';")
    print(f"PostgreSQL Registered Candidates (role='candidate'): {cur.fetchone()[0]}")
    conn_pg.close()
except Exception as e:
    print(f"PostgreSQL check error: {e}")
