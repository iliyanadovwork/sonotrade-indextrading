-- =====================================================================
-- Migration 6: USDC-on-Solana deposits + µUSDC switchover
-- =====================================================================
-- Adds the deposit pipeline (pending_deposits, treasury_inflows,
-- webhook_events, ledger_entries, idempotency_keys, audit_log).
-- Switches user_balances from cents → microUSDC (6-decimal precision)
-- so on-chain deltas land without truncation.
--
-- Compliance providers (KYC, AML, Travel Rule, custodian) are deferred;
-- nullable columns + a no-op screenInflow() seam preserve forward
-- compatibility — when providers are wired, only the seam changes.
--
-- Exactly-once USDC crediting: webhook_events unique(provider, event_id) plus a
-- unique ledger_entries.idempotency_key, so a replayed provider webhook and a
-- retried manual match both collapse to one credit.

-- ─── 1. µUSDC switchover on user_balances ───────────────────────────
alter table user_balances
  add column available_microusdc bigint not null default 0,
  add column pending_withdrawal_microusdc bigint not null default 0;

update user_balances
  set available_microusdc = available_cents * 10000,
      pending_withdrawal_microusdc = pending_withdrawal_cents * 10000;

alter table user_balances drop column available_cents;
alter table user_balances drop column pending_withdrawal_cents;

alter table user_balances
  add constraint user_balances_available_nonneg
    check (available_microusdc >= 0),
  add constraint user_balances_pending_withdrawal_nonneg
    check (pending_withdrawal_microusdc >= 0);

comment on column user_balances.available_microusdc is
  'Liquid balance in micro-USDC (6 decimals). 1 USDC = 1_000_000 µUSDC. Display layer formats $X.XX.';
comment on column user_balances.pending_withdrawal_microusdc is
  'Funds reserved for in-flight withdrawals (also µUSDC).';

-- ─── 2. feature_flags JSONB extension + deposit defaults ────────────
alter table feature_flags add column jsonb_value jsonb;

-- Migration 1 already inserted `deposits_enabled = true` (intent: "deposits
-- on by default"). This PR re-scopes deposits as a feature-flag-gated
-- canary rollout, so flip it to false. Operator flips back to true once
-- canary testing succeeds.
update feature_flags
  set bool_value = false,
      description = 'Master kill switch for the deposit flow'
  where key = 'deposits_enabled';

insert into feature_flags (key, bool_value, jsonb_value, numeric_value, description) values
  ('deposits_require_kyc',            false, null,         null,         'Block deposits if user.kyc_status != verified'),
  ('deposits_canary_user_ids',        null,  '[]'::jsonb,  null,         'JSON array of user_ids who see the deposit flow even when deposits_enabled is false'),
  ('deposits_geo_blocklist',          null,  '[]'::jsonb,  null,         'JSON array of ISO-3166 alpha-2 codes blocked from depositing'),
  ('deposits_min_microusdc',          null,  null,         10000000,     'Minimum deposit per tx ($10)'),
  ('deposits_max_microusdc_per_tx',   null,  null,         100000000000, 'Maximum single deposit ($100,000)'),
  ('deposits_daily_cap_microusdc',    null,  null,         200000000000, 'Per-user daily cap ($200,000)'),
  ('fat_finger_ratio_high',           null,  null,         1.5,          'Above this ratio of typed amount, require user confirmation'),
  ('fat_finger_ratio_low',            null,  null,         0.5,          'Below this ratio of typed amount, require user confirmation'),
  ('travel_rule_threshold_microusdc', null,  null,         3000000000,   'Travel Rule data-exchange threshold ($3,000)')
on conflict (key) do nothing;

-- ─── 3. Enums for deposit pipeline ──────────────────────────────────
create type deposit_status as enum (
  'pending',
  'detected',
  'screening',
  'awaiting_user_confirmation',
  'credited',
  'quarantined',
  'rejected',
  'reorged',
  'expired',
  'cap_exceeded'
);

create type deposit_match_strategy as enum (
  'reference',
  'memo',
  'window',
  'sender_heuristic',
  'manual'
);

create type inflow_status as enum (
  'unprocessed',
  'matched',
  'quarantined',
  'manual_review',
  'ignored'
);

create type solana_commitment as enum ('confirmed', 'finalized');

create type ledger_direction as enum ('debit', 'credit');

create type ledger_kind as enum (
  'deposit_credit',
  'deposit_reversal',
  'quarantine_hold',
  'quarantine_release',
  'manual_adjustment',
  'fee'
);

create type webhook_processing_status as enum (
  'received',
  'processed',
  'failed',
  'duplicate'
);

-- ─── 4. pending_deposits ────────────────────────────────────────────
create table pending_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network text not null default 'solana' check (network = 'solana'),
  amount_microusdc_expected bigint check (amount_microusdc_expected is null or amount_microusdc_expected > 0),
  amount_microusdc_actual bigint check (amount_microusdc_actual is null or amount_microusdc_actual >= 0),
  reference_pubkey text not null unique,
  treasury_address text not null,
  usdc_mint text not null,
  memo text not null,
  signature text,
  match_strategy deposit_match_strategy,
  status deposit_status not null default 'pending',

  -- Compliance-side fields (nullable; populated when providers wire in)
  kyc_tier_at_create text,
  risk_score int check (risk_score is null or (risk_score between 0 and 100)),
  risk_decision text check (risk_decision in ('allow','review','block')),
  risk_provider text,
  risk_raw jsonb,

  expected_confirmation_at timestamptz,
  detected_at timestamptz,
  matched_at timestamptz,
  finalized_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

-- Structural double-credit guard (carried from demo): one signature can
-- bind to at most one deposit. Partial — pending unsigned deposits don't
-- contend on this index.
create unique index pending_deposits_signature_unique
  on pending_deposits (signature) where signature is not null;

create index pending_deposits_user_status_created_idx
  on pending_deposits (user_id, status, created_at desc);

create index pending_deposits_status_active_idx
  on pending_deposits (status)
  where status in ('pending','detected','screening','awaiting_user_confirmation');

create index pending_deposits_expires_at_idx
  on pending_deposits (expires_at)
  where status = 'pending' and signature is null;

-- ─── 5. treasury_inflows ────────────────────────────────────────────
create table treasury_inflows (
  id uuid primary key default gen_random_uuid(),
  signature text not null unique,
  slot bigint not null,
  block_time timestamptz not null,
  commitment solana_commitment not null,
  finalized_at timestamptz,
  sender_address text,
  amount_microusdc bigint not null check (amount_microusdc >= 0),
  reference_in_tx text,
  memo_in_tx text,
  unexpected_token boolean not null default false,
  status inflow_status not null default 'unprocessed',
  matched_deposit_id uuid references pending_deposits(id),

  risk_score int check (risk_score is null or (risk_score between 0 and 100)),
  risk_provider text,
  risk_raw jsonb,
  travel_rule_status text check (
    travel_rule_status is null or
    travel_rule_status in ('not_required','pending_counterparty','complete','blocked')
  ),

  created_at timestamptz not null default now()
);

create index treasury_inflows_status_block_time_idx
  on treasury_inflows (status, block_time desc);

create index treasury_inflows_sender_idx
  on treasury_inflows (sender_address)
  where sender_address is not null;

-- ─── 6. webhook_events ──────────────────────────────────────────────
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  auth_header_ok boolean not null,
  received_at timestamptz not null default now(),
  processing_status webhook_processing_status not null default 'received',
  processed_at timestamptz,
  error text,

  unique (provider, event_id)
);

create index webhook_events_processing_idx
  on webhook_events (processing_status, received_at)
  where processing_status in ('received','failed');

-- ─── 7. ledger_entries (MVP shape; Sprint 2 extends) ────────────────
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,                -- user_id today; system accounts in Sprint 2
  direction ledger_direction not null,
  amount_microusdc bigint not null check (amount_microusdc > 0),
  currency text not null default 'USD' check (currency in ('USD','POINT')),
  kind ledger_kind not null,
  ref_table text not null,                 -- 'pending_deposits' | 'treasury_inflows' | 'manual'
  ref_id uuid,
  idempotency_key text not null unique,    -- e.g. 'deposit_credit:<deposit_id>'
  created_at timestamptz not null default now(),
  created_by uuid                          -- null for system; admin user_id for manual
);

create index ledger_entries_account_created_idx
  on ledger_entries (account_id, created_at desc);

create index ledger_entries_kind_created_idx
  on ledger_entries (kind, created_at desc);

-- ─── 8. idempotency_keys ────────────────────────────────────────────
create table idempotency_keys (
  key text primary key,
  user_id uuid,
  endpoint text not null,
  response_status int not null,
  response_body jsonb not null,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index idempotency_keys_expires_at_idx on idempotency_keys (expires_at);

-- ─── 9. audit_log ───────────────────────────────────────────────────
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,                     -- 'system:reconciler' | 'user:<uid>' | 'admin:<uid>'
  action text not null,
  target_table text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_target_idx on audit_log (target_table, target_id, created_at desc);
create index audit_log_actor_idx on audit_log (actor, created_at desc);
create index audit_log_created_idx on audit_log (created_at);

-- ─── 10. RLS ────────────────────────────────────────────────────────
alter table pending_deposits enable row level security;
alter table treasury_inflows enable row level security;
alter table webhook_events enable row level security;
alter table ledger_entries enable row level security;
alter table idempotency_keys enable row level security;
alter table audit_log enable row level security;

-- pending_deposits: self-or-admin SELECT only
create policy pending_deposits_self_select on pending_deposits
  for select using (user_id = auth.uid() or is_admin(auth.uid()));
revoke insert, update, delete on pending_deposits from anon, authenticated;
grant select on pending_deposits to authenticated;

-- treasury_inflows, webhook_events, audit_log: admin-only
create policy treasury_inflows_admin_select on treasury_inflows
  for select using (is_admin(auth.uid()));
revoke insert, update, delete on treasury_inflows from anon, authenticated;

create policy webhook_events_admin_select on webhook_events
  for select using (is_admin(auth.uid()));
revoke insert, update, delete on webhook_events from anon, authenticated;

create policy audit_log_admin_select on audit_log
  for select using (is_admin(auth.uid()));
revoke insert, update, delete on audit_log from anon, authenticated;

-- ledger_entries: self-or-admin SELECT for account holder
create policy ledger_entries_self_select on ledger_entries
  for select using (account_id = auth.uid() or is_admin(auth.uid()));
revoke insert, update, delete on ledger_entries from anon, authenticated;
grant select on ledger_entries to authenticated;

-- idempotency_keys: no public access
revoke all on idempotency_keys from anon, authenticated;

-- ─── 11. Realtime publication ───────────────────────────────────────
-- pending_deposits row UPDATE → broadcast to clients on `user:{uid}:deposit:{id}` channel
-- ledger_entries row INSERT → broadcast to clients for transaction history
alter publication supabase_realtime add table pending_deposits;
alter publication supabase_realtime add table ledger_entries;

-- ─── 12. match_inflow_manual() — operator SQL editor entry point ────
-- Same atomic credit logic the Inngest credit job uses, but callable
-- directly from the Supabase SQL editor when the cron / webhook missed
-- something. See docs/usdc-deposits.md "Manually bind an inflow".
--
-- Atomic: locks inflow + deposit + user_balances; idempotent via
-- ledger_entries.idempotency_key unique constraint.
create or replace function match_inflow_manual(
  p_inflow_id uuid,
  p_deposit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inflow treasury_inflows%rowtype;
  v_deposit pending_deposits%rowtype;
  v_idempotency_key text := 'deposit_credit:' || p_deposit_id::text;
  v_new_balance bigint;
begin
  -- Lock inflow + deposit, in stable order to prevent deadlock
  select * into v_inflow from treasury_inflows where id = p_inflow_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'inflow_not_found');
  end if;
  if v_inflow.status not in ('unprocessed', 'manual_review') then
    return jsonb_build_object('ok', false, 'error', 'inflow_already_resolved', 'status', v_inflow.status);
  end if;

  select * into v_deposit from pending_deposits where id = p_deposit_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'deposit_not_found');
  end if;
  if v_deposit.signature is not null then
    return jsonb_build_object('ok', false, 'error', 'deposit_already_credited', 'signature', v_deposit.signature);
  end if;

  -- Insert ledger entry (idempotent via unique idempotency_key)
  insert into ledger_entries (
    account_id, direction, amount_microusdc, currency, kind,
    ref_table, ref_id, idempotency_key, created_by
  ) values (
    v_deposit.user_id, 'credit', v_inflow.amount_microusdc, 'USD', 'deposit_credit',
    'pending_deposits', v_deposit.id, v_idempotency_key, auth.uid()
  )
  on conflict (idempotency_key) do nothing;

  -- Bump balance (lock implicit via FK/PK; user_balances row exists from auto-create trigger)
  update user_balances
    set available_microusdc = available_microusdc + v_inflow.amount_microusdc,
        updated_at = now()
    where user_id = v_deposit.user_id
    returning available_microusdc into v_new_balance;

  -- Mark deposit credited (signature stamp = structural guard)
  update pending_deposits
    set signature = v_inflow.signature,
        match_strategy = 'manual',
        status = 'credited',
        amount_microusdc_actual = v_inflow.amount_microusdc,
        matched_at = now(),
        confirmed_at = now()
    where id = v_deposit.id;

  -- Mark inflow matched
  update treasury_inflows
    set status = 'matched',
        matched_deposit_id = v_deposit.id
    where id = v_inflow.id;

  -- Audit
  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:' || coalesce(auth.uid()::text, 'sql_console'),
    'deposit.manual_match',
    'pending_deposits',
    v_deposit.id,
    jsonb_build_object('signature', v_inflow.signature, 'amount_microusdc', v_inflow.amount_microusdc),
    jsonb_build_object('inflow_id', v_inflow.id)
  );

  return jsonb_build_object(
    'ok', true,
    'deposit_id', v_deposit.id,
    'signature', v_inflow.signature,
    'amount_microusdc', v_inflow.amount_microusdc,
    'new_balance_microusdc', v_new_balance
  );
end;
$$;

revoke all on function match_inflow_manual(uuid, uuid) from public;
grant execute on function match_inflow_manual(uuid, uuid) to service_role;
-- Note: not granted to authenticated. Operator runs from SQL editor (postgres role).

comment on function match_inflow_manual(uuid, uuid) is
  'Operator-only manual match. Idempotent via ledger_entries.idempotency_key. Callable from Supabase SQL editor as the postgres role.';
