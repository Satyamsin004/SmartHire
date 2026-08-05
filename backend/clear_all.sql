DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

SELECT tablename,
       (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
FROM (
    SELECT tablename,
           query_to_xml('SELECT count(*) AS cnt FROM ' || quote_ident(tablename), false, true, '') AS xml_count
    FROM pg_tables WHERE schemaname = 'public'
) t ORDER BY tablename;
