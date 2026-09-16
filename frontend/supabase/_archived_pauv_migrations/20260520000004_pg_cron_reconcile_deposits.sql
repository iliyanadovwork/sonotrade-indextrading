-- ════════════════════════════════════════════════════════════════════
-- Replace Inngest crons with Supabase pg_cron + pg_net
-- ════════════════════════════════════════════════════════════════════
--
-- Inngest workers are being removed from the codebase. They were never
-- configured in our hosting environment so the crons never fired; the
-- happy-path now runs through `/api/deposits/[id]/check` which calls the
-- `reconcileTreasury` lib synchronously on each user poll.
--
-- This migration provisions two backstop crons via pg_cron:
--
--   1. `reconcile-deposits` (every 5 min) — HTTP POSTs to
--      `/api/cron/reconcile-deposits`, which calls `reconcileTreasury`.
--      Catches deposits where the user closed the modal before credit
--      landed, or where the rate-limited poll missed a window.
--
--   2. `expire-pendings` (every 5 min) — pure SQL inside the database.
--      Marks pending_deposits as `expired` once `expires_at` is past
--      and no signature has been seen. Mirrors the prior
--      `deposit.expire-pendings` Inngest worker, but stays in-DB so it
--      doesn't need the HTTP round-trip.
--
-- Operator setup AFTER this migration is applied — must be done once
-- per project (staging + prod), and the values are NOT committed here:
--
--   alter database postgres set app.reconcile_url
--     = 'https://pauv.com/api/cron/reconcile-deposits';
--   alter database postgres set app.cron_secret
--     = '<long random hex; matches CRON_SECRET in the app env>';
--
-- The cron job reads those at runtime via `current_setting(...)`. If
-- either is unset, the cron's http_post will fail with a clean error
-- (logged but harmless); the system reverts to user-driven polling.

-- ─── 1. Extensions ─────────────────────────────────────────────────
-- pg_cron lives in its own schema and only the postgres superuser can
-- create it; Supabase grants this to project owners by default.
create extension if not exists pg_cron with schema extensions;
-- pg_net provides the http_post(...) function used by the reconcile job.
create extension if not exists pg_net with schema extensions;

-- ─── 2. Schedule the reconcile-deposits cron ───────────────────────
-- cron.schedule() is upsert-by-jobname, so re-running this migration is
-- safe — it just updates the schedule/command in place.
select cron.schedule(
  'reconcile-deposits',
  '*/5 * * * *',
  $cron$
    select extensions.net.http_post(
      url := current_setting('app.reconcile_url', true),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);

-- ─── 3. Schedule the expire-pendings cron ──────────────────────────
-- Pure SQL — no HTTP needed. Mirrors the prior Inngest worker exactly:
-- flip `pending` deposits past their expiry to `expired` when no
-- on-chain signature has bound to them yet.
select cron.schedule(
  'expire-pendings',
  '*/5 * * * *',
  $cron$
    update public.pending_deposits
      set status = 'expired'
      where status = 'pending'
        and signature is null
        and expires_at < now();
  $cron$
);

-- ─── 4. Grants ─────────────────────────────────────────────────────
-- pg_cron jobs run as the user who scheduled them (postgres in
-- migrations). They already have privileges on public.pending_deposits
-- and on extensions.net, so no additional grants needed.

comment on extension pg_cron is
  'pg_cron — schedule periodic jobs from inside Postgres. Replaces Inngest crons (deposit.expire-pendings, deposit.daily-reconciliation, deposit.ingest-poll-cron) with one rolled-up reconcile + the expire sweep.';
comment on extension pg_net is
  'pg_net — async HTTP from Postgres. Used by the reconcile-deposits cron to call /api/cron/reconcile-deposits.';
