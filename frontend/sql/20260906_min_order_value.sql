-- Minimum order value: $1.00 on every leg that opens or adds exposure.
--
-- WHY
--
-- place_order_tx rounds the notional (price × quantity) to cents. At normal
-- prices that is noise; at sub-cent prices it is most of the trade — a
-- 0.0015 market billed $0.01 for 4 contracts is a 67% overcharge, and a
-- $1,000 balance could buy tens of millions of contracts. The 0.01 index
-- floor (20260809_min_index_value_floor.sql) was the workaround for that:
-- it kept prices out of the range where cent rounding matters, at the cost
-- of freezing every long-tail artist at a fake price. This guard addresses
-- the actual hazard, so the floor can drop to a true epsilon
-- (20260906_index_floor_epsilon.sql).
--
-- At $1.00 the cent rounding is at most 0.5% of the order. The existing
-- 1,000,000-contract cap stays, which bounds the very cheapest markets to
-- price × 1M per order.
--
-- Only exposure-OPENING legs are held to the minimum: a brand-new position,
-- an add to an existing one, and the new leg of a flip. Reducing and closing
-- are never blocked, whatever the remainder is worth — otherwise a user could
-- be stranded in a position too small to exit.
--
-- The guard raises sqlstate 22023, which /api/orders/place already maps to
-- HTTP 400 with the message shown to the user. SXTradingPanel mirrors the
-- check client-side so the message appears before submit.
--
-- This is the live body of place_order_tx (SCHEMA_SNAPSHOT.sql, 2026-08-09)
-- plus the three guards; nothing else changes. create or replace keeps the
-- function's existing ACL (20260809_function_execute_lockdown.sql) intact.
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE OR REPLACE FUNCTION public.place_order_tx(p_user_id uuid, p_spotify_id text, p_side text, p_quantity numeric, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_qty            numeric;
  v_price          numeric;
  v_artist_name    text;
  v_balance        numeric;
  v_pos            public.positions;
  v_is_long        boolean;
  v_same_side      boolean;
  v_cash_delta     numeric := 0;
  v_realized_pnl   numeric := 0;
  v_notional       numeric;
  v_qty_to_close   numeric;
  v_portion_cost   numeric;
  v_proceeds       numeric;
  v_flip_qty       numeric;
  v_flip_cost      numeric;
  v_new_contracts  numeric;
  v_new_total_cost numeric;
  v_position_id    uuid;
  v_action         text;
  v_cached         jsonb;
  v_result         jsonb;
  v_now            timestamptz := now();
begin
  -- ---- input validation -------------------------------------------------
  -- The route used `!quantity` and `quantity <= 0`, which a non-numeric
  -- value passes (NaN comparisons are false), producing NaN -> NULL and
  -- bricking the balance. Validate hard here so no caller can bypass it.
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid side: %', p_side using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric then
    raise exception 'quantity must be a number' using errcode = '22023';
  end if;

  v_qty := round(p_quantity, 2);
  if v_qty <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = '22023';
  end if;
  if v_qty > 1000000 then
    raise exception 'quantity exceeds the maximum of 1,000,000' using errcode = '22023';
  end if;

  -- ---- idempotency replay ----------------------------------------------
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  -- ---- serialise all of this user's money movement ----------------------
  -- Transaction-scoped: released automatically on commit or rollback, so a
  -- validation failure can never leave a stuck lock (the Redis lock it
  -- replaces was only released inside a narrow finally block, so every
  -- early return held it for the full TTL).
  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select balance into v_balance from public.users where id = p_user_id for update;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- ---- price: server-derived, and it must be real -----------------------
  select current_index_value, artist_name into v_price, v_artist_name
    from public.artists_with_history where spotify_id = p_spotify_id;
  if not found then
    raise exception 'artist not found' using errcode = 'P0002';
  end if;
  -- current_index_value is nullable (an artist whose data_points is empty,
  -- or whose ingest failed). The read routes all guard with `?? 0`; the
  -- trade routes did a bare parseFloat -> NaN -> NULL balance.
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  v_notional := round(v_price * v_qty, 2);
  if v_notional <= 0 then
    raise exception 'order value rounds to zero — increase the quantity' using errcode = '22023';
  end if;

  -- The partial unique index from part 1 guarantees at most one open row.
  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;

  if v_pos.id is null then
    -- ============ open a brand-new position ============
    if v_balance < v_notional then
      raise exception 'insufficient funds: need %, have %', v_notional, v_balance
        using errcode = '23514';
    end if;
    if v_notional < 1.00 then
      raise exception 'order value must be at least $1.00 (this order is $%)', v_notional
        using errcode = '22023';
    end if;
    v_cash_delta := -v_notional;
    v_action := case when p_side = 'buy' then 'open_long' else 'open_short' end;

    insert into public.positions (
      user_id, spotify_id, artist_name, position_type, contracts,
      entry_price, total_cost, status, opened_at, updated_at
    ) values (
      p_user_id, p_spotify_id, v_artist_name,
      case when p_side = 'buy' then 'long' else 'short' end,
      v_qty, v_price, v_notional, 'open', v_now, v_now
    ) returning id into v_position_id;

  else
    v_is_long   := (v_pos.position_type = 'long');
    v_same_side := (v_is_long and p_side = 'buy') or (not v_is_long and p_side = 'sell');
    v_position_id := v_pos.id;

    if v_same_side then
      -- ============ add to the existing position ============
      if v_balance < v_notional then
        raise exception 'insufficient funds: need %, have %', v_notional, v_balance
          using errcode = '23514';
      end if;
      if v_notional < 1.00 then
        raise exception 'order value must be at least $1.00 (this order is $%)', v_notional
          using errcode = '22023';
      end if;
      v_cash_delta     := -v_notional;
      v_new_contracts  := round(v_pos.contracts + v_qty, 2);
      -- Running sum of real debits. The old code recomputed this as
      -- round(avg_price * contracts), which did not equal the cash taken.
      v_new_total_cost := round(v_pos.total_cost + v_notional, 2);
      v_action := case when v_is_long then 'add_long' else 'add_short' end;

      update public.positions set
        contracts   = v_new_contracts,
        total_cost  = v_new_total_cost,
        entry_price = round(v_new_total_cost / v_new_contracts, 8),
        updated_at  = v_now
      where id = v_pos.id;

    else
      -- ============ opposite side: reduce, close, or flip ============
      v_qty_to_close := least(v_qty, v_pos.contracts);
      v_portion_cost := round(v_pos.total_cost * (v_qty_to_close / v_pos.contracts), 2);

      if v_is_long then
        -- Selling longs: receive market value for the closed portion.
        v_proceeds := round(v_price * v_qty_to_close, 2);
      else
        -- Buying back shorts: margin portion returned, adjusted by the
        -- price move, floored at zero so a runaway short cannot drive the
        -- balance negative (there is no margin engine and no liquidation
        -- job in this system).
        v_proceeds := greatest(
          0,
          round(v_portion_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_qty_to_close, 2)
        );
      end if;

      v_realized_pnl := round(v_proceeds - v_portion_cost, 2);
      v_cash_delta   := v_proceeds;

      if v_qty < v_pos.contracts then
        -- partial reduction
        v_new_contracts  := round(v_pos.contracts - v_qty_to_close, 2);
        v_new_total_cost := round(v_pos.total_cost - v_portion_cost, 2);
        v_action := case when v_is_long then 'reduce_long' else 'reduce_short' end;

        update public.positions set
          contracts   = v_new_contracts,
          total_cost  = v_new_total_cost,
          entry_price = round(v_new_total_cost / v_new_contracts, 8),
          updated_at  = v_now
        where id = v_pos.id;

      else
        -- full close (and possibly a flip)
        v_action := case when v_is_long then 'close_long' else 'close_short' end;

        update public.positions set
          status         = 'closed',
          current_price  = v_price,
          unrealized_pnl = v_realized_pnl,
          closed_at      = v_now,
          updated_at     = v_now
        where id = v_pos.id;

        if v_qty > v_pos.contracts then
          v_flip_qty  := round(v_qty - v_pos.contracts, 2);
          v_flip_cost := round(v_price * v_flip_qty, 2);
          if v_balance + v_cash_delta < v_flip_cost then
            raise exception 'insufficient funds to flip: need %, have %',
              v_flip_cost, round(v_balance + v_cash_delta, 2) using errcode = '23514';
          end if;
          if v_flip_cost < 1.00 then
            raise exception 'order value must be at least $1.00 (the new position would be $%)', v_flip_cost
              using errcode = '22023';
          end if;
          v_cash_delta := round(v_cash_delta - v_flip_cost, 2);
          v_action := case when p_side = 'buy' then 'flip_to_long' else 'flip_to_short' end;

          insert into public.positions (
            user_id, spotify_id, artist_name, position_type, contracts,
            entry_price, total_cost, status, opened_at, updated_at
          ) values (
            p_user_id, p_spotify_id, v_artist_name,
            case when p_side = 'buy' then 'long' else 'short' end,
            v_flip_qty, v_price, v_flip_cost, 'open', v_now, v_now
          ) returning id into v_position_id;
        end if;
      end if;
    end if;
  end if;

  -- ---- apply the balance change (same transaction) ----------------------
  update public.users set
    balance      = round(balance + v_cash_delta, 2),
    total_volume = coalesce(total_volume, 0) + v_notional,
    total_pnl    = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at   = v_now
  where id = p_user_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'trade would make balance negative (%)', v_balance using errcode = '23514';
  end if;

  -- ---- market volume ---------------------------------------------------
  update public.artists_with_history
     set volume = coalesce(volume, 0) + v_notional
   where spotify_id = p_spotify_id;

  -- ---- audit trail -----------------------------------------------------
  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_position_id, v_action, v_qty, v_price,
    v_cash_delta, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'action', v_action,
    'position_id', v_position_id,
    'filled_quantity', v_qty,
    'price', v_price,
    'cash_delta', v_cash_delta,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'orders/place', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $function$;

