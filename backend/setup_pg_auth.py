import psycopg2

try:
    conn = psycopg2.connect(host="127.0.0.1", port=5433, dbname="postgres", user="postgres")
    conn.autocommit = True
    print("[OK] CONNECTED via TRUST mode on port 5433!")
    cur = conn.cursor()
    
    cur.execute("ALTER USER postgres WITH PASSWORD 'postgrespassword2026';")
    print("[OK] Password set to 'postgrespassword2026'!")
    
    # Create smarthire_db if it doesn't exist
    cur.execute("SELECT 1 FROM pg_database WHERE datname='smarthire_db';")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE smarthire_db;")
        print("[OK] Created database 'smarthire_db'!")
    else:
        print("[OK] Database 'smarthire_db' exists!")
        
    conn.close()
except Exception as e:
    print(f"Error setting up PostgreSQL auth: {e}")
