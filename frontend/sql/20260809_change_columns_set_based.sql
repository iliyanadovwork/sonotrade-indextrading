-- Replace the per-write change_* trigger with a set-based recompute.
--
-- WHAT WAS WRONG
--
-- trg_recalculate_changes fired BEFORE UPDATE OF data_points and called
-- compute_change() five times, each walking the jsonb array backwards — up to
-- 1,253 elements — for one comparison point. Five linear scans per row write,
-- 2,526 rows a day.
--
-- The bigger problem was meaning. compute_change evaluated its cutoff against
-- now() AT WRITE TIME, so change_1d meant "the move over the 24 h preceding
-- the last write", not "the move over the last 24 h". A day the feed missed
-- silently widened the window. And because the trigger was BEFORE UPDATE
-- **OF data_points**, a metadata-only pass left all five columns frozen at
-- whatever they were.
--
-- WHAT REPLACES IT
--
-- One set-based recompute over artist_index_history, called once at the end of
-- each feed run. Same columns, same semantics, computed against a single
-- now() for the whole catalog.
--
-- The columns stay. PostgREST sorts on them (/api/trade, /api/discover,
-- change_1m desc and friends), and six indexes exist to support that, so
-- dropping them would mean moving every sorted list route onto an RPC. That is
-- a bigger change than this one and is not required to fix either problem.
--
-- Semantics preserved deliberately: when an artist has no point old enough for
-- a window, the comparison falls back to its EARLIEST point, exactly as
-- compute_change did. Returning null instead (TappedIn's choice — see its
-- price_changes_null_when_unknown migration) is more honest for young markets,
-- but it changes what the UI renders and how nulls sort, so it belongs in its
-- own decision rather than smuggled into a performance fix.
--
-- Run in the Supabase SQL editor. Idempotent.

-- CHUNKED ON PURPOSE. With a bounded id list the planner nest-loops six index
-- lookups per artist: 6.3 ms for 100 artists. Handed the whole catalog it
-- flips to hashing the 656,915-row history table and the same work takes
-- 47,646 ms — measured both ways on 2026-08-09. The chunk size keeps it on the
-- fast plan, and also keeps every call inside PostgREST's statement timeout so
-- the feed can invoke it per batch.
create or replace function public.recompute_change_columns(p_spotify_ids text[] default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_now   timestamptz := now();
  v_ids   text[];
  v_chunk text[];
  v_total integer := 0;
  v_n     integer;
  v_i     integer;
begin
  if p_spotify_ids is null then
    select array_agg(a.spotify_id) into v_ids from public.artists_with_history a;
  else
    v_ids := p_spotify_ids;
  end if;

  for v_i in 1 .. coalesce(array_length(v_ids, 1), 0) by 200 loop
  v_chunk := v_ids[v_i : v_i + 199];

  with calc as (
    select
      a.spotify_id,
      a.current_index_value::numeric as cur,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id
        order by h.ts asc limit 1) as first_index,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '1 hour'
        order by h.ts desc limit 1) as p_1h,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '1 day'
        order by h.ts desc limit 1) as p_1d,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '7 days'
        order by h.ts desc limit 1) as p_1w,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '30 days'
        order by h.ts desc limit 1) as p_1m,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '365 days'
        order by h.ts desc limit 1) as p_1y
    from public.artists_with_history a
    where a.spotify_id = any(v_chunk)
      and a.current_index_value is not null
  ),
  pct as (
    select
      c.spotify_id,
      case when coalesce(c.p_1h, c.first_index) is null or coalesce(c.p_1h, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1h, c.first_index)) / coalesce(c.p_1h, c.first_index)) * 100 end as ch_1h,
      case when coalesce(c.p_1d, c.first_index) is null or coalesce(c.p_1d, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1d, c.first_index)) / coalesce(c.p_1d, c.first_index)) * 100 end as ch_1d,
      case when coalesce(c.p_1w, c.first_index) is null or coalesce(c.p_1w, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1w, c.first_index)) / coalesce(c.p_1w, c.first_index)) * 100 end as ch_1w,
      case when coalesce(c.p_1m, c.first_index) is null or coalesce(c.p_1m, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1m, c.first_index)) / coalesce(c.p_1m, c.first_index)) * 100 end as ch_1m,
      case when coalesce(c.p_1y, c.first_index) is null or coalesce(c.p_1y, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1y, c.first_index)) / coalesce(c.p_1y, c.first_index)) * 100 end as ch_1y
    from calc c
  ),
  upd as (
    update public.artists_with_history a
    set change_1h = p.ch_1h,
        change_1d = p.ch_1d,
        change_1w = p.ch_1w,
        change_1m = p.ch_1m,
        change_1y = p.ch_1y
    from pct p
    where a.spotify_id = p.spotify_id
      -- Only touch rows whose numbers actually moved. Six indexes cover these
      -- columns; rewriting all 2,526 rows daily to change none of them is the
      -- churn this file exists to remove.
      and (a.change_1h, a.change_1d, a.change_1w, a.change_1m, a.change_1y)
          is distinct from (p.ch_1h, p.ch_1d, p.ch_1w, p.ch_1m, p.ch_1y)
    returning 1
  )
  select count(*)::int into v_n from upd;

  v_total := v_total + coalesce(v_n, 0);
  end loop;

  return v_total;
end;
$$;

revoke all on function public.recompute_change_columns(text[]) from public, anon, authenticated;
grant execute on function public.recompute_change_columns(text[]) to service_role;

-- ---------------------------------------------------------------------
-- Retire the per-write trigger. compute_change() and
-- recalculate_change_columns() are left in place but are now dead — nothing
-- references them once this trigger is gone.
-- ---------------------------------------------------------------------
drop trigger if exists trg_recalculate_changes on public.artists_with_history;
