-- Batch ingest for the daily feed (sonotrade/index), replacing ~2,500
-- per-artist PostgREST PATCHes with ~26 calls.
--
-- WHY
--
-- The poller's read is the slowest query in this database: 2,296 ms mean over
-- 342 calls, measured 2026-08-09 in pg_stat_statements. It is literally
--
--   select artist_name, spotify_id, data_points
--     from artists_with_history
--    order by current_index_value desc nulls last
--    limit ... offset ...
--
-- because appending a point in Python requires shipping every artist's entire
-- data_points array out and back. Appending in SQL removes that read entirely.
--
-- The writes were equally wasteful: one PATCH per artist carrying every
-- column, changed or not (139,750 UPDATE statements at 10.2 ms mean). Postgres
-- cannot tell an identical jsonb value from a new one, so each was a fresh
-- heap tuple, a fresh TOAST chain and eleven index entries.
--
-- WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT
--
-- Freshness is untouched: the feed still sends the whole payload for every
-- artist every day. The difference is that metadata is only WRITTEN when it
-- actually differs, which is invisible to every reader and removes the churn.
--
-- Two behaviour fixes ride along:
--   * A field absent from the Apify response no longer nulls the stored value.
--     build_update_body sent `item.get(...)` for every key, so one partial
--     response wiped biographies and galleries.
--   * current_index_value is floored at 0.01 here, server-side, so the floor
--     holds for any caller — not only the Python that happens to remember it.
--
-- data_points is still written, because artist_history() (the live chart RPC)
-- still reads it. artist_index_history stays in sync through
-- trg_append_index_history from 20260809_index_history_sync.sql. Once the app
-- reads artist_history_v2, the data_points write here can go.
--
-- Run in the Supabase SQL editor. Idempotent.

create or replace function public.poller_ingest(p_items jsonb)
returns table(hot_updated integer, cold_updated integer, priced_today integer)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_now   timestamptz := now();
  -- Platform calendar day, not the UTC one. The 2026-08-06 re-run started at
  -- 23:49 UTC and ran 35 minutes, so its writes landed on both sides of the
  -- UTC midnight — 703 points dated the 6th and the rest the 7th. The New York
  -- boundary is ~04:00 UTC, furthest from the 13:00 run. See platform_today()
  -- in 20260809_health_and_scheduling.sql.
  v_day   date := public.platform_today();
  v_hot   integer := 0;
  v_cold  integer := 0;
  v_today integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22023';
  end if;

  -- ---- hot path: price, listeners, and today's data point ----------------
  -- One point per artist per UTC day. A second run on the same day refreshes
  -- metadata and leaves the point alone — the rule the Python already applied,
  -- moved here so it holds regardless of caller.
  with input as (
    select distinct on (x.spotify_id) x.spotify_id, x.index_value,
           x.monthly_listeners, x.followers
    from jsonb_to_recordset(p_items) as x(
      spotify_id text, index_value numeric,
      monthly_listeners bigint, followers bigint
    )
    where x.spotify_id is not null and x.index_value is not null
    order by x.spotify_id
  ),
  upd as (
    update public.artists_with_history a
    set
      current_index_value = greatest(i.index_value, 0.01),
      monthly_listeners   = coalesce(i.monthly_listeners, a.monthly_listeners),
      followers           = coalesce(i.followers, a.followers),
      last_updated        = v_now,
      data_points = case
        when jsonb_typeof(a.data_points) = 'array'
         and jsonb_array_length(a.data_points) > 0
         and (((a.data_points -> -1 ->> 'timestamp')::timestamptz
                 at time zone 'America/New_York')::date = v_day)
        then a.data_points
        else coalesce(a.data_points, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object('index', greatest(i.index_value, 0.01),
                                  'timestamp', v_now))
      end
    from input i
    where a.spotify_id = i.spotify_id
    returning 1
  )
  select count(*)::int into v_hot from upd;

  -- ---- cold path: metadata, written only where it differs ---------------
  -- coalesce(new, old) on every column: a field missing from the response
  -- means "Apify did not report it", never "delete what we have".
  with input as (
    select distinct on (x.spotify_id) x.*
    from jsonb_to_recordset(p_items) as x(
      spotify_id text,
      spotify_img text, verified boolean, header_image text, biography text,
      facebook text, instagram text, twitter text, tiktok text,
      wikipedia text, other text,
      gallery jsonb, top_cities jsonb, related jsonb, releases jsonb,
      top_tracks jsonb, discovered_on jsonb, appears_on jsonb, events jsonb
    )
    where x.spotify_id is not null
    order by x.spotify_id
  ),
  upd as (
    update public.artists_with_history a
    set
      spotify_img   = coalesce(i.spotify_img,   a.spotify_img),
      verified      = coalesce(i.verified,      a.verified),
      header_image  = coalesce(i.header_image,  a.header_image),
      biography     = coalesce(i.biography,     a.biography),
      facebook      = coalesce(i.facebook,      a.facebook),
      instagram     = coalesce(i.instagram,     a.instagram),
      twitter       = coalesce(i.twitter,       a.twitter),
      tiktok        = coalesce(i.tiktok,        a.tiktok),
      wikipedia     = coalesce(i.wikipedia,     a.wikipedia),
      other         = coalesce(i.other,         a.other),
      gallery       = coalesce(i.gallery,       a.gallery),
      top_cities    = coalesce(i.top_cities,    a.top_cities),
      related       = coalesce(i.related,       a.related),
      releases      = coalesce(i.releases,      a.releases),
      top_tracks    = coalesce(i.top_tracks,    a.top_tracks),
      discovered_on = coalesce(i.discovered_on, a.discovered_on),
      appears_on    = coalesce(i.appears_on,    a.appears_on),
      events        = coalesce(i.events,        a.events)
    from input i
    where a.spotify_id = i.spotify_id
      and (
        coalesce(i.spotify_img,   a.spotify_img),
        coalesce(i.verified,      a.verified),
        coalesce(i.header_image,  a.header_image),
        coalesce(i.biography,     a.biography),
        coalesce(i.facebook,      a.facebook),
        coalesce(i.instagram,     a.instagram),
        coalesce(i.twitter,       a.twitter),
        coalesce(i.tiktok,        a.tiktok),
        coalesce(i.wikipedia,     a.wikipedia),
        coalesce(i.other,         a.other),
        coalesce(i.gallery,       a.gallery),
        coalesce(i.top_cities,    a.top_cities),
        coalesce(i.related,       a.related),
        coalesce(i.releases,      a.releases),
        coalesce(i.top_tracks,    a.top_tracks),
        coalesce(i.discovered_on, a.discovered_on),
        coalesce(i.appears_on,    a.appears_on),
        coalesce(i.events,        a.events)
      ) is distinct from (
        a.spotify_img, a.verified, a.header_image, a.biography,
        a.facebook, a.instagram, a.twitter, a.tiktok, a.wikipedia, a.other,
        a.gallery, a.top_cities, a.related, a.releases, a.top_tracks,
        a.discovered_on, a.appears_on, a.events
      )
    returning 1
  )
  select count(*)::int into v_cold from upd;

  -- How many of the artists in this batch now carry a point dated today.
  -- Reported so the caller can gate on coverage rather than on HTTP 200.
  select count(*)::int into v_today
  from public.artists_with_history a
  where a.spotify_id in (
          select value ->> 'spotify_id' from jsonb_array_elements(p_items)
        )
    and jsonb_typeof(a.data_points) = 'array'
    and jsonb_array_length(a.data_points) > 0
    and (((a.data_points -> -1 ->> 'timestamp')::timestamptz
            at time zone 'America/New_York')::date = v_day);

  return query select v_hot, v_cold, v_today;
end;
$$;

-- PUBLIC holds EXECUTE on every new function by default, and anon/authenticated
-- inherit it — revoking from those roles alone leaves the grant intact. Revoke
-- from PUBLIC first, then grant back only to the role the feed uses.
revoke all on function public.poller_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.poller_ingest(jsonb) to service_role;
