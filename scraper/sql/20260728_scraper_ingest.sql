-- Scraper ingest RPC. Apply via the Supabase SQL editor (the live schema is
-- not managed by supabase db push in this project).
--
-- Does the whole daily write for one artist INSIDE the database:
--   1. inserts the raw observation into artist_daily_streams
--   2. appends {timestamp, index} to artists_with_history.data_points
--   3. refreshes current_index_value, monthly_listeners, last_updated
--   4. recomputes change_1h/1d/1w/1m/1y from data_points
--
-- Why an RPC instead of the client doing this: data_points is ~76KB per
-- artist (73% of the row). Reading it out, appending in JS, and writing it
-- back would move ~180MB per run each way. Here it never leaves the server.
--
-- SECURITY: not granted to anon/authenticated — service-role only, which is
-- what the scraper uses. Do NOT add an anon grant (the old scraper's
-- "Allow anon insert" policies were dropped for exactly that reason).

create or replace function public.scraper_ingest(
  p_spotify_id        text,
  p_artist_name       text,
  p_monthly_listeners bigint,
  p_index             numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_pts   jsonb;
begin
  -- 1. raw observation (audit trail + recomputation source)
  insert into artist_daily_streams (artist_name, index, timestamp, created_at)
  values (p_artist_name, p_index, v_now, v_now);

  -- 2. append the new point, keeping the array chronological
  select coalesce(data_points, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('timestamp', v_now, 'index', p_index))
    into v_pts
  from artists_with_history
  where spotify_id = p_spotify_id
  for update;

  if v_pts is null then
    raise exception 'unknown artist %', p_spotify_id;
  end if;

  -- 3 + 4. snapshot columns and the change windows, derived from v_pts.
  -- Each change_* is (now vs the last point at//before the cutoff), in percent.
  -- NB: current_index_value is a GENERATED column —
  --   data_points[last]->>'index'
  -- so appending the point below IS how the price updates. Never assign it
  -- directly (Postgres rejects writes to generated columns, 428C9), and keep
  -- data_points chronological: the LAST element defines the current price.
  update artists_with_history a
  set data_points        = v_pts,
      monthly_listeners   = p_monthly_listeners,
      last_updated        = v_now,
      change_1h = pct_change_since(v_pts, p_index, v_now - interval '1 hour'),
      change_1d = pct_change_since(v_pts, p_index, v_now - interval '1 day'),
      change_1w = pct_change_since(v_pts, p_index, v_now - interval '7 days'),
      change_1m = pct_change_since(v_pts, p_index, v_now - interval '30 days'),
      change_1y = pct_change_since(v_pts, p_index, v_now - interval '365 days')
  where a.spotify_id = p_spotify_id;
end;
$$;

-- Helper: percent change of p_current vs the newest data point at or before
-- p_cutoff. NULL when there is no such point (window predates our history) or
-- the baseline is zero.
create or replace function public.pct_change_since(
  p_points  jsonb,
  p_current numeric,
  p_cutoff  timestamptz
) returns numeric
language sql
immutable
set search_path = public
as $$
  with baseline as (
    select (e->>'index')::numeric as idx
    from jsonb_array_elements(p_points) e
    where (e->>'timestamp')::timestamptz <= p_cutoff
    order by (e->>'timestamp')::timestamptz desc
    limit 1
  )
  select case
    when (select idx from baseline) is null then null
    when (select idx from baseline) = 0     then null
    else round(((p_current - (select idx from baseline)) / (select idx from baseline)) * 100, 6)
  end;
$$;

-- service-role bypasses RLS/grants, but be explicit that the web roles cannot
-- call these.
revoke all on function public.scraper_ingest(text, text, bigint, numeric) from anon, authenticated;
revoke all on function public.pct_change_since(jsonb, numeric, timestamptz) from anon, authenticated;
