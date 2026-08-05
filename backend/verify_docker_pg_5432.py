import psycopg2

print("=== CHECKING DOCKER POSTGRESQL INSTANCE ON PORT 5432 (smarthire_postgres) ===")
try:
    conn_5432 = psycopg2.connect(host="127.0.0.1", port=5432, dbname="smarthire_db", user="postgres", password="postgrespassword2026")
    cur = conn_5432.cursor()
    cur.execute("SELECT version();")
    print(f"Engine Version: {cur.fetchone()[0]}")
    
    cur.execute("SELECT count(*) FROM users;")
    u_cnt = cur.fetchone()[0]
    print(f"Docker PostgreSQL (Port 5432) Total Users Count: {u_cnt}")
    
    cur.execute("SELECT count(*) FROM users WHERE role='candidate';")
    cand_users_cnt = cur.fetchone()[0]
    print(f"Docker PostgreSQL (Port 5432) Registered Candidates Count (role='candidate'): {cand_users_cnt}")
    
    cur.execute("SELECT count(*) FROM candidates;")
    cand_tbl_cnt = cur.fetchone()[0]
    print(f"Docker PostgreSQL (Port 5432) Candidates Table Rows: {cand_tbl_cnt}")
    
    conn_5432.close()
except Exception as e:
    print(f"Docker PostgreSQL (Port 5432) Error: {e}")

print("\n=== CHECKING WINDOWS HOST POSTGRESQL INSTANCE ON PORT 5433 (postgresql-x64-18) ===")
try:
    conn_5433 = psycopg2.connect(host="127.0.0.1", port=5433, dbname="smarthire_db", user="postgres", password="postgrespassword2026")
    cur = conn_5433.cursor()
    cur.execute("SELECT version();")
    print(f"Engine Version: {cur.fetchone()[0]}")
    
    cur.execute("SELECT count(*) FROM users;")
    u_cnt = cur.fetchone()[0]
    print(f"Windows Host PostgreSQL (Port 5433) Total Users Count: {u_cnt}")
    
    cur.execute("SELECT count(*) FROM users WHERE role='candidate';")
    cand_users_cnt = cur.fetchone()[0]
    print(f"Windows Host PostgreSQL (Port 5433) Registered Candidates Count (role='candidate'): {cand_users_cnt}")
    
    cur.execute("SELECT count(*) FROM candidates;")
    cand_tbl_cnt = cur.fetchone()[0]
    print(f"Windows Host PostgreSQL (Port 5433) Candidates Table Rows: {cand_tbl_cnt}")
    
    conn_5433.close()
except Exception as e:
    print(f"Windows Host PostgreSQL (Port 5433) Error: {e}")
