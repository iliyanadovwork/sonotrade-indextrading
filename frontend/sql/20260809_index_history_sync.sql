-- Make artist_index_history track data_points continuously, from the database.
--
-- BACKGROUND — why it fell behind
--
-- 20260804_hardening_part4 created artist_index_history, backfilled it (step
-- 3), and defined scraper_ingest_v2 (step 6) to keep it current. The backfill
-- ran on 2026-08-04. The cutover never did: scraper_ingest_v2 has no callers
-- anywhere. The daily feed (sonotrade/index) PATCHes PostgREST directly and
-- calls no RPC at all; /api/artists/refresh calls scraper_ingest (v1), which
-- writes data_points and artist_daily_streams but not artist_index_history;
-- /api/artists/list inserts data_points inline. So the table sat frozen at the
-- backfill for five days while data_points kept moving — 10,798 points behind
-- across 2,526 artists when this was measured on 2026-08-09.
--
-- The reconciliation before this file ran:
--   667,713 distinct points in data_points
--   656,915 rows in artist_index_history
--         0 rows in history absent from data_points   (strict subset)
--         0 value mismatches on the shared keys
--    10,798 points in data_points absent from history (all 2026-08-04..08)
--
-- So the table was correct, just stale. Nothing needed repairing — only
-- catching up, and then a writer that cannot be forgotten.
--
-- WHY A TRIGGER RATHER THAN FIXING THE POLLER
--
-- There are four writers of data_points across two repositories (the daily
-- Action, scraper_ingest, /api/artists/list, and scraper/). Wiring three of
-- them to also write history leaves the fourth to drift, which is exactly how
-- this happened. The invariant belongs where the data is.
--
-- Run in the Supabase SQL editor. Idempotent; safe to re-run.

-- ---------------------------------------------------------------------
-- 1. Catch up. ON CONFLICT DO NOTHING, so re-running is free and an
--    already-present point is never rewritten.
-- ---------------------------------------------------------------------
insert into public.artist_index_history (spotify_id, ts, index)
select a.spotify_id,
       (dp->>'timestamp')::timestamptz,
       (dp->>'index')::numeric
from public.artists_with_history a,
     lateral jsonb_array_elements(coalesce(a.data_points, '[]'::jsonb)) dp
where dp->>'timestamp' is not null
  and dp->>'index' is not null
  -- Cast guards: every one of the 667,713 live points parses cleanly today,
  -- but _artist_history_points carries the same regexes, which means
  -- malformed entries have been seen before.
  and dp->>'index' ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$'
  and dp->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}'
  and (dp->>'index')::numeric >= 0   -- the table's own CHECK
on conflict (spotify_id, ts) do nothing;


-- ---------------------------------------------------------------------
-- 2. Stay caught up. Mirrors the NEWEST point of data_points into
--    artist_index_history on every write, whoever performs it.
-- ---------------------------------------------------------------------
create or replace function public.append_index_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last jsonb;
begin
  if new.data_points is null
     or jsonb_typeof(new.data_points) <> 'array'
     or jsonb_array_length(new.data_points) = 0 then
    return null;
  end if;

  v_last := new.data_points -> -1;
  if v_last is null or not (v_last ? 'index') or not (v_last ? 'timestamp') then
    return null;
  end if;

  begin
    insert into public.artist_index_history (spotify_id, ts, index)
    values (
      new.spotify_id,
      (v_last ->> 'timestamp')::timestamptz,
      (v_last ->> 'index')::numeric
    )
    on conflict (spotify_id, ts) do update set index = excluded.index;
  exception when others then
    -- A malformed tail point must never fail the artist write. History
    -- falling one point behind is recoverable (step 1 re-run); a poller that
    -- 500s on one bad row is a stalled catalog.
    null;
  end;

  return null;   -- AFTER trigger: return value is ignored
end;
$$;

-- AFTER, not BEFORE: artist_index_history.spotify_id references
-- artists_with_history, so on INSERT the parent row has to exist first.
-- Captures the TAIL point only — correct for every current writer, all of
-- which append exactly one point per run. A writer appending two points in a
-- single statement would drop one; step 3 is what would catch that.
drop trigger if exists trg_append_index_history on public.artists_with_history;
create trigger trg_append_index_history
  after insert or update of data_points on public.artists_with_history
  for each row
  execute function public.append_index_history();


-- ---------------------------------------------------------------------
-- 3. Prove it, continuously. Returns one row per drift class; an empty
--    result is the healthy state. Called by the daily feed, which fails the
--    run on any row — rather than the gap being found five days later by hand.
--
--    Deliberately cheap, and deliberately never touches data_points.
--    Measured 2026-08-09 against production:
--      expanding every point          2,118 ms
--      joining on the tail point      3,239 ms
--      max(ts) on artist_index_history  3,463 ms  (no btree on ts; BRIN
--                                                  cannot answer a max())
--      the two checks below               4 ms
--    PostgREST cancels at its statement timeout, so anything in the seconds
--    range is unusable from the job that most needs to call it.
-- ---------------------------------------------------------------------
create or replace function public.index_history_drift()
returns table(check_name text, detail text, magnitude bigint)
language sql
stable
set search_path = ''
as $$
  -- The trigger's own health: an artist written today whose point never
  -- reached the history table. Index scan on last_updated, ~1 ms.
  select 'points_missing_today'::text,
         'artists updated today with no artist_index_history row for today'::text,
         count(*)::bigint
  from public.artists_with_history a
  where a.last_updated >= date_trunc('day', now())
    and not exists (
      select 1 from public.artist_index_history h
      where h.spotify_id = a.spotify_id
        and h.ts >= date_trunc('day', now())
    )
  having count(*) > 0

  union all
  -- Nothing written anywhere for 36 hours. exists() over the BRIN index, ~3 ms.
  -- The feed failed 7 of the 15 runs before 2026-08-09 (07-28 through 08-02,
  -- and 08-06), writing nothing at all on 08-01 and 08-02, and no one knew.
  -- This is the check that would have said so.
  select 'catalog_stale'::text,
         'no index point written anywhere in the last 36 hours'::text,
         1::bigint
  where not exists (
    select 1 from public.artist_index_history
    where ts >= now() - interval '36 hours'
  );
$$;

revoke all on function public.index_history_drift() from public, anon, authenticated;
grant execute on function public.index_history_drift() to service_role;


-- ---------------------------------------------------------------------
-- 3b. The deep reconciliation — every point, both directions, plus value
--     equality. This is what proved the table was a clean subset before the
--     backfill above. It expands all 667,713 points and takes ~5 s, so run it
--     from the SQL editor when you want the full audit; PostgREST will cancel
--     it. Left granted to postgres only, so it cannot be called over REST by
--     accident.
-- ---------------------------------------------------------------------
create or replace function public.index_history_reconcile()
returns table(check_name text, detail text, magnitude bigint)
language sql
stable
set search_path = ''
as $$
  with j as (
    select a.spotify_id, (dp->>'timestamp')::timestamptz as ts, (dp->>'index')::numeric as idx
    from public.artists_with_history a,
         lateral jsonb_array_elements(coalesce(a.data_points, '[]'::jsonb)) dp
    where dp->>'index' ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$'
      and dp->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}'
  )
  select 'points_missing_from_history', 'in data_points, absent from artist_index_history',
         count(*)::bigint
  from j left join public.artist_index_history h
    on h.spotify_id = j.spotify_id and h.ts = j.ts
  where h.spotify_id is null
  having count(*) > 0

  union all
  select 'history_rows_without_source', 'in artist_index_history, absent from data_points',
         count(*)::bigint
  from public.artist_index_history h
  left join j on j.spotify_id = h.spotify_id and j.ts = h.ts
  where j.spotify_id is null
  having count(*) > 0

  union all
  select 'value_mismatch', 'same (spotify_id, ts), different index',
         count(*)::bigint
  from j join public.artist_index_history h
    on h.spotify_id = j.spotify_id and h.ts = j.ts
  where h.index is distinct from j.idx
  having count(*) > 0;
$$;

revoke all on function public.index_history_reconcile() from public, anon, authenticated;
