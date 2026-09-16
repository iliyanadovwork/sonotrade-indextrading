-- ════════════════════════════════════════════════════════════════════
-- Withdrawal admin: base58 signature format validation
-- ════════════════════════════════════════════════════════════════════
--
-- The original `withdrawal_admin_approve()` (migration 20260507000002)
-- only validated `length(p_signature) >= 32`. A garbled paste in the
-- SQL editor — e.g. `"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` —
-- would be accepted as a valid Solana signature, breaking the audit
-- trail. Solana base58 signatures are 87-88 characters drawn from
-- a 58-character alphabet (excludes 0, O, I, l). This migration
-- replaces the loose check with a strict one.
--
-- Operator runbook (canonical, mirrored in docs/usdc-funds.md):
--   1. Read pending withdrawals from the SQL editor.
--   2. Send the USDC from the treasury wallet to the user's address.
--   3. Wait for the tx to confirm on Solscan.
--   4. Copy the signature string from Solscan (one click).
--   5. Run withdrawal_admin_approve('<id>'::uuid, '<signature>').
--      The function rejects malformed signatures with
--      `invalid_signature_format` BEFORE marking the withdrawal
--      complete, so a typo cannot break the audit trail.
--   NEVER approve in the DB before sending on-chain.

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

  -- Strict base58 format check. Solana signatures are exactly 87 or
  -- 88 chars (ed25519 64-byte sig encoded base58, length varies by
  -- leading-zero count). Reject anything outside [87, 88] OR any char
  -- not in the base58 alphabet. A NULL or empty signature is also
  -- rejected here.
  if p_signature is null
     or length(p_signature) not between 87 and 88
     or p_signature !~ '^[1-9A-HJ-NP-Za-km-z]+$'
  then
    raise exception 'invalid_signature_format' using errcode = '22023';
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
