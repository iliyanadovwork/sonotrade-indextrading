-- ════════════════════════════════════════════════════════════════════
-- Batched 24h volume lookup for grid pages
-- ════════════════════════════════════════════════════════════════════
--
-- The existing `market_stats(uuid)` function (migration 20260513000001)
-- returns full per-market stats for one market at a time and is used by
-- the per-profile page via `useLiveMarketStats`. Grid pages (Trending,
-- industry tags, search results) render up to 50 cards per page and
-- need volume_24h on each card.
--
-- Calling `market_stats` 50× in parallel costs 50 round-trips. This
-- batched RPC returns `(market_id, volume_24h_microusdc)` rows for an
-- array of market_ids in a single round-trip.
--
-- Why SECURITY DEFINER: `transactions` is RLS-locked to the trader.
-- This function aggregates only viewer-agnostic sums (no user_id, no
-- cash flow per row) and is the same defensive shape as `market_stats`.

create or replace function public.markets_volume_24h_batch(p_market_ids uuid[])
returns table (
  market_id uuid,
  volume_24h_microusdc bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.market_id,
    coalesce(sum(t.cash_amount_microusdc), 0)::bigint as volume_24h_microusdc
  from transactions t
  where t.market_id = any(p_market_ids)
    and t.created_at > now() - interval '24 hours'
  group by t.market_id;
$$;

comment on function public.markets_volume_24h_batch(uuid[]) is
  'Batched 24h volume aggregation for grid pages. Returns one row per market_id that has trades in the last 24h; market_ids with zero recent volume are absent from the result (caller defaults to 0). SECURITY DEFINER bypasses transactions RLS to expose viewer-agnostic sums only.';

grant execute on function public.markets_volume_24h_batch(uuid[]) to anon, authenticated;
