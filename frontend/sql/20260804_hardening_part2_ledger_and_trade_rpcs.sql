-- =====================================================================
-- Sonotrade hardening — PART 2: trade ledger, idempotency, and the two
-- transactional RPCs that replace the racy multi-REST-call trade paths.
--
-- Apply via the Supabase SQL editor, AFTER part 1.
--
-- WHY THIS EXISTS
-- The previous flow read the balance, computed in JS, then issued three
-- INDEPENDENT Supabase REST calls (each its own transaction) via
-- Promise.all, discarding the positions-write error entirely. That allowed:
--   * double-close: N concurrent closes all saw status='open' and all
--     credited the balance (the UPDATE filtered on id only);
--   * balance double-spend: two orders both read the same balance and both
--     passed the funds check;
--   * torn writes: balance debited with no position created, returning 200;
--   * rounding drift: total_cost was re-derived from a rounded average
--     instead of being the sum of actual debits, minting ~1c per cycle.
--
-- Both functions below take a per-user transaction-scoped advisory lock,
-- re-read the balance and position FOR UPDATE, and perform every write in
-- one transaction. If anything raises, the whole trade rolls back.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. APPEND-ONLY TRADE LEDGER
--    Previously nothing recorded a balance change: partial reductions
--    wrote no history row at all, and the order id returned to the client
--    was a throwaway randomUUID() never persisted. Without this table a
--    balance can never be reconciled or repaired after an incident.
-- ---------------------------------------------------------------------
create table if not exists public.trade_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id),
  spotify_id     text references public.artists_with_history(spotify_id),
  position_id    uuid references public.positions(id),
  action         text not null,
  quantity       numeric not null check (quantity > 0),
  price          numeric not null check (price > 0),
  cash_delta     numeric not null,              -- signed change to users.balance
  realized_pnl   numeric not null default 0,
  balance_after  numeric not null,
  idempotency_key text,
  created_at     timestamptz not null default now()
);

create index if not exists trade_ledger_user_created_idx
  on public.trade_ledger (user_id, created_at desc);
create index if not exists trade_ledger_spotify_created_idx
  on public.trade_ledger (spotify_id, created_at desc);


-- ---------------------------------------------------------------------
-- 2. IDEMPOTENCY
--    A network retry, a double-tap on the trade slider, or a platform
--    lambda retry previously executed the trade twice.
-- ---------------------------------------------------------------------
create table if not exists public.idempotency_keys (
  key        text primary key,
  user_id    uuid,
  endpoint   text not null,
  response   jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idempotency_keys_expires_idx
  on public.idempotency_keys (expires_at);


-- ---------------------------------------------------------------------
-- 3. HARDEN update_balance
--    The original was SECURITY DEFINER with NO pinned search_path (the
--    classic privilege-escalation vector) and did a blind
--    `balance = balance + p_amount` with no floor and no NULL guard — so
--    passing NULL set the balance to NULL permanently.
--    Kept for compatibility; the RPCs below do not use it.
-- ---------------------------------------------------------------------
create or replace function public.update_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new numeric;
begin
  if p_amount is null or p_amount = 'NaN'::numeric then
    raise exception 'update_balance: amount must be a real number (got %)', p_amount
      using errcode = '22023';
  end if;

  update public.users
     set balance = round(balance + p_amount, 2),
         updated_at = now()
   where id = p_user_id
  returning balance into v_new;

  if not found then
    raise exception 'update_balance: user % not found', p_user_id using errcode = 'P0002';
  end if;
  if v_new < 0 then
    raise exception 'update_balance: would make balance negative (%).', v_new
      using errcode = '23514';
  end if;
  return v_new;
end $$;

revoke all on function public.update_balance(uuid, numeric) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. PLACE ORDER — single transaction, per-user lock, exact accounting
--
--    Accounting rule: total_cost is ALWAYS the running sum of actual cash
--    debited, never re-derived from a rounded average price. entry_price
--    is a derived display value (total_cost / contracts). Because of that,
--    a full close credits exactly round(price * contracts, 2) and nothing
--    is minted or destroyed by rounding.
-- ---------------------------------------------------------------------
create or replace function public.place_order_tx(
  p_user_id         uuid,
  p_spotify_id      text,
  p_side            text,
  p_quantity        numeric,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
end $$;

revoke all on function public.place_order_tx(uuid, text, text, numeric, text) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. CLOSE POSITION — the double-close fix
--    The old route SELECTed with status='open' but then UPDATEd filtering
--    on id alone, never checking the row count, while crediting the
--    balance in a parallel call. Ten concurrent requests credited ten
--    times. Here the row is taken FOR UPDATE inside the same transaction
--    as the credit, and the UPDATE re-asserts status='open', so the
--    second caller finds nothing to close.
-- ---------------------------------------------------------------------
create or replace function public.close_position_tx(
  p_user_id         uuid,
  p_spotify_id      text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos          public.positions;
  v_price        numeric;
  v_proceeds     numeric;
  v_realized_pnl numeric;
  v_balance      numeric;
  v_rows         integer;
  v_cached       jsonb;
  v_result       jsonb;
  v_now          timestamptz := now();
begin
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;
  if v_pos.id is null then
    raise exception 'no open position found' using errcode = 'P0002';
  end if;

  select current_index_value into v_price
    from public.artists_with_history where spotify_id = p_spotify_id;
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  if v_pos.position_type = 'long' then
    v_proceeds := round(v_price * v_pos.contracts, 2);
  else
    v_proceeds := greatest(
      0,
      round(v_pos.total_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_pos.contracts, 2)
    );
  end if;
  v_realized_pnl := round(v_proceeds - v_pos.total_cost, 2);

  -- Re-asserting status='open' is what makes a concurrent double-close
  -- impossible even if the advisory lock were removed.
  update public.positions set
    -- 'liquidated' when the short floor bound and the whole margin was
    -- lost. Nothing in the codebase ever wrote this status before, even
    -- though /api/trades/history reads it.
    status         = case
                       when v_pos.position_type = 'short' and v_proceeds = 0 then 'liquidated'
                       else 'closed'
                     end,
    current_price  = v_price,
    unrealized_pnl = v_realized_pnl,
    closed_at      = v_now,
    updated_at     = v_now
  where id = v_pos.id and status = 'open';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'position already closed' using errcode = '40001';
  end if;

  update public.users set
    balance    = round(balance + v_proceeds, 2),
    total_pnl  = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at = v_now
  where id = p_user_id
  returning balance into v_balance;

  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_pos.id,
    case when v_pos.position_type = 'long' then 'close_long' else 'close_short' end,
    v_pos.contracts, v_price, v_proceeds, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'position_id', v_pos.id,
    'contracts', v_pos.contracts,
    'price', v_price,
    'proceeds', v_proceeds,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'trades/close', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $$;

revoke all on function public.close_position_tx(uuid, text, text) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. increment_artist_volume — referenced by the old code path but not
--    defined in any SQL file in the repo. Created here so the fallback
--    cannot 500, though place_order_tx now updates volume inline.
-- ---------------------------------------------------------------------
create or replace function public.increment_artist_volume(p_spotify_id text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 0 then
    return;
  end if;
  update public.artists_with_history
     set volume = coalesce(volume, 0) + p_amount
   where spotify_id = p_spotify_id;
end $$;

revoke all on function public.increment_artist_volume(text, numeric) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Housekeeping: expire idempotency keys. Run from pg_cron if available.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_idempotency_keys()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.idempotency_keys where expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- select cron.schedule('purge-idempotency', '17 * * * *',
--   $$select public.purge_expired_idempotency_keys()$$);

commit;
