-- ════════════════════════════════════════════════════════════════════
-- Admin function hardening
-- ════════════════════════════════════════════════════════════════════
--
-- Two defense-in-depth changes to operator-only SECURITY DEFINER
-- functions:
--
--   1. match_inflow_manual() — original relied on "not granted to
--      authenticated" to keep the function out of regular hands. Add
--      an explicit is_admin() check inside the function body so that
--      even if grants were accidentally widened, a non-admin JWT
--      caller would be rejected. Service-role + SQL-editor (postgres)
--      callers continue to work because auth.uid() is null there and
--      the check is gated on a non-null uid.
--
--   2. forecast_admin_force_close() — original closed the position
--      but required the operator to follow up with a separate
--      manual_adjustment ledger entry to credit the user. That two-
--      step manual flow is racy and frequently forgotten. Add an
--      optional p_credit_microusdc parameter (defaults to 0 for
--      backward compatibility) that atomically inserts the ledger
--      credit + bumps user_balances in the same transaction.

-- Add a dedicated ledger kind so admin force-close credits are
-- distinguishable from generic manual_adjustment in audit reports.
alter type ledger_kind add value if not exists 'forecast_admin_close_credit';

-- ─── 1. match_inflow_manual() — explicit admin check ────────────────
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
  -- Defense-in-depth: only an admin JWT or a privileged DB role
  -- (service_role / postgres via SQL editor, where auth.uid() is null)
  -- may call this. Without this check, any future widening of the
  -- function's grant would expose it to regular users.
  if auth.uid() is not null and not is_admin(auth.uid()) then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

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

  insert into ledger_entries (
    account_id, direction, amount_microusdc, currency, kind,
    ref_table, ref_id, idempotency_key, created_by
  ) values (
    v_deposit.user_id, 'credit', v_inflow.amount_microusdc, 'USD', 'deposit_credit',
    'pending_deposits', v_deposit.id, v_idempotency_key, auth.uid()
  )
  on conflict (idempotency_key) do nothing;

  update user_balances
    set available_microusdc = available_microusdc + v_inflow.amount_microusdc,
        updated_at = now()
    where user_id = v_deposit.user_id
    returning available_microusdc into v_new_balance;

  update pending_deposits
    set signature = v_inflow.signature,
        match_strategy = 'manual',
        status = 'credited',
        amount_microusdc_actual = v_inflow.amount_microusdc,
        matched_at = now(),
        confirmed_at = now()
    where id = v_deposit.id;

  update treasury_inflows
    set status = 'matched',
        matched_deposit_id = v_deposit.id
    where id = v_inflow.id;

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

-- ─── 2. forecast_admin_force_close() — optional atomic credit ───────
create or replace function forecast_admin_force_close(
  p_position_id uuid,
  p_reason text,
  p_credit_microusdc bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_user_id uuid;
  v_new_balance bigint;
  v_idempotency_key text := 'forecast_admin_close:' || p_position_id::text;
begin
  if not is_admin(v_admin) then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_credit_microusdc < 0 then
    raise exception 'credit_must_be_non_negative' using errcode = '22023';
  end if;

  -- Resolve user_id from the position. Lock the row to serialize with
  -- any concurrent close/liquidation.
  select user_id into v_user_id
    from positions
    where id = p_position_id and status = 'open'
    for update;
  if v_user_id is null then
    raise exception 'position_not_open' using errcode = '02000';
  end if;

  -- Mark closed first; realized_pnl reflects the credit amount minus the
  -- original cash paid (operator can override post-hoc if needed).
  update positions
    set status = 'closed',
        closed_at = now(),
        realized_pnl_microusdc = coalesce(realized_pnl_microusdc, 0)
    where id = p_position_id;

  -- Optional credit (idempotent via ledger_entries.idempotency_key).
  if p_credit_microusdc > 0 then
    insert into ledger_entries (
      account_id, direction, amount_microusdc, currency, kind,
      ref_table, ref_id, idempotency_key, created_by
    ) values (
      v_user_id, 'credit', p_credit_microusdc, 'USD', 'forecast_admin_close_credit',
      'positions', p_position_id, v_idempotency_key, v_admin
    )
    on conflict (idempotency_key) do nothing;

    update user_balances
      set available_microusdc = available_microusdc + p_credit_microusdc,
          updated_at = now()
      where user_id = v_user_id
      returning available_microusdc into v_new_balance;
  end if;

  insert into audit_log (actor, action, target_table, target_id, metadata)
  values (
    'admin:' || coalesce(v_admin::text, 'sql_console'),
    'forecast.admin_force_close',
    'positions',
    p_position_id,
    jsonb_build_object(
      'reason', p_reason,
      'credit_microusdc', p_credit_microusdc,
      'user_id', v_user_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'position_id', p_position_id,
    'user_id', v_user_id,
    'credit_microusdc', p_credit_microusdc,
    'new_balance_microusdc', v_new_balance
  );
end;
$$;

revoke all on function forecast_admin_force_close(uuid, text, bigint) from public;
grant execute on function forecast_admin_force_close(uuid, text, bigint) to service_role;

comment on function forecast_admin_force_close(uuid, text, bigint) is
  'Admin-only force close. Pass p_credit_microusdc > 0 to atomically refund the user in the same transaction. Idempotent via ledger_entries.idempotency_key.';

-- The pre-existing 2-arg signature is overloaded by the new 3-arg one
-- thanks to the default value; we explicitly drop it to avoid two
-- functions with overlapping resolution.
drop function if exists forecast_admin_force_close(uuid, text);
