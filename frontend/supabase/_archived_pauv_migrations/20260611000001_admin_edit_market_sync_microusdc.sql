-- =====================================================================
-- Fix: admin_edit_market must keep latest_price_microusdc in sync.
--
-- Bug: admin_edit_market recomputed and wrote latest_price_cents after a
-- p0 edit but left latest_price_microusdc untouched. The profile page,
-- chart, and trade panel read latest_price_microusdc (the sub-cent
-- precision column, added in 20260519000002), while search/lists read
-- latest_price_cents. Result: after an admin NPSI edit, search showed the
-- new value but the profile page showed the stale one. The microusdc-sync
-- trigger could not help — it only backfills when microusdc IS NULL.
--
-- This redefinition derives BOTH price columns from the same computed
-- price (v_new_price) and writes them together, so they can never drift.
-- Logic is otherwise identical to 20260511000001 (curve formula, audit
-- log, grants all preserved). Idempotent: CREATE OR REPLACE.
-- =====================================================================

create or replace function admin_edit_market(
  p_market_id uuid,
  p_updates   jsonb,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_new_p0 numeric;
  v_b numeric;
  v_alpha numeric;
  v_q numeric;
  v_new_price numeric;
  v_new_price_cents bigint;
  v_new_price_microusdc bigint;
  v_actor text := case when p_actor_email is not null then 'admin:' || p_actor_email else 'admin' end;
begin
  select to_jsonb(m.*) into v_before from markets m where profile_id = p_market_id;
  if v_before is null then
    raise exception 'market_not_found' using errcode = 'P0002';
  end if;

  if p_updates ? 'b' or p_updates ? 'alpha' or p_updates ? 'fee_rate' or p_updates ? 'liquidation_threshold' then
    raise exception 'field_not_editable: b/alpha/fee_rate/liquidation_threshold are global; edit curve_params'
      using errcode = '22023';
  end if;

  if p_updates ? 'p0' and (p_updates->>'p0')::numeric <= 0 then
    raise exception 'invalid_p0' using errcode = '22023';
  end if;

  update markets set
    p0 = case when p_updates ? 'p0' then (p_updates->>'p0')::numeric else p0 end,
    frozen = case when p_updates ? 'frozen' then (p_updates->>'frozen')::boolean else frozen end,
    frozen_reason = case when p_updates ? 'frozen_reason' then p_updates->>'frozen_reason' else frozen_reason end,
    latest_tick_at = now()
  where profile_id = p_market_id
  returning p0, q into v_new_p0, v_q;

  select b, alpha into v_b, v_alpha
  from curve_params
  order by effective_at desc
  limit 1;

  if v_q >= 0 then
    v_new_price := v_new_p0 + v_b * power(v_q, v_alpha);
  else
    v_new_price := v_new_p0 - v_b * power(abs(v_q), v_alpha);
  end if;
  v_new_price := greatest(v_new_price, 0);

  -- Derive BOTH price columns from the same computed price so they cannot
  -- drift. Previously only latest_price_cents was written; the profile-read
  -- latest_price_microusdc was left stale (the bug this migration fixes).
  v_new_price_cents     := round(v_new_price * 100)::bigint;
  v_new_price_microusdc := round(v_new_price * 1000000)::bigint;

  update markets
  set latest_price_cents     = v_new_price_cents,
      latest_price_microusdc = v_new_price_microusdc
  where profile_id = p_market_id;

  select to_jsonb(m.*) into v_after from markets m where profile_id = p_market_id;

  insert into audit_log (actor, action, target_table, target_id, before, after, metadata)
  values (
    v_actor, 'market.edited', 'markets', p_market_id,
    v_before, v_after,
    jsonb_build_object('updated_keys', (select jsonb_agg(k) from jsonb_object_keys(p_updates) k))
  );

  return jsonb_build_object('ok', true, 'profile_id', p_market_id,
    'latest_price_cents', v_new_price_cents,
    'latest_price_microusdc', v_new_price_microusdc);
end;
$$;

revoke execute on function admin_edit_market(uuid, jsonb, text) from public;
grant   execute on function admin_edit_market(uuid, jsonb, text) to service_role;

comment on function admin_edit_market(uuid, jsonb, text) is
  'Admin per-market edit (p0 / frozen). Recomputes latest_price_cents AND latest_price_microusdc from the same price so the two columns never drift. Audited to audit_log. service_role only.';
