-- Run this on the PostgreSQL LXC as superuser to fix:
--   permission denied for schema public (PostgreSQL 15+)
--
-- 1. Replace "finance" below with the USER from your DATABASE_URL
--    (e.g. postgresql://USER:password@host:5432/DB → USER)
-- 2. Connect to the same database as in DATABASE_URL, then run this file:
--
--    psql -U postgres -d organizador_financeiro -f postgres-grant-public-schema.sql
--
-- Or run the three commands manually (replace finance with your app user).

GRANT USAGE ON SCHEMA public TO finance;
GRANT CREATE ON SCHEMA public TO finance;
ALTER SCHEMA public OWNER TO finance;
