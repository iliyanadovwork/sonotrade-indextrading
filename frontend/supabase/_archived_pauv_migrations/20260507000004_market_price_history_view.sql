-- ════════════════════════════════════════════════════════════════════
-- Public market price history view
-- ════════════════════════════════════════════════════════════════════
--
-- The `transactions` table holds per-trade rows that drive both the user's
-- private trade ledger AND the public NPSI chart. RLS gates row reads to
-- `user_id = auth.uid()` so individual users can only see their own trades
-- in raw form. But the price chart on every profile page needs to render
-- the FULL market history regardless of who's looking — anonymous viewers
-- and other traders included.
--
-- Solution: a SECURITY DEFINER-style view that exposes only the price /
-- quantity / timestamp columns (no user_id, no cash amounts, no fees).
-- Postgres views default to running with the view-owner's privileges
-- (security_invoker = false), which lets the view bypass the underlying
-- table's RLS so long as we GRANT SELECT on the view itself.
--
-- The view stays in sync with `transactions` automatically — no triggers
-- needed.

create or replace view public.market_price_history
with (security_invoker = false) as
select
  market_id,
  q_before,
  q_after,
  price_before_cents,
  price_after_cents,
  action,
  created_at
from public.transactions;

comment on view public.market_price_history is
  'Public market price history feed for the NPSI chart. Mirrors transactions but strips user_id and cash columns so it can be read by anyone, bypassing transactions RLS.';

grant select on public.market_price_history to anon, authenticated;
