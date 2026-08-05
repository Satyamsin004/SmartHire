"""Purge ALL data from all PostgreSQL tables using psycopg2 (sync)."""
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="smarthire_db",
    user="postgres",
    password="postgrespassword2026"
)
conn.autocommit = True
cur = conn.cursor()

# Get all table names
cur.execute("""
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
""")
tables = [row[0] for row in cur.fetchall()]

print("Found %d tables in smarthire_db" % len(tables))

# Truncate all tables with CASCADE
for table in tables:
    try:
        cur.execute('TRUNCATE TABLE "%s" CASCADE' % table)
        print("  [OK] Truncated %s" % table)
    except Exception as e:
        print("  [ERR] %s: %s" % (table, e))

cur.close()
conn.close()
print("\nALL DATA PURGED from %d PostgreSQL tables." % len(tables))
