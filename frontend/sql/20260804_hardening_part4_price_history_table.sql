-- =====================================================================
-- Sonotrade hardening — PART 4 (PHASE 2): move the price series out of the
-- artists_with_history.data_points jsonb array and into a real table.
--
-- THIS IS THE BIGGEST SINGLE PERFORMANCE CHANGE AVAILABLE, and unlike
-- parts 1-3 it is not a drop-in: it changes where price history lives, so
-- apply it deliberately, verify the backfill, and only then switch the
-- reader RPCs over (step 5) and the ingest (step 6).
--
-- WHY
-- data_points is one unbounded jsonb array per artist, appended daily —
-- roughly 76KB and ~1,200 points for a 3-year artist, 73% of the row. It is
-- TOASTed, which makes it pathological in both directions:
--
--   READS: any query that selects the row WITH data_points detoasts and
--   parses the whole array. /api/artist/[id] returned it in full per
--   rendered trade-embed card; the batch-history fallback pulled 200 x 76KB
--   ≈ 15MB in one response; pct_change_since scans the array five times per
--   ingest. Windowed history has to be computed in JS or by expanding
--   jsonb_array_elements over ~238,000 rows per batch call.
--
--   WRITES: appending one ~40-byte point rewrites the entire 76KB value as
--   a new tuple (MVCC). ~2,500 artists/day ≈ 190MB of dead tuples and
--   ~380MB of WAL per day, sustained autovacuum pressure, and TOAST bloat
--   that only grows. Supabase Realtime also ships the full changed row, so
--   every price tick pushes 76KB to every subscriber — and silently drops
--   the event once the row exceeds the 1MB max_record_bytes ceiling.
--
-- AFTER THIS: appends are ~100-byte inserts, windowed reads are index range
-- scans, the artist row stops being rewritten, and realtime payloads on the
-- artist row drop to well under 1KB.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. The history table.
--    Composite primary key doubles as the range-scan index and makes the
--    ingest naturally idempotent per (artist, timestamp).
-- ---------------------------------------------------------------------
create table if not exists public.artist_index_history (
  spotify_id text        not null references public.artists_with_history(spotify_id) on delete cascade,
  ts         timestamptz not null,
  index      numeric     not null check (index >= 0),
  constraint artist_index_history_pkey primary key (spotify_id, ts)
);

-- Descending companion for "latest N points" reads, which is the shape
-- every chart query actually wants.
create index if not exists artist_index_history_spotify_ts_desc_idx
  on public.artist_index_history (spotify_id, ts desc);

-- BRIN is tiny and ideal for the append-only, time-correlated scans used by
-- cross-artist analytics and retention jobs.
create index if not exists artist_index_history_ts_brin_idx
  on public.artist_index_history using brin (ts);

-- RLS must be set HERE, not in the RLS section, because this table is created
-- after that section has already run. Supabase grants default privileges on
-- newly-created public tables to anon and authenticated, so without this the
-- price series every position's P&L derives from would be insertable and
-- updatable with the anon key that ships in the browser bundle.
alter table public.artist_index_history enable row level security;

revoke all on public.artist_index_history from anon, authenticated;
grant select on public.artist_index_history to anon, authenticated;

drop policy if exists artist_index_history_public_read on public.artist_index_history;
create policy artist_index_history_public_read on public.artist_index_history
  for select to anon, authenticated using (true);
-- No INSERT/UPDATE/DELETE policy: writes go through scraper_ingest_v2 under
-- the service role only.


-- ---------------------------------------------------------------------
-- 2. Denormalised current price + change windows on the artist row.
--    current_index_value is currently either a GENERATED column or a
--    DEFAULT expression over data_points depending on which dump you read
--    — verify which with:
--      select column_name, is_generated, generation_expression, column_default
--        from information_schema.columns
--       where table_name = 'artists_with_history'
--         and column_name = 'current_index_value';
--    A DEFAULT would mean the price NEVER updates when data_points is
--    appended, only on INSERT. If it is generated, it must be dropped
--    before it can become a plain writable column (step 6 writes it).
-- ---------------------------------------------------------------------
do $$
declare v_is_generated text;
begin
  select is_generated into v_is_generated
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'artists_with_history'
     and column_name = 'current_index_value';

  if v_is_generated = 'ALWAYS' then
    raise notice 'current_index_value is a GENERATED column. Converting it to a plain column so the ingest can write it directly.';
    alter table public.artists_with_history
      alter column current_index_value drop expression;
  else
    raise notice 'current_index_value is already a plain column (is_generated = %).', coalesce(v_is_generated, 'NO');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. Backfill from the existing jsonb. Idempotent: re-running skips rows
--    already present. Expect this to take a while on a large table.
-- ---------------------------------------------------------------------
insert into public.artist_index_history (spotify_id, ts, index)
select
  a.spotify_id,
  (p->>'timestamp')::timestamptz,
  (p->>'index')::numeric
from public.artists_with_history a
cross join lateral jsonb_array_elements(coalesce(a.data_points, '[]'::jsonb)) as p
where p ? 'timestamp'
  and p ? 'index'
  and (p->>'index') ~ '^[0-9]+(\.[0-9]+)?$'
on conflict (spotify_id, ts) do nothing;

-- Verify before proceeding. These two counts should match closely (small
-- differences are malformed points the WHERE clause above skipped):
--   select count(*) from public.artist_index_history;
--   select sum(jsonb_array_length(coalesce(data_points,'[]'::jsonb)))
--     from public.artists_with_history;


-- ---------------------------------------------------------------------
-- 4. Read API over the new table. Same output contract as the existing
--    artist_history / artist_history_batch RPCs so the routes can switch
--    with no response-shape change. Downsampling stays server-side.
-- ---------------------------------------------------------------------
create or replace function public.artist_history_v2(
  p_spotify_id text,
  p_window     text default 'all',
  p_max_points int  default 240
)
returns table (ts timestamptz, index numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_total int;
  v_stride int;
begin
  v_since := case p_window
    when '1h' then now() - interval '1 hour'
    when '1d' then now() - interval '1 day'
    when '1w' then now() - interval '7 days'
    when '1m' then now() - interval '30 days'
    when '1y' then now() - interval '365 days'
    else '-infinity'::timestamptz
  end;

  select count(*) into v_total
    from public.artist_index_history h
   where h.spotify_id = p_spotify_id and h.ts >= v_since;

  -- Keep every point when the window is already small enough; otherwise
  -- take every Nth so the payload is bounded regardless of history depth.
  v_stride := greatest(1, ceil(v_total::numeric / greatest(p_max_points, 1))::int);

  return query
    with ordered as (
      select h.ts, h.index, row_number() over (order by h.ts) as rn
        from public.artist_index_history h
       where h.spotify_id = p_spotify_id and h.ts >= v_since
    )
    select o.ts, o.index
      from ordered o
     where o.rn % v_stride = 0 or o.rn = v_total
     order by o.ts;
end $$;

grant execute on function public.artist_history_v2(text, text, int) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. Change-window recomputation from the new table.
--    Replaces pct_change_since(), which expanded the jsonb array five
--    times per ingest — so per-write cost grew with total history depth.
-- ---------------------------------------------------------------------
create or replace function public.recompute_artist_changes(p_spotify_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
begin
  select index into v_current
    from public.artist_index_history
   where spotify_id = p_spotify_id
   order by ts desc limit 1;

  if v_current is null then
    return;
  end if;

  update public.artists_with_history a set
    current_index_value = v_current,
    change_1h = public.pct_change_from(p_spotify_id, v_current, interval '1 hour'),
    change_1d = public.pct_change_from(p_spotify_id, v_current, interval '1 day'),
    change_1w = public.pct_change_from(p_spotify_id, v_current, interval '7 days'),
    change_1m = public.pct_change_from(p_spotify_id, v_current, interval '30 days'),
    change_1y = public.pct_change_from(p_spotify_id, v_current, interval '365 days')
  where a.spotify_id = p_spotify_id;
end $$;

create or replace function public.pct_change_from(
  p_spotify_id text,
  p_current    numeric,
  p_interval   interval
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  -- The point at or immediately before the window boundary; one index
  -- lookup instead of a full array scan.
  select case
           when prev.index is null or prev.index = 0 then null
           else round(((p_current - prev.index) / prev.index) * 100, 4)
         end
    from (
      select index
        from public.artist_index_history
       where spotify_id = p_spotify_id
         and ts <= now() - p_interval
       order by ts desc
       limit 1
    ) prev;
$$;


-- ---------------------------------------------------------------------
-- 6. Idempotent ingest against the new table.
--    scraper_ingest did a bare INSERT into artist_daily_streams plus an
--    unconditional `||` append to data_points, so a retried workflow run —
--    or the lazy /api/artists/refresh path — duplicated both. Day-bucketing
--    the key makes a re-run a no-op.
-- ---------------------------------------------------------------------
create or replace function public.scraper_ingest_v2(
  p_spotify_id  text,
  p_index       numeric,
  p_listeners   bigint default null,
  p_ts          timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_index is null or p_index = 'NaN'::numeric or p_index < 0 then
    raise exception 'scraper_ingest_v2: invalid index %', p_index using errcode = '22023';
  end if;

  -- One point per artist per day; a same-day re-run overwrites rather than
  -- appending a duplicate.
  insert into public.artist_index_history (spotify_id, ts, index)
    values (p_spotify_id, date_trunc('day', p_ts), p_index)
    on conflict (spotify_id, ts) do update set index = excluded.index;

  -- ON CONFLICT has to name the same immutable expression the unique index in
  -- part 1 was built on, or Postgres cannot infer the arbiter.
  insert into public.artist_daily_streams (artist_name, index, "timestamp")
    select a.artist_name, p_index, date_trunc('day', p_ts)
      from public.artists_with_history a
     where a.spotify_id = p_spotify_id
  on conflict (artist_name, ((timezone('UTC', "timestamp"))::date)) do update
    set index = excluded.index;

  update public.artists_with_history
     set monthly_listeners = coalesce(p_listeners, monthly_listeners),
         last_updated = greatest(last_updated, p_ts)
   where spotify_id = p_spotify_id;

  perform public.recompute_artist_changes(p_spotify_id);
end $$;

revoke all on function public.scraper_ingest_v2(text, numeric, bigint, timestamptz) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Optional retention. An index that ticks daily needs no more than a
--    few years of full resolution; older points can be thinned to weekly.
--    Enable once you are confident in the backfill.
-- ---------------------------------------------------------------------
create or replace function public.thin_old_index_history(p_older_than interval default interval '2 years')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.artist_index_history h
   where h.ts < now() - p_older_than
     and extract(dow from h.ts) <> 1;   -- keep Mondays
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- select cron.schedule('thin-index-history', '0 4 * * 0',
--   $$select public.thin_old_index_history()$$);


-- ---------------------------------------------------------------------
-- 8. CUTOVER (do NOT run until the application is reading v2)
--    Once /api/markets/* use artist_history_v2 and the scraper uses
--    scraper_ingest_v2, drop the jsonb array. This is the step that
--    actually reclaims the space and stops the row rewrites — until it
--    runs, both representations are maintained and nothing has improved
--    on the write side.
-- ---------------------------------------------------------------------
-- alter table public.artists_with_history drop column data_points;
-- vacuum full analyze public.artists_with_history;

commit;
