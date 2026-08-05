import psycopg2

passwords = ["postgrespassword2026", "postgres"]
ports = [5432, 5433]

for port in ports:
    for pwd in passwords:
        try:
            conn = psycopg2.connect(host="127.0.0.1", port=port, dbname="smarthire_db", user="postgres", password=pwd, connect_timeout=3)
            print(f"[OK] CONNECTED SUCCESSFULLY on port {port} with password '{pwd}'!")
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users;")
            print(f"[OK] Table users count: {cur.fetchone()[0]}")
            conn.close()
            break
        except Exception as e:
            print(f"Port {port} with password '{pwd}' failed: {e}")
