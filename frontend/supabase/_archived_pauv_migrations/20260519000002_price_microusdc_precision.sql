-- ════════════════════════════════════════════════════════════════════
-- 6-decimal price precision for the NPSI chart.
-- ════════════════════════════════════════════════════════════════════
--
-- Why: prices were stored as integer cents (`price_*_cents`,
-- `latest_price_cents`), so any sub-cent move from a bonding-curve
-- trade rounded to the same cent on both sides and the chart rendered
-- a flat line. This migration adds `*_microusdc` columns (matching the
-- precision we already use for balances) so the chart can plot
-- sub-cent moves without losing fidelity.
--
-- Production-safety profile:
--   - Strictly additive. Existing `*_cents` columns and constraints
--     stay untouched. Anything reading them continues to work.
--   - New columns are NULLABLE for now. A future migration can promote
--     them to NOT NULL once we're sure every writer is upgraded.
--   - A BEFORE-INSERT/UPDATE trigger auto-derives `*_microusdc` from
--     `*_cents` when the writer doesn't supply it (× 10_000). This
--     means admin RPCs, the engine adapter, and any other writer
--     produce valid microusdc rows even before they're upgraded.
--   - Historical rows are backfilled in this same migration (cents
--     × 10_000). Lossy in theory — original sub-cent precision was
--     never captured — but no information is destroyed; the historical
--     data already lived at cent precision.
--   - Single transaction. If any step fails, none commit.
--
-- Deploy order: this migration first, application code that writes
-- the higher-precision values second. Between the two, the trigger
-- ensures every row gets a sensible microusdc value derived from the
-- cents the existing code already writes.

-- ─── 1. transactions: add columns + check constraints ─────────────────
alter table public.transactions
  add column price_before_microusdc bigint
    check (price_before_microusdc is null or price_before_microusdc >= 0);
alter table public.transactions
  add column price_after_microusdc bigint
    check (price_after_microusdc is null or price_after_microusdc >= 0);

-- ─── 2. markets: add column + check constraint ────────────────────────
alter table public.markets
  add column latest_price_microusdc bigint
    check (latest_price_microusdc is null or latest_price_microusdc >= 0);

-- ─── 3. Backfill from existing cent values ────────────────────────────
-- 1¢ = 10_000 µUSDC. Both source columns are NOT NULL on existing rows,
-- so the result of the multiplication is always a valid value.
update public.transactions
set price_before_microusdc = price_before_cents * 10000,
    price_after_microusdc = price_after_cents * 10000
where price_before_microusdc is null
   or price_after_microusdc is null;

update public.markets
set latest_price_microusdc = latest_price_cents * 10000
where latest_price_microusdc is null;

-- ─── 4. Sync trigger — derives microusdc from cents on write ──────────
-- Fires BEFORE INSERT / UPDATE OF latest_price_cents on markets, and
-- BEFORE INSERT on transactions. Only fills in microusdc when the
-- caller didn't supply it, so writers that DO supply higher-precision
-- microusdc (the engine adapter, post-upgrade) are not clobbered.
--
-- One small function reused by two triggers — keeps the derivation
-- rule in exactly one place so changing it later is one edit.

create or replace function public.sync_market_price_microusdc()
returns trigger
language plpgsql
as $$
begin
  if new.latest_price_microusdc is null
     and new.latest_price_cents is not null then
    new.latest_price_microusdc := new.latest_price_cents * 10000;
  end if;
  return new;
end;
$$;

create or replace function public.sync_transaction_price_microusdc()
returns trigger
language plpgsql
as $$
begin
  if new.price_before_microusdc is null
     and new.price_before_cents is not null then
    new.price_before_microusdc := new.price_before_cents * 10000;
  end if;
  if new.price_after_microusdc is null
     and new.price_after_cents is not null then
    new.price_after_microusdc := new.price_after_cents * 10000;
  end if;
  return new;
end;
$$;

create trigger markets_sync_price_microusdc_ins
  before insert on public.markets
  for each row execute function public.sync_market_price_microusdc();

create trigger markets_sync_price_microusdc_upd
  before update of latest_price_cents on public.markets
  for each row execute function public.sync_market_price_microusdc();

create trigger transactions_sync_price_microusdc_ins
  before insert on public.transactions
  for each row execute function public.sync_transaction_price_microusdc();

-- ─── 5. Update the public chart-history view ──────────────────────────
-- Add the new columns. Keep the existing `*_cents` columns in the view
-- so any consumer that hasn't migrated keeps working. The SECURITY
-- DEFINER decision and column-list rationale are documented on the
-- view itself (see migration 20260519000001).

-- Postgres `CREATE OR REPLACE VIEW` only allows ADDING columns AT THE
-- END of the SELECT list (the existing columns' positions and types
-- must match exactly). Putting the new microusdc columns last preserves
-- the original ordering of every existing column — consumers that
-- read by name (PostgREST does) are unaffected.
create or replace view public.market_price_history
with (security_invoker = false) as
select
  market_id,
  q_before,
  q_after,
  price_before_cents,
  price_after_cents,
  action,
  created_at,
  price_before_microusdc,
  price_after_microusdc
from public.transactions;

comment on view public.market_price_history is
  'SECURITY DEFINER by design — runs as view owner so RLS on the underlying transactions table is bypassed. Exposes only non-PII columns (market_id, q_before, q_after, price_*_cents, price_*_microusdc, action, created_at). The microusdc columns added in migration 20260519000002 carry 6-decimal price precision for the NPSI chart; the cents columns remain for backward-compatible reads. See migration 20260507000004 for the original rationale and 20260519000001 for the SECURITY DEFINER lint context.';

grant select on public.market_price_history to anon, authenticated;
