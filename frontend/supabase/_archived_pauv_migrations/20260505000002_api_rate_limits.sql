-- =====================================================================
-- Migration 4: API rate-limit token bucket
-- =====================================================================
-- Per-bucket counter for simple per-minute rate limiting on API routes.
-- Bucket key is whatever the caller chooses; for /api/profile-view we use
-- "profile-view:<ip>". The window resets at the top of every minute.
--
-- service_role-only writes; no path for end users to read or modify.
-- The upsert is atomic (ON CONFLICT DO UPDATE), so concurrent calls
-- can't double-spend a token.

create table api_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

alter table api_rate_limits enable row level security;
revoke all on api_rate_limits from anon, authenticated;

-- Atomic increment + check. Returns true if the request is within budget,
-- false if rate-limited.
create or replace function consume_token(p_bucket text, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
  current_window timestamptz := date_trunc('minute', now());
begin
  insert into api_rate_limits (bucket, window_start, count)
  values (p_bucket, current_window, 1)
  on conflict (bucket) do update
    set count = case
                  when api_rate_limits.window_start = current_window
                  then api_rate_limits.count + 1
                  else 1
                end,
        window_start = current_window
  returning count into current_count;
  return current_count <= p_max;
end;
$$;

revoke all on function consume_token(text, int) from public;
grant execute on function consume_token(text, int) to service_role;

-- Optional cleanup: rows older than an hour are no longer being incremented
-- (the upsert resets on window-boundary); they're harmless but accumulate
-- as IPs rotate. Schedule via pg_cron in Sprint 6 hardening:
--
--   SELECT cron.schedule(
--     'rate_limits_sweep_hourly',
--     '0 * * * *',
--     $$DELETE FROM api_rate_limits
--       WHERE window_start < now() - interval '1 hour'$$
--   );
