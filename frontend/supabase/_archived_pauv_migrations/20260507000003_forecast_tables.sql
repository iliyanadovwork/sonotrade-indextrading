-- =====================================================================
-- Migration 8: Forecast trade execution (DTM 4.0 positions + transactions)
-- =====================================================================
-- Implements the Sprint 2 trade tables: positions, transactions, and the
-- ledger_kind extensions that connect forecast money flows to the existing
-- ledger_entries scheme.
--
-- Engine math runs in TypeScript via packages/pauv-engine; this schema
-- only persists the result. The engine adapter at
-- src/server/engine-adapter.ts is the sole path that writes here.
--
-- Money is bigint micro-USDC throughout (matches deposits/withdrawals).
-- Token / Q values are numeric(38,18) — engine works in JS numbers,
-- precision is recovered at the boundary by re-reading state on each tx.
--
-- SYSTEM_TREASURY constant: '00000000-0000-0000-0000-000000000001'
--   Used as ledger_entries.account_id for every fee credit. No actual
--   row exists — the UUID is purely a routing label inside ledger_entries.
--   See src/server/engine-adapter.ts for the canonical constant.

-- ─── 1. Enums ──────────────────────────────────────────────────────
create type position_direction as enum ('positive', 'negative');
create type position_status   as enum ('open', 'closed', 'liquidated');
create type transaction_action as enum (
  'open_positive',
  'close_positive',
  'open_negative',
  'close_negative',
  'liquidation'
);

-- Extend ledger_kind. Postgres doesn't allow enum value adds inside a
-- transaction without a workaround; supabase db push wraps each statement
-- separately, so these execute individually.
alter type ledger_kind add value if not exists 'forecast_open_debit';
alter type ledger_kind add value if not exists 'forecast_close_credit';
alter type ledger_kind add value if not exists 'forecast_liquidation_credit';
-- ('fee' was already in the enum since migration 1; reused for treasury fees.)

-- ─── 2. positions ──────────────────────────────────────────────────
create table positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  market_id uuid not null references markets(profile_id) on delete restrict,
  direction position_direction not null,

  -- Engine quantity (tokens). Numeric to preserve precision across the
  -- JS-number boundary; never µUSDC.
  tokens numeric(38,18) not null check (tokens > 0),

  -- Money fields are µUSDC.
  cash_paid_microusdc bigint not null check (cash_paid_microusdc > 0),
  open_cost_microusdc bigint not null check (open_cost_microusdc > 0),
  -- Negatives only — 2× net stake escrow + per-position liquidation pct.
  escrow_microusdc bigint check (escrow_microusdc is null or escrow_microusdc > 0),
  liquidation_pct numeric(6,5) check (
    liquidation_pct is null
    or (liquidation_pct > 0 and liquidation_pct < 1)
  ),
  -- Trip Q cached for the cascade-walk index. Recomputed by the engine on
  -- every walk — this is a hot-path read optimization, not the source of
  -- truth.
  trip_q numeric(38,18),

  opened_at_q numeric(38,18) not null,
  opened_at_price_cents bigint not null check (opened_at_price_cents > 0),

  status position_status not null default 'open',
  closed_at timestamptz,
  realized_pnl_microusdc bigint,

  created_at timestamptz not null default now(),

  -- Negatives must carry escrow + liquidation_pct + trip_q.
  constraint positions_negative_carries_escrow check (
    direction = 'positive'
    or (escrow_microusdc is not null and liquidation_pct is not null and trip_q is not null)
  ),
  -- Closed/liquidated positions must have a closed_at and realized_pnl.
  constraint positions_closed_has_pnl check (
    status = 'open'
    or (closed_at is not null and realized_pnl_microusdc is not null)
  )
);

-- Per-user history (sidebar nav, holdings page, profile open list).
create index positions_user_status_created_idx
  on positions (user_id, status, created_at desc);

-- Per-market open lookup (for cascade-walk hydration on every trade).
create index positions_market_open_idx
  on positions (market_id, status) where status = 'open';

-- Cascade-walk fast path: shorts ordered by trip_q for trip-point lookup.
create index positions_negative_trip_q_idx
  on positions (market_id, trip_q)
  where status = 'open' and direction = 'negative';

-- ─── 3. transactions — per-trade audit + chart history ─────────────
create table transactions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(profile_id) on delete restrict,
  -- user_id is null for liquidation rows that the affected user didn't
  -- initiate; the position_id links them.
  user_id uuid references auth.users(id) on delete set null,
  position_id uuid references positions(id) on delete restrict,

  action transaction_action not null,

  tokens numeric(38,18) not null,
  cash_amount_microusdc bigint not null check (cash_amount_microusdc >= 0),
  fee_microusdc bigint not null default 0 check (fee_microusdc >= 0),

  q_before numeric(38,18) not null,
  q_after numeric(38,18) not null,
  price_before_cents bigint not null check (price_before_cents >= 0),
  price_after_cents bigint not null check (price_after_cents >= 0),

  -- Set on user-initiated trades; null on cascade-liquidation rows that
  -- ride along the parent trade's transaction.
  idempotency_key text unique,

  created_at timestamptz not null default now()
);

create index transactions_market_created_idx
  on transactions (market_id, created_at desc);
create index transactions_user_created_idx
  on transactions (user_id, created_at desc) where user_id is not null;

-- ─── 4. RLS ────────────────────────────────────────────────────────
alter table positions enable row level security;
alter table transactions enable row level security;

create policy positions_self_select on positions
  for select using (user_id = auth.uid() or is_admin(auth.uid()));
revoke insert, update, delete on positions from anon, authenticated;
grant select on positions to authenticated;

create policy transactions_self_select on transactions
  for select using (user_id = auth.uid() or is_admin(auth.uid()));
revoke insert, update, delete on transactions from anon, authenticated;
grant select on transactions to authenticated;

-- ─── 5. Realtime publication ───────────────────────────────────────
alter publication supabase_realtime add table positions;
alter publication supabase_realtime add table transactions;

-- ─── 6. Feature flags ──────────────────────────────────────────────
insert into feature_flags (key, bool_value, jsonb_value, numeric_value, description) values
  ('forecasts_enabled',                false, null, null,         'Master kill switch for forecast trading'),
  ('forecasts_require_kyc',            false, null, null,         'Block forecasts if user.kyc_status != verified'),
  ('forecasts_canary_user_ids',        null, '[]'::jsonb, null,   'JSON array of user_ids who see forecasts even when forecasts_enabled is false'),
  ('forecasts_min_microusdc',          null, null, 1000000,       'Minimum forecast amount per trade ($1)'),
  ('forecasts_max_microusdc_per_trade', null, null, 50000000000,  'Maximum forecast amount per trade ($50,000)')
on conflict (key) do nothing;

-- ─── 7. forecast_admin_force_close() — operator SQL editor ─────────
-- Force-closes a position at the current market state and credits the
-- user. Restricted to admins; logs an audit_log entry. Escape hatch for
-- bug responses, freezes, or refunds. Rare; do not use casually.
create or replace function forecast_admin_force_close(
  p_position_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if not is_admin(v_admin) then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  -- Mark closed/liquidated; the operator is responsible for separately
  -- crediting the user via a manual_adjustment ledger entry if appropriate.
  update positions
    set status = 'closed',
        closed_at = now(),
        realized_pnl_microusdc = coalesce(realized_pnl_microusdc, 0)
    where id = p_position_id and status = 'open';

  insert into audit_log (actor, action, target_table, target_id, metadata)
  values (
    'admin:' || coalesce(v_admin::text, 'sql_console'),
    'forecast.admin_force_close',
    'positions',
    p_position_id,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'position_id', p_position_id);
end;
$$;

revoke all on function forecast_admin_force_close(uuid, text) from public;
grant execute on function forecast_admin_force_close(uuid, text) to service_role;

comment on function forecast_admin_force_close(uuid, text) is
  'Admin-only force close (no balance change). Operator separately handles refunds via manual_adjustment ledger entries.';
