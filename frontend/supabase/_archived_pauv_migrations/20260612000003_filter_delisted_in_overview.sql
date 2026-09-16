-- ════════════════════════════════════════════════════════════════════
-- Exclude delisted profiles from discovery grids + nav
-- ════════════════════════════════════════════════════════════════════
--
-- Bug: `market_overview()` (migration 20260612000001) joins `profiles`
-- WITHOUT a `delisted_at` filter, so delisted profiles kept appearing in
-- the Trending / Forecast / Discover lists (which read this RPC) even
-- though the profile PAGE (`/profile/[ticker]` → lib/data.ts, which DOES
-- filter `delisted_at is null`) 404s on click. Result: a delisted ticker
-- shows in the grid but dead-ends on a 404.
--
-- The original RPC left the filter out deliberately for byte-identical
-- output parity with the pre-RPC routes (which also didn't filter). That
-- parity goal is now satisfied, and hiding delisted profiles from
-- discovery is the intended product behaviour (PRD §6.3 Delist — a
-- delisted profile is removed from listings). This migration is the
-- "deliberate product change" the 20260612000001 comments flagged as the
-- follow-up.
--
-- `delisted_at` lives on `profiles`; the market row still exists, so the
-- filter belongs on the profile join. Additive + reversible (re-running
-- 20260612000001 restores the unfiltered behaviour). No schema change.

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
  ) w1m on true
  where p.delisted_at is null;   -- ← exclude delisted profiles from grids
$$;

comment on function public.market_overview() is
  'One row per ACTIVE (non-delisted) market with profile fields + 1h/1d/1w/1m %-change (baseline: oldest price_after_cents inside each window). Powers /api/trade and /api/discover. SECURITY DEFINER bypasses transactions RLS for viewer-agnostic aggregates only. Delisted profiles excluded as of 20260612000003.';

grant execute on function public.market_overview() to anon, authenticated;

-- Same fix for the nav tag menu: a delisted-only industry should not
-- linger in the menu (clicking it would show an empty grid now that
-- market_overview filters delisted).
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
    and p.delisted_at is null
  order by 1;
$$;

comment on function public.distinct_profile_industries() is
  'Distinct industries across ACTIVE (non-delisted) profiles. Powers the nav tag menu. Delisted profiles excluded as of 20260612000003.';

grant execute on function public.distinct_profile_industries() to anon, authenticated;
