-- Lower the index floor from 0.01 to an epsilon of 0.000001 in every
-- database-side enforcer, and teach the invariants sweep the new value.
--
-- WHY
--
-- The 0.01 floor (20260809_min_index_value_floor.sql) was a workaround for
-- sub-cent contracts being bought by the million. It also froze every artist
-- under ~20,000 monthly listeners at a fake price — 13 of 2,570 today, the
-- true values running from 0.0093 down to 0.00005 — flattened their charts,
-- and hid their real moves from PnL: a position there could never lose, and
-- a real gain only registered once the true value crossed a cent.
--
-- The actual hazard is now handled by the $1.00 minimum order value in
-- place_order_tx (20260906_min_order_value.sql — apply that FIRST). What
-- remains is division safety: every percent-change consumer divides by the
-- price and both trade RPCs refuse a non-positive one, so the floor drops to
-- one millionth — the 6-dp resolution every writer already rounds to — rather
-- than to zero.
--
-- WHAT CHANGES
--
--   1. clamp_current_index_value()  — the BEFORE INSERT/UPDATE backstop
--   2. poller_ingest()              — the daily feed's server-side floor
--   3. sonotrade_invariants()       — check 5 threshold; check 8 tolerance
--
-- The other enforcers live outside the database and change in step:
-- sonotrade/index backend/apify_monthly_listeners.py (MIN_INDEX_VALUE),
-- frontend/lib/spotify-listeners.ts, frontend/app/api/artists/refresh,
-- scraper/src/index-math.ts.
--
-- Order matters only for the backfill: 20260906_backfill_floored_artists.sql
-- must run after this file AND after the feed repo change is deployed, or
-- the next daily run re-floors the repaired rows.
--
-- Every other artist is untouched: the floor only ever changed a value that
-- was below it, so for the 2,557 artists above a cent this is a no-op.
--
-- Run in the Supabase SQL editor. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. The trigger backstop. Trigger definitions (trg_zz_clamp_current_index_
--    value_ins/_upd) are unchanged; only the function body moves.
-- ---------------------------------------------------------------------------
create or replace function public.clamp_current_index_value()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_index_value is not null and new.current_index_value < 0.000001 then
    new.current_index_value := 0.000001;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. poller_ingest — the body of 20260809_poller_ingest.sql with the two
--    greatest(..., 0.01) terms lowered. Nothing else changes.
-- ---------------------------------------------------------------------------
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
      current_index_value = greatest(i.index_value, 0.000001),
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
               jsonb_build_object('index', greatest(i.index_value, 0.000001),
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

revoke all on function public.poller_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.poller_ingest(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. sonotrade_invariants — the body of 20260809_accounting_invariants.sql
--    with check 5 lowered to the new floor and check 8's absolute tolerance
--    lowered to match. Nothing else changes.
-- ---------------------------------------------------------------------------
create or replace function public.sonotrade_invariants()
returns table(check_name text, entity text, detail text)
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  -- 1. Cash must equal the ledger's own running balance. place_order_tx and
  --    close_position_tx both stamp balance_after; if users.balance has drifted
  --    from it, something wrote a balance outside the trade RPCs.
  select 'balance_vs_ledger'::text,
         coalesce(u.username, u.id::text)::text,
         ('balance=' || u.balance || ' last_ledger_balance_after=' || l.balance_after)::text
  from public.users u
  join lateral (
    select t.balance_after
    from public.trade_ledger t
    where t.user_id = u.id
    order by t.created_at desc, t.id desc
    limit 1
  ) l on true
  where abs(u.balance - l.balance_after) > 0.005

  union all
  -- 2. An open position's size must equal the signed sum of its ledger rows.
  --    Action vocabulary is open_long/open_short/add_long/add_short (increase)
  --    and close_*/reduce_* (decrease) — read off the live table, not guessed.
  select 'position_qty_vs_ledger',
         p.spotify_id,
         'contracts=' || p.contracts || ' ledger_qty=' || coalesce(x.qty, 0)
  from public.positions p
  left join lateral (
    select sum(case
                 when t.action like 'open%' or t.action like 'add%'    then t.quantity
                 when t.action like 'close%' or t.action like 'reduce%' then -t.quantity
                 else 0
               end) as qty
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.contracts - coalesce(x.qty, 0)) > 0.005

  union all
  -- 3. total_cost is the running sum of cash actually debited — never an
  --    average price multiplied back out. That recomputation is exactly where
  --    the pre-hardening rounding drift came from.
  select 'total_cost_vs_cash_debited',
         p.spotify_id,
         'total_cost=' || p.total_cost || ' cash_out=' || round(-coalesce(x.cash, 0), 2)
  from public.positions p
  left join lateral (
    select sum(t.cash_delta) as cash
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.total_cost + coalesce(x.cash, 0)) > 0.02

  union all
  -- 4. The balance CHECK constraint is NOT VALID on this table, so it is not
  --    enforced for pre-existing rows. Verify rather than assume.
  select 'negative_balance',
         coalesce(u.username, u.id::text),
         'balance=' || u.balance
  from public.users u
  where u.balance < 0

  union all
  -- 5. The index floor (0.000001, an epsilon so no price is ever zero), checked
  --    rather than trusted. Three separate things enforce it (the poller,
  --    poller_ingest, and trg_zz_clamp_*); this is what notices if all three
  --    are bypassed.
  select 'index_below_floor',
         a.spotify_id,
         'current_index_value=' || a.current_index_value
  from public.artists_with_history a
  where a.current_index_value is not null
    and a.current_index_value < 0.000001

  union all
  -- 6. An open position on a market with no usable price cannot be closed:
  --    close_position_tx raises 55000 and the user is stuck holding it.
  select 'open_position_unpriced',
         p.spotify_id,
         'position=' || p.id || ' price=' || coalesce(a.current_index_value::text, 'null')
  from public.positions p
  join public.artists_with_history a on a.spotify_id = p.spotify_id
  where p.status = 'open'
    and (a.current_index_value is null or a.current_index_value <= 0)

  union all
  -- 7. At most one open position per user per artist. A partial unique index
  --    from hardening part 1 is supposed to guarantee this, and close_position_tx
  --    resolves a position by spotify_id on that assumption — so if the index
  --    is not actually live, closes would hit the wrong row.
  select 'duplicate_open_position',
         p.spotify_id,
         'user=' || p.user_id || ' open_rows=' || count(*)
  from public.positions p
  where p.status = 'open'
  group by p.user_id, p.spotify_id
  having count(*) > 1

  union all
  -- 8. The tradeable price and the newest charted point must agree. They are
  --    written by the same statement in poller_ingest, so a divergence means
  --    another writer moved one without the other.
  select 'price_vs_newest_history',
         a.spotify_id,
         'current=' || a.current_index_value || ' newest_point=' || h.index
  from public.artists_with_history a
  join lateral (
    select h2.index
    from public.artist_index_history h2
    where h2.spotify_id = a.spotify_id
    order by h2.ts desc
    limit 1
  ) h on true
  where a.current_index_value is not null
    -- Relative tolerance with an epsilon absolute term: a 0.01 absolute term
    -- would let a sub-cent market drift by many multiples unnoticed.
    and abs(a.current_index_value - h.index) > greatest(0.000001, a.current_index_value * 0.05);
$$;

revoke all on function public.sonotrade_invariants() from public, anon, authenticated;
grant execute on function public.sonotrade_invariants() to service_role;
