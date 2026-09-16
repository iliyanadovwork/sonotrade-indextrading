-- ════════════════════════════════════════════════════════════════════
-- Public market stats: live counters + change windows
-- ════════════════════════════════════════════════════════════════════
--
-- Profile pages need to show, for ANY viewer (anonymous or signed-in):
--   - Total open forecasts (count of open positions)
--   - Holders (distinct users with an open position)
--   - 24h volume in USDC (sum of cash flowing through every open + close
--     + liquidation in the window — definition (A) per product)
--   - Lifetime volume in USDC (same sum, no window)
--   - 1h / 24h / 7d NPSI change percentages
--
-- The `transactions` table is RLS-locked to the trader (`user_id =
-- auth.uid()`), so a viewer cannot aggregate it from the client. A
-- SECURITY DEFINER function exposes only the aggregates — no row-level
-- info, no user identifiers — and is granted to anon + authenticated.
--
-- Why a function instead of denormalized columns on `markets`:
--   - Single source of truth (the underlying tables). No drift between
--     stored counters and reality if a backfill or admin SQL touches
--     positions/transactions outside the engine adapter.
--   - One call, all stats — saves N round-trips.
--   - Indexed lookups: `transactions_market_created_idx` already exists;
--     positions queries are filtered by `market_id` (PK on profile_id).
--
-- This function is `stable security definer` with an explicit
-- search_path so it can't be search-path-hijacked. `set search_path =
-- public, pg_temp` matches the pattern used by `record_profile_view`
-- in migration 20260505000001.

create or replace function public.market_stats(p_market_id uuid)
returns table (
  total_open_positions int,
  holders int,
  volume_24h_microusdc bigint,
  volume_lifetime_microusdc bigint,
  change_1h_pct numeric,
  change_24h_pct numeric,
  change_7d_pct numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with
    open_pos as (
      select
        count(*)::int                  as cnt,
        count(distinct user_id)::int   as holders_cnt
      from positions
      where market_id = p_market_id
        and status   = 'open'
    ),
    vol_24h as (
      select coalesce(sum(cash_amount_microusdc), 0)::bigint as v
      from transactions
      where market_id = p_market_id
        and created_at > now() - interval '24 hours'
    ),
    vol_total as (
      select coalesce(sum(cash_amount_microusdc), 0)::bigint as v
      from transactions
      where market_id = p_market_id
    ),
    cur as (
      select latest_price_cents::numeric as p
      from markets
      where profile_id = p_market_id
    ),
    -- Last price tick AT OR BEFORE the window cutoff. NULL if the market
    -- has no trades yet that old (fresh markets); change% then defaults
    -- to 0% per product spec.
    px as (
      select
        (
          select price_after_cents::numeric
          from transactions
          where market_id = p_market_id
            and created_at <= now() - interval '1 hour'
          order by created_at desc
          limit 1
        ) as p_1h,
        (
          select price_after_cents::numeric
          from transactions
          where market_id = p_market_id
            and created_at <= now() - interval '24 hours'
          order by created_at desc
          limit 1
        ) as p_24h,
        (
          select price_after_cents::numeric
          from transactions
          where market_id = p_market_id
            and created_at <= now() - interval '7 days'
          order by created_at desc
          limit 1
        ) as p_7d
    )
  select
    coalesce(open_pos.cnt, 0),
    coalesce(open_pos.holders_cnt, 0),
    vol_24h.v,
    vol_total.v,
    case when px.p_1h is null  or px.p_1h  = 0 then 0
         else round((cur.p - px.p_1h)  / px.p_1h  * 100, 2) end,
    case when px.p_24h is null or px.p_24h = 0 then 0
         else round((cur.p - px.p_24h) / px.p_24h * 100, 2) end,
    case when px.p_7d is null  or px.p_7d  = 0 then 0
         else round((cur.p - px.p_7d)  / px.p_7d  * 100, 2) end
  from open_pos, vol_24h, vol_total, cur, px;
$$;

comment on function public.market_stats(uuid) is
  'Aggregated public market stats for the profile page. SECURITY DEFINER bypasses transactions RLS to expose viewer-agnostic counters and price-change windows. Returns one row per call.';

grant execute on function public.market_stats(uuid) to anon, authenticated;

-- ─── Backfill denormalized counters on `markets` ─────────────────────
--
-- The engine adapter maintains `markets.holders_count` and
-- `markets.total_volume_lifetime_cents` on every trade going forward.
-- Existing markets that traded before this migration may have stale
-- defaults (0). Recompute from source-of-truth tables now.
update markets m
set
  holders_count = coalesce(
    (
      select count(distinct user_id)::int
      from positions
      where market_id = m.profile_id and status = 'open'
    ), 0
  ),
  total_volume_lifetime_cents = coalesce(
    (
      select sum(cash_amount_microusdc)::bigint / 10000
      from transactions
      where market_id = m.profile_id
    ), 0
  );
