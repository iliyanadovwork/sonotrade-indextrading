-- ════════════════════════════════════════════════════════════════════
-- Trigram index for profile name search
-- ════════════════════════════════════════════════════════════════════
--
-- /api/search filters profiles with `name ilike %q%` — a leading
-- wildcard, which can never use a btree index and sequential-scans the
-- table on every keystroke-driven search. A GIN trigram index serves
-- arbitrary-substring ilike directly.
--
-- pg_trgm ships with Supabase. Per Supabase convention it installs into
-- the `extensions` schema, but older projects may carry it in `public`;
-- the DO block resolves the gin_trgm_ops operator class from wherever
-- the extension actually lives so this runs cleanly on both projects.
-- Everything here is idempotent re-run safe.

create extension if not exists pg_trgm with schema extensions;

do $$
declare
  opclass_schema text;
begin
  select n.nspname into opclass_schema
  from pg_opclass oc
  join pg_namespace n on n.oid = oc.opcnamespace
  where oc.opcname = 'gin_trgm_ops'
  limit 1;

  if opclass_schema is null then
    raise exception 'pg_trgm gin_trgm_ops operator class not found after create extension';
  end if;

  execute format(
    'create index if not exists profiles_name_trgm_idx on public.profiles using gin (name %I.gin_trgm_ops)',
    opclass_schema
  );
end $$;
