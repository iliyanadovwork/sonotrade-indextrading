-- ════════════════════════════════════════════════════════════════════
-- Market overview: per-market price-change windows for discovery grids
-- ════════════════════════════════════════════════════════════════════
--
-- /api/trade and /api/discover previously shipped up to 10,000 `markets`
-- rows + 50,000 `market_price_history` rows + 10,000 `profiles` rows to
-- the SSR Lambda on every cache miss, then computed the 1h/1d/1w/1m
-- %-change windows in JS. This function moves that computation into
-- Postgres: one row per market, with the change windows resolved via
-- four index probes on `transactions_market_created_idx`.
--
-- Semantics are an exact port of the JS pipeline those routes used:
--   - Baseline = the OLDEST price_after_cents inside each window
--     (the old `oldestPriceInWindow()` — rows sorted asc, first per
--     market wins). NOTE: `market_stats()` (profile page) uses
--     last-price-at-or-before-cutoff instead; that discrepancy predates
--     this function and is preserved deliberately for output parity.
--   - No baseline trade inside a window → change = 0 (matches
--     `pctChange()` returning 0 for a missing/zero past price).
--   - Plain join to `profiles`, NO delisted_at filter — the old routes
--     did not filter delisted profiles, and this function must return
--     byte-identical grid contents. (Filtering delisted profiles here
--     is a known follow-up, to be made as a deliberate product change.)
--   - `market_price_history` is an unfiltered view over `transactions`
--     (migration 20260519000002), so reading `transactions` directly is
--     identical data.
--
-- SECURITY DEFINER for the same reason as `market_stats()` (migration
-- 20260513000001): `transactions` is RLS-locked to the trader, and this
-- exposes only viewer-agnostic aggregates — no row-level info, no user
-- identifiers. `set search_path = public, pg_temp` prevents search-path
-- hijacking, matching the existing pattern.

create or replace function public.market_overview()
returns table (
  profile_id uuid,
  ticker citext,
  name text,
  photo_url text,
  industry text,
  info_subcategory text,
  profile_created_at timestamptz,
  latest_price_cents bigint,
  holders_count int,
  total_volume_lifetime_cents bigint,
  change_1h numeric,
  change_1d numeric,
  change_1w numeric,
  change_1m numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    m.profile_id,
    p.ticker,
    p.name,
    p.photo_url,
    p.industry,
    p.info_subcategory,
    p.created_at,
    m.latest_price_cents,
    m.holders_count,
    m.total_volume_lifetime_cents,
    case when w1h.px is null or w1h.px = 0 then 0
         else round((m.latest_price_cents - w1h.px) / w1h.px * 100, 6) end,
    case when w1d.px is null or w1d.px = 0 then 0
         else round((m.latest_price_cents - w1d.px) / w1d.px * 100, 6) end,
    case when w1w.px is null or w1w.px = 0 then 0
         else round((m.latest_price_cents - w1w.px) / w1w.px * 100, 6) end,
    case when w1m.px is null or w1m.px = 0 then 0
         else round((m.latest_price_cents - w1m.px) / w1m.px * 100, 6) end
  from markets m
  join profiles p on p.id = m.profile_id
  left join lateral (
    select t.price_after_cents::numeric as px
    from transactions t
    where t.market_id = m.profile_id
      and t.created_at >= now() - interval '1 hour'
    order by t.created_at asc
    limit 1
  ) w1h on true
  left join lateral (
    select t.price_after_cents::numeric as px
    from transactions t
    where t.market_id = m.profile_id
      and t.created_at >= now() - interval '24 hours'
    order by t.created_at asc
    limit 1
  ) w1d on true
  left join lateral (
    select t.price_after_cents::numeric as px
    from transactions t
    where t.market_id = m.profile_id
      and t.created_at >= now() - interval '7 days'
    order by t.created_at asc
    limit 1
  ) w1w on true
  left join lateral (
    select t.price_after_cents::numeric as px
    from transactions t
    where t.market_id = m.profile_id
      and t.created_at >= now() - interval '30 days'
    order by t.created_at asc
    limit 1
  ) w1m on true;
$$;

comment on function public.market_overview() is
  'One row per market with profile fields + 1h/1d/1w/1m %-change (baseline: oldest price_after_cents inside each window — parity with the old JS pipeline in /api/trade). Powers /api/trade and /api/discover. SECURITY DEFINER bypasses transactions RLS for viewer-agnostic aggregates only.';

grant execute on function public.market_overview() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- Distinct industries for the nav tag menu
-- ════════════════════════════════════════════════════════════════════
--
-- app/layout.tsx previously fetched `profiles?select=industry&limit=10000`
-- (every row) per 5-minute revalidation just to derive the distinct set.
-- No delisted_at filter — the old fetch had none, and the nav must keep
-- byte-identical contents. (Excluding delisted-only industries is a
-- possible follow-up, made deliberately.)

create or replace function public.distinct_profile_industries()
returns table (industry text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.industry
  from profiles p
  where p.industry is not null
  order by 1;
$$;

comment on function public.distinct_profile_industries() is
  'Distinct industries across all profiles (parity with the old unfiltered select). Powers the nav tag menu; replaces a 10,000-row select industry fetch.';

grant execute on function public.distinct_profile_industries() to anon, authenticated;
