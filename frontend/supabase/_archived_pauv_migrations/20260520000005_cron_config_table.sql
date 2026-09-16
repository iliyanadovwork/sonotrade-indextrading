-- ════════════════════════════════════════════════════════════════════
-- Move cron config from `alter database … set` → a private table.
-- ════════════════════════════════════════════════════════════════════
--
-- The prior migration (20260520000004) read the reconcile URL + bearer
-- secret via `current_setting('app.reconcile_url')` and asked the
-- operator to run `alter database postgres set …` to populate them.
-- Supabase's hosted Postgres rejects that statement from the SQL-editor
-- role: `permission denied to set parameter "app.reconcile_url"`. Only
-- the `postgres` superuser (not exposed in hosted Supabase) can alter
-- database-level settings.
--
-- Replace with a simple `private.cron_config` table: two rows (one for
-- the URL, one for the bearer), readable by the pg_cron job, not
-- exposed to PostgREST (the `private` schema isn't in the exposed
-- schemas list). Updating values becomes a normal UPSERT — runnable
-- from the SQL editor without elevated privileges.

-- ─── 1. Private schema + config table ──────────────────────────────
create schema if not exists private;

create table if not exists private.cron_config (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Lock it down. Only the postgres role (which the cron job runs as)
-- can read or write. anon / authenticated / service_role cannot touch
-- it through PostgREST.
revoke all on schema private from public, anon, authenticated;
revoke all on private.cron_config from public, anon, authenticated;
-- service_role retains DDL access by default in Supabase; that's fine
-- — service-role connections are server-side only.

-- ─── 2. Re-schedule the reconcile cron to read from the table ──────
-- cron.schedule() upserts by jobname, so replacing the command in
-- place is a single call.
select cron.schedule(
  'reconcile-deposits',
  '*/5 * * * *',
  $cron$
    select extensions.net.http_post(
      url := (select value from private.cron_config where key = 'reconcile_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'cron_secret'),
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);

-- ─── 3. Note for operators ─────────────────────────────────────────
-- After this migration, run the following ONCE per project (staging +
-- prod), replacing the URL and secret with project-appropriate values:
--
--   insert into private.cron_config (key, value) values
--     ('reconcile_url', 'https://<your-project-domain>/api/cron/reconcile-deposits'),
--     ('cron_secret',   '<long-random-hex>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- The same `<long-random-hex>` value must be set as `CRON_SECRET` in
-- the app's environment (Amplify env + local .env.local). The cron
-- route compares the incoming Bearer token against `CRON_SECRET` using
-- a constant-time compare.

comment on table private.cron_config is
  'Per-project config for pg_cron HTTP-callout jobs. Two required rows: reconcile_url, cron_secret. Not exposed via PostgREST.';
