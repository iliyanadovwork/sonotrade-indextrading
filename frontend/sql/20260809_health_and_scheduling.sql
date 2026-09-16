-- In-database scheduling and a durable health record.
--
-- Adopted from TappedIn, which runs 11 pg_cron jobs and a daily
-- pipeline_health_alert. The two things worth copying are not the cron
-- entries themselves — it is that (a) the schedule lives next to the data
-- rather than in a GitHub Action nobody watches, and (b) every run leaves a
-- durable record, so "did the feed work on the 6th" is a query rather than an
-- archaeology exercise through Action logs.
--
-- Run in the Supabase SQL editor. Idempotent.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1. A platform calendar day.
--
--    The feed's "one point per artist per day" rule compared UTC dates, and
--    the UTC boundary sits 11 hours after the 13:00 UTC run — so the manual
--    re-run on 2026-08-06 at 23:49 straddled midnight and scattered its
--    writes across two days. A boundary in New York time is ~04:00/05:00 UTC:
--    as far from the scheduled run as it gets, so a slow run cannot cross it.
-- ---------------------------------------------------------------------
create or replace function public.platform_today()
returns date
language sql
stable
set search_path to 'pg_catalog'
as $$ select (now() at time zone 'America/New_York')::date $$;

grant execute on function public.platform_today() to service_role;

-- ---------------------------------------------------------------------
-- 2. Durable health record.
-- ---------------------------------------------------------------------
create table if not exists public.health_events (
  id          bigserial primary key,
  checked_at  timestamptz not null default now(),
  source      text not null,
  check_name  text not null,
  entity      text,
  detail      text,
  severity    text not null default 'warn'
);

create index if not exists idx_health_events_checked_at
  on public.health_events (checked_at desc);

alter table public.health_events enable row level security;
revoke all on public.health_events from public, anon, authenticated;
grant select, insert, delete on public.health_events to service_role;
grant usage, select on sequence public.health_events_id_seq to service_role;

-- ---------------------------------------------------------------------
-- 3. The mass-reprice tripwire.
--
--    A pricing-formula change reprices the catalog in place; that shows up as
--    hundreds of artists moving >=2x on a single day, where an organic day
--    moves none. TappedIn added this after normalising three regime cliffs out
--    of its chart history months later. Cheap here: three days of points.
-- ---------------------------------------------------------------------
create or replace function public.mass_reprice_count()
returns integer
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  with recent as (
    select h.spotify_id, h.ts, h.index,
           lag(h.index) over (partition by h.spotify_id order by h.ts) as prev
    from public.artist_index_history h
    where h.ts >= now() - interval '3 days'
  )
  select count(*)::int
  from recent
  where prev is not null and prev > 0
    and ts >= date_trunc('day', now())
    and (index / prev >= 2 or index / prev <= 0.5);
$$;

grant execute on function public.mass_reprice_count() to service_role;

-- ---------------------------------------------------------------------
-- 4. One sweep, recording everything.
--
--    Returns the number of findings; zero is healthy. Every finding is also
--    written to health_events so a later question about a specific day has an
--    answer.
-- ---------------------------------------------------------------------
create or replace function public.run_health_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_count   integer := 0;
  v_reprice integer;
begin
  -- Feed integrity + staleness.
  insert into public.health_events (source, check_name, entity, detail, severity)
  select 'index_history_drift', d.check_name, null, d.detail, 'critical'
  from public.index_history_drift() d;

  -- Money invariants.
  insert into public.health_events (source, check_name, entity, detail, severity)
  select 'sonotrade_invariants', i.check_name, i.entity, i.detail, 'critical'
  from public.sonotrade_invariants() i;

  -- Catalog-wide repricing.
  v_reprice := public.mass_reprice_count();
  if v_reprice > 25 then
    insert into public.health_events (source, check_name, entity, detail, severity)
    values ('mass_reprice', 'catalog_repriced', null,
            v_reprice || ' artists moved >=2x today — pricing formula change?', 'critical');
  end if;

  select count(*)::int into v_count
  from public.health_events
  where checked_at >= now() - interval '1 minute';

  -- Keep a month. This table must never become the next unbounded jsonb.
  delete from public.health_events where checked_at < now() - interval '30 days';

  return v_count;
end;
$$;

revoke all on function public.run_health_sweep() from public, anon, authenticated;
grant execute on function public.run_health_sweep() to service_role;

-- ---------------------------------------------------------------------
-- 5. Schedule.
--
--    13:45 UTC — 45 minutes after the feed's 13:00 start, which took 38
--    minutes on its last successful run.
-- ---------------------------------------------------------------------
select cron.unschedule('sonotrade_health_sweep')
where exists (select 1 from cron.job where jobname = 'sonotrade_health_sweep');
select cron.schedule('sonotrade_health_sweep', '45 13 * * *',
                     $$select public.run_health_sweep()$$);

--    Idempotency keys expire after 24 h but nothing has ever deleted them.
--    The function has existed since the hardening migration, unscheduled.
select cron.unschedule('sonotrade_purge_idempotency')
where exists (select 1 from cron.job where jobname = 'sonotrade_purge_idempotency');
select cron.schedule('sonotrade_purge_idempotency', '20 3 * * *',
                     $$select public.purge_expired_idempotency_keys()$$);

-- NOT SCHEDULED, deliberately: thin_old_index_history(). It thins points older
-- than two years to weekly — which would delete rows that data_points still
-- contains, and index_history_reconcile() would then report thousands of
-- 'points_missing_from_history' findings every day. Thinning only becomes safe
-- once data_points is no longer the parallel copy. Do not schedule it before
-- then.
