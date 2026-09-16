-- Leaderboard P&L must match what each trader's profile shows: realized
-- (stored on closed/liquidated positions) PLUS live unrealized on open
-- positions. The previous view surfaced users.total_pnl, which the trade RPCs
-- only increment at close — so every trader holding open positions showed
-- $0.00 on the leaderboard while their profile (which computes unrealized
-- client-side) showed real numbers.
--
-- Unrealized uses the same formula as /api/portfolio:
--   long:  (current - entry) * contracts
--   short: (entry - current) * contracts
-- with `current` = artists_with_history.current_index_value, which the
-- 20260805_sync_current_index_value trigger keeps pinned to the newest data
-- point.
--
-- Run in the Supabase SQL editor AFTER 20260805_sync_current_index_value.sql.
-- Idempotent.

drop view if exists public.user_leaderboard;

create view public.user_leaderboard
with (security_invoker = true)
as
select
  u.id,
  u.username,
  u.avatar_url,
  -- ::numeric before round(): current_index_value is double precision, and
  -- two-argument round() only exists for numeric.
  round(
    coalesce(sum(
      case
        when p.status = 'open' and p.position_type = 'long'
          then (coalesce(a.current_index_value, p.entry_price) - p.entry_price) * p.contracts
        when p.status = 'open' and p.position_type = 'short'
          then (p.entry_price - coalesce(a.current_index_value, p.entry_price)) * p.contracts
        -- closed / liquidated rows store their final realized pnl
        else coalesce(p.unrealized_pnl, 0)
      end
    ), 0)::numeric
  , 2) as total_pnl,
  coalesce(u.total_volume, 0) as total_volume,
  count(p.id) filter (where p.status in ('closed', 'liquidated')) as total_trades,
  count(p.id) filter (where p.status = 'open')                    as open_positions,
  count(p.id) filter (
    where p.status in ('closed', 'liquidated') and coalesce(p.unrealized_pnl, 0) > 0
  ) as winning_trades
from public.users u
left join public.positions p
  on p.user_id = u.id
left join public.artists_with_history a
  on a.spotify_id = p.spotify_id and p.status = 'open'
group by u.id, u.username, u.avatar_url, u.total_volume;

-- security_invoker: the only consumer is /api/leaderboard via the service
-- role, which bypasses RLS. Nothing is granted to anon/authenticated (the
-- 2026-08-04 hardening revoked defaults), so the view exposes nothing new.
