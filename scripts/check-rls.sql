-- Gate de CI (seção 5.5 do CLAUDE.md): toda tabela com coluna tenant_id — exceto
-- `tenants`, exceção documentada na seção 6.4 — precisa ter RLS habilitado E
-- forçado (relrowsecurity + relforcerowsecurity). Quebra o build se não tiver.
--
-- Uso: psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f scripts/check-rls.sql

DO $$
DECLARE
  offending RECORD;
  offending_count INT := 0;
BEGIN
  FOR offending IN
    SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> 'tenants'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name = 'tenant_id'
      )
      AND (c.relrowsecurity IS NOT TRUE OR c.relforcerowsecurity IS NOT TRUE)
  LOOP
    RAISE WARNING 'RLS gate FAILED: table "%" has tenant_id but relrowsecurity=% relforcerowsecurity=%',
      offending.table_name, offending.relrowsecurity, offending.relforcerowsecurity;
    offending_count := offending_count + 1;
  END LOOP;

  IF offending_count > 0 THEN
    RAISE EXCEPTION 'RLS gate failed: % table(s) with tenant_id missing RLS/FORCE RLS.', offending_count;
  END IF;

  RAISE NOTICE 'RLS gate passed: all tenant_id tables (except tenants) have RLS enabled and forced.';
END $$;
