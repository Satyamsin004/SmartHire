import psycopg2

print("=== CHECKING POSTGRESQL 18 DOCKER CONTAINER (PORT 5432) ===")
try:
    conn = psycopg2.connect(host="127.0.0.1", port=5432, dbname="smarthire_db", user="postgres", password="postgrespassword2026")
    cur = conn.cursor()
    cur.execute("SELECT version();")
    print(f"Engine Version: {cur.fetchone()[0]}")
    
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
    tbl_cnt = cur.fetchone()[0]
    print(f"Tables in public schema: {tbl_cnt}")
    conn.close()
except Exception as e:
    print(f"Connection Error: {e}")
