-- =====================================================================
-- Migration 7: USDC withdrawals
-- =====================================================================
-- Adds the withdrawals table + admin SQL functions for the
-- self-serve withdraw flow. Aiden (admin) processes the queue via
-- Supabase SQL editor — no admin Next.js routes in this repo.
--
-- Accounting invariants preserved:
--   - sum(ledger_entries.credits) - sum(debits) = user balance
--   - On request: debit ledger now, move available → pending_withdrawal
--   - On approve: no new ledger entry, clear pending_withdrawal
--   - On reject/cancel: reversal ledger entry, move pending_withdrawal →
--     available

-- ─── 1. Extend ledger_kind enum ─────────────────────────────────────
alter type ledger_kind add value if not exists 'withdrawal_request';
alter type ledger_kind add value if not exists 'withdrawal_rejected';
alter type ledger_kind add value if not exists 'withdrawal_cancelled';
-- (No 'withdrawal_completed' — the original 'withdrawal_request' is the
-- canonical debit. Completion is reflected via withdrawals.status only.)

-- ─── 2. Withdrawal status enum ──────────────────────────────────────
create type withdrawal_status as enum (
  'pending',     -- user submitted, awaiting admin review
  'processing',  -- admin acknowledged, sending on-chain (currently unused; future)
  'completed',   -- admin sent + recorded; funds left the treasury
  'rejected',    -- admin declined; funds returned to user
  'cancelled'    -- user self-cancelled before admin acted
);

-- ─── 3. withdrawals table ───────────────────────────────────────────
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_microusdc bigint not null check (amount_microusdc > 0),
  destination_address text not null
    check (length(destination_address) between 32 and 44),  -- Solana base58 range
  status withdrawal_status not null default 'pending',
  decision_note text,                                       -- rejection reason or admin notes
  decided_by uuid references auth.users(id),                -- admin user_id
  decided_at timestamptz,
  signature text,                                           -- on-chain tx signature when admin sends
  email_sent_at timestamptz,
  -- Compliance seam (nullable; stays null until AML/KYC providers wire in)
  kyc_tier_at_create text,
  risk_score int check (risk_score is null or risk_score between 0 and 100),
  risk_decision text check (risk_decision in ('allow','review','block')),
  risk_provider text,
  risk_raw jsonb,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Per-user history reads (sidebar nav, transaction history endpoint)
create index withdrawals_user_status_created_idx
  on withdrawals (user_id, status, created_at desc);

-- Admin queue: pending requests, oldest first
create index withdrawals_pending_queue_idx
  on withdrawals (requested_at)
  where status = 'pending';

-- Once we wire admin app, signature lookups for completed withdrawals
create unique index withdrawals_signature_unique
  on withdrawals (signature) where signature is not null;

-- ─── 4. RLS ─────────────────────────────────────────────────────────
alter table withdrawals enable row level security;

-- Users see only their own withdrawals; admins see all
create policy withdrawals_self_select on withdrawals
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- No end-user writes — service role only (API route uses createAdminClient)
revoke insert, update, delete on withdrawals from anon, authenticated;
grant select on withdrawals to authenticated;

-- Realtime: clients subscribe to status updates on their own row
alter publication supabase_realtime add table withdrawals;

-- ─── 5. Feature flags ───────────────────────────────────────────────
insert into feature_flags (key, bool_value, jsonb_value, numeric_value, description) values
  ('withdrawals_enabled',             false, null, null,        'Master kill switch for the withdrawal flow'),
  ('withdrawals_require_kyc',         false, null, null,        'Block withdrawals if user.kyc_status != verified'),
  ('withdrawals_canary_user_ids',     null, '[]'::jsonb, null,  'JSON array of user_ids who see withdrawals even when withdrawals_enabled is false'),
  ('withdrawals_min_microusdc',       null, null, 10000000,     'Minimum withdrawal per request ($10)'),
  ('withdrawals_max_microusdc_per_tx', null, null, 100000000000, 'Maximum single withdrawal ($100,000)'),
  ('withdrawals_daily_cap_microusdc', null, null, 200000000000, 'Per-user daily withdrawal cap ($200,000)')
on conflict (key) do nothing;

-- ─── 6. withdrawal_request_create() — server-side via API route ─────
-- Atomic: validates amount, locks user_balances, debits available,
-- credits pending_withdrawal, inserts the withdrawal row, inserts the
-- ledger entry. Returns the new withdrawal id.
--
-- Caller (the API route) is responsible for:
--   - authentication (user must be the row owner)
--   - feature-flag / KYC gate
--   - daily-cap check (cheap to query separately)
--   - solana address validation (this function trusts the caller)
create or replace function withdrawal_request_create(
  p_user_id uuid,
  p_amount_microusdc bigint,
  p_destination_address text,
  p_kyc_tier text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_id uuid;
  v_idempotency_key text;
begin
  if p_amount_microusdc is null or p_amount_microusdc <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Lock the balance row in shared mode to serialize against concurrent
  -- requests / cancels / approvals.
  select available_microusdc into v_balance
    from user_balances
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'balance_row_missing' using errcode = '23503';
  end if;
  if v_balance < p_amount_microusdc then
    raise exception 'insufficient_balance' using errcode = '23514';
  end if;

  -- Insert the withdrawal row first to get the id for the idempotency key.
  insert into withdrawals (user_id, amount_microusdc, destination_address, kyc_tier_at_create)
  values (p_user_id, p_amount_microusdc, p_destination_address, p_kyc_tier)
  returning id into v_id;

  v_idempotency_key := 'withdrawal_request:' || v_id::text;

  -- Move money: available → pending_withdrawal.
  update user_balances
    set available_microusdc = available_microusdc - p_amount_microusdc,
        pending_withdrawal_microusdc = pending_withdrawal_microusdc + p_amount_microusdc,
        updated_at = now()
    where user_id = p_user_id;

  -- Ledger debit (this is the canonical record of the withdrawal request).
  insert into ledger_entries (
    account_id, direction, amount_microusdc, currency, kind,
    ref_table, ref_id, idempotency_key
  ) values (
    p_user_id, 'debit', p_amount_microusdc, 'USD', 'withdrawal_request',
    'withdrawals', v_id, v_idempotency_key
  );

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'user:' || p_user_id::text,
    'withdrawal.requested',
    'withdrawals',
    v_id,
    jsonb_build_object('amount_microusdc', p_amount_microusdc::text,
                       'destination_address', p_destination_address),
    jsonb_build_object()
  );

  return v_id;
end;
$$;

revoke all on function withdrawal_request_create(uuid, bigint, text, text) from public;
grant execute on function withdrawal_request_create(uuid, bigint, text, text) to service_role;

-- ─── 7. withdrawal_self_cancel() — user-callable from API route ─────
-- Reverses a still-pending withdrawal: restores funds and inserts the
-- reversal ledger entry. Idempotent: re-running on a non-pending row
-- is a no-op error.
create or replace function withdrawal_self_cancel(
  p_user_id uuid,
  p_withdrawal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row withdrawals%rowtype;
begin
  select * into v_row from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'withdrawal_not_found' using errcode = '02000';
  end if;
  if v_row.user_id <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'wrong_state: %', v_row.status using errcode = '22023';
  end if;

  -- Lock balance, restore funds.
  update user_balances
    set available_microusdc = available_microusdc + v_row.amount_microusdc,
        pending_withdrawal_microusdc = pending_withdrawal_microusdc - v_row.amount_microusdc,
        updated_at = now()
    where user_id = p_user_id;

  -- Reversal ledger entry.
  insert into ledger_entries (
    account_id, direction, amount_microusdc, currency, kind,
    ref_table, ref_id, idempotency_key
  ) values (
    p_user_id, 'credit', v_row.amount_microusdc, 'USD', 'withdrawal_cancelled',
    'withdrawals', v_row.id, 'withdrawal_cancelled:' || v_row.id::text
  );

  -- Mark withdrawal cancelled.
  update withdrawals
    set status = 'cancelled',
        decided_at = now()
    where id = p_withdrawal_id;

  insert into audit_log (actor, action, target_table, target_id, metadata)
  values ('user:' || p_user_id::text, 'withdrawal.self_cancelled', 'withdrawals',
          p_withdrawal_id, jsonb_build_object());

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function withdrawal_self_cancel(uuid, uuid) from public;
grant execute on function withdrawal_self_cancel(uuid, uuid) to service_role;

-- ─── 8. withdrawal_admin_approve() — operator SQL editor ────────────
-- Admin runs this after manually sending USDC from treasury wallet.
-- Records the on-chain signature on the row, marks status=completed,
-- clears pending_withdrawal_microusdc. NO new ledger entry — the
-- withdrawal_request entry remains the canonical debit.
create or replace function withdrawal_admin_approve(
  p_withdrawal_id uuid,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row withdrawals%rowtype;
  v_admin uuid := auth.uid();
begin
  if not is_admin(v_admin) then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;
  if p_signature is null or length(p_signature) < 32 then
    raise exception 'invalid_signature' using errcode = '22023';
  end if;

  select * into v_row from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'withdrawal_not_found' using errcode = '02000';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'wrong_state: %', v_row.status using errcode = '22023';
  end if;

  -- Clear pending_withdrawal (available was already debited at request time).
  update user_balances
    set pending_withdrawal_microusdc = pending_withdrawal_microusdc - v_row.amount_microusdc,
        updated_at = now()
    where user_id = v_row.user_id;

  update withdrawals
    set status = 'completed',
        signature = p_signature,
        decided_by = v_admin,
        decided_at = now()
    where id = p_withdrawal_id;

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:' || coalesce(v_admin::text, 'sql_console'),
    'withdrawal.approved',
    'withdrawals',
    p_withdrawal_id,
    jsonb_build_object('signature', p_signature),
    jsonb_build_object()
  );

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', p_withdrawal_id,
    'signature', p_signature
  );
end;
$$;

revoke all on function withdrawal_admin_approve(uuid, text) from public;
grant execute on function withdrawal_admin_approve(uuid, text) to service_role;

-- ─── 9. withdrawal_admin_reject() — operator SQL editor ─────────────
-- Restores funds + reversal ledger entry. Aiden manually emails the
-- user explaining the rejection.
create or replace function withdrawal_admin_reject(
  p_withdrawal_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row withdrawals%rowtype;
  v_admin uuid := auth.uid();
begin
  if not is_admin(v_admin) then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_row from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'withdrawal_not_found' using errcode = '02000';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'wrong_state: %', v_row.status using errcode = '22023';
  end if;

  -- Restore: pending_withdrawal → available.
  update user_balances
    set available_microusdc = available_microusdc + v_row.amount_microusdc,
        pending_withdrawal_microusdc = pending_withdrawal_microusdc - v_row.amount_microusdc,
        updated_at = now()
    where user_id = v_row.user_id;

  insert into ledger_entries (
    account_id, direction, amount_microusdc, currency, kind,
    ref_table, ref_id, idempotency_key
  ) values (
    v_row.user_id, 'credit', v_row.amount_microusdc, 'USD', 'withdrawal_rejected',
    'withdrawals', v_row.id, 'withdrawal_rejected:' || v_row.id::text
  );

  update withdrawals
    set status = 'rejected',
        decision_note = p_reason,
        decided_by = v_admin,
        decided_at = now()
    where id = p_withdrawal_id;

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:' || coalesce(v_admin::text, 'sql_console'),
    'withdrawal.rejected',
    'withdrawals',
    p_withdrawal_id,
    jsonb_build_object('reason', p_reason),
    jsonb_build_object()
  );

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', p_withdrawal_id,
    'reason', p_reason
  );
end;
$$;

revoke all on function withdrawal_admin_reject(uuid, text) from public;
grant execute on function withdrawal_admin_reject(uuid, text) to service_role;

comment on function withdrawal_admin_approve(uuid, text) is
  'Admin-only. Run after manually sending USDC from the treasury. Records the on-chain signature, clears pending_withdrawal_microusdc, marks status=completed.';
comment on function withdrawal_admin_reject(uuid, text) is
  'Admin-only. Restores funds to available balance via reversal ledger entry. Admin should manually email the user with the reason.';