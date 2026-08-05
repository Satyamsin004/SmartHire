import psycopg2

try:
    conn = psycopg2.connect(host="127.0.0.1", port=5433, dbname="postgres", user="postgres", password="postgrespassword2026")
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    dbs = [r[0] for r in cur.fetchall()]
    print(f"Databases found on PostgreSQL port 5433: {dbs}")
    
    for db in dbs:
        print(f"\n--- Database: {db} ---")
        try:
            conn_db = psycopg2.connect(host="127.0.0.1", port=5433, dbname=db, user="postgres", password="postgrespassword2026")
            cur_db = conn_db.cursor()
            cur_db.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
            tbl_cnt = cur_db.fetchone()[0]
            print(f"Public tables count: {tbl_cnt}")
            
            try:
                cur_db.execute("SELECT count(*) FROM users;")
                u_cnt = cur_db.fetchone()[0]
                print(f"Users table count: {u_cnt}")
            except Exception as e:
                print(f"No users table or error: {e}")
                
            try:
                cur_db.execute("SELECT count(*) FROM candidates;")
                c_cnt = cur_db.fetchone()[0]
                print(f"Candidates table count: {c_cnt}")
            except Exception as e:
                print(f"No candidates table or error: {e}")
                
            conn_db.close()
        except Exception as e:
            print(f"Error connecting to database '{db}': {e}")
            
    conn.close()
except Exception as e:
    print(f"Failed to connect to PostgreSQL port 5433: {e}")
