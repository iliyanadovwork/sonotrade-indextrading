-- CRITICAL. Every SECURITY DEFINER function in this database was executable
-- with the public browser key.
--
-- HOW IT WAS FOUND (2026-08-09)
--
-- Auditing pg_proc.proacl showed almost every function carrying `=X/postgres`
-- as its first ACL entry. An empty grantee is PUBLIC, so PUBLIC held EXECUTE,
-- and anon/authenticated inherit PUBLIC. The existing files all wrote
--
--   revoke all on function ... from anon, authenticated;
--
-- which removes nothing: those roles never held a direct grant, they inherited
-- PUBLIC's. The revoke looked like a lockdown and was a no-op.
--
-- Verified against production with the NEXT_PUBLIC publishable key:
--
--   POST /rest/v1/rpc/place_order_tx
--   {"p_user_id":"00000000-...","p_spotify_id":"__nope__","p_side":"buy","p_quantity":0}
--   -> {"code":"22023","message":"quantity must be greater than zero"}
--
-- That is place_order_tx's OWN validation, not a permission error. The call
-- executed. Since place_order_tx takes p_user_id as a parameter and runs
-- SECURITY DEFINER (so RLS does not apply), anyone holding the key that ships
-- in the browser bundle could move any user's balance by passing their uuid.
-- update_balance(p_user_id, p_amount) was reachable the same way — it was
-- blocked only by PGRST203, the ambiguity between its two overloads.
--
-- WHAT THIS DOES
--
-- Revokes EXECUTE from PUBLIC (and the two inheriting roles) on every function
-- in public that is not owned by an extension, grants it back to service_role,
-- then grants anon/authenticated exactly the four read-only chart RPCs the app
-- actually calls with the anon key. Extension functions are excluded because
-- pg_trgm's operator support is used by anon search paths.
--
-- Run in the Supabase SQL editor. Idempotent.

-- ---------------------------------------------------------------------
-- 1. Close everything.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      -- Extension-owned functions (pg_trgm's operator support, above all) are
      -- left alone: revoking them would break anon trigram search.
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Re-open only what the browser key legitimately needs.
--
--    lib/data.ts and app/api/markets/* call these with the anon key:
--      artist_history          -> chart series for one artist
--      artist_history_batch    -> sparkline series for many
--      _artist_history_points  -> the shared helper both call; NOT security
--                                 definer, so the caller's own EXECUTE is
--                                 checked when the outer function invokes it
--      artist_history_v2       -> the normalized-table reader charts move to
--    All four are STABLE and read-only.
-- ---------------------------------------------------------------------
grant execute on function public.artist_history(text, text) to anon, authenticated;
grant execute on function public.artist_history_batch(text[], text) to anon, authenticated;
grant execute on function public._artist_history_points(jsonb, double precision, text) to anon, authenticated;
grant execute on function public.artist_history_v2(text, text, integer) to anon, authenticated;
-- Added after re-running this file stripped it and broke every chart with
-- "permission denied for function _artist_history_points_v2": the helper was
-- created by 20260809_history_rpcs_read_table.sql AFTER this list was written,
-- so step 1 revoked it and step 2 did not grant it back. Any function the app
-- calls with the anon key must be listed HERE, or this file is a loaded gun.
grant execute on function public._artist_history_points_v2(text[], text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Stop the hole reopening. Without this, the next `create function`
--    inherits the same PUBLIC EXECUTE default and the audit starts over.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 4. Verify. Should return ONLY the four read RPCs above.
--
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and (has_function_privilege('anon', p.oid, 'EXECUTE')
--        or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
--      and not exists (select 1 from pg_depend d
--                       where d.classid = 'pg_proc'::regclass
--                         and d.objid = p.oid and d.deptype = 'e')
--    order by 1;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 5. AMENDMENT (same day, after verification caught it).
--
--    Step 3 was not enough. Supabase ships a DEFAULT ACL on schema public
--    that grants EXECUTE to anon, authenticated and service_role on every
--    newly created function — visible in pg_default_acl for both the postgres
--    and supabase_admin roles:
--
--      postgres | public | postgres=X/postgres | anon=X/postgres
--                          | authenticated=X/postgres | service_role=X/postgres
--
--    So revoking from PUBLIC left the explicit anon/authenticated grants
--    untouched, and the two trigger functions created minutes after the
--    lockdown (clamp_current_index_value, sync_current_index_value) landed
--    anon-executable anyway. Caught by re-running the verification query in
--    step 4, which is the argument for having written it down.
--
--    This is also the real origin of the whole finding: it is not that the old
--    `revoke ... from anon, authenticated` lines were merely no-ops against
--    PUBLIC — the platform actively re-grants those roles on every create.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

do $$
begin
  alter default privileges for role supabase_admin in schema public
    revoke execute on functions from anon, authenticated;
exception when insufficient_privilege then
  raise notice 'could not amend supabase_admin default privileges — functions created by that role will still need an explicit revoke';
end $$;

-- Close the two that already slipped through.
revoke all on function public.clamp_current_index_value() from public, anon, authenticated;
revoke all on function public.sync_current_index_value() from public, anon, authenticated;
revoke all on function public.append_index_history() from public, anon, authenticated;
