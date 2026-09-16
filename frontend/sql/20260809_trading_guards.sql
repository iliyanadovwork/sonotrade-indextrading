-- Trading guards: tradeability, slippage, and dollar-denominated orders.
--
-- DESIGN NOTE — why place_order_tx is not modified
--
-- place_order_tx is the function that replaced the double-close money printer.
-- It is correct, it is audited, and its signature is called from a live route.
-- Adding parameters to it would mean DROP + CREATE (Postgres cannot add a
-- parameter in place), and a second overload would make PostgREST ambiguous —
-- exactly the failure that currently blocks update_balance. So the guards go
-- AROUND it:
--
--   * a trigger on positions, which no write path can bypass
--   * place_order_v2, which validates then delegates
--
-- Both run inside the caller's transaction, so the price they validate is the
-- price place_order_tx then trades at.
--
-- Run in the Supabase SQL editor. Idempotent.

-- ---------------------------------------------------------------------
-- 1. Tradeability as stored state.
--
--    Derived from the price today, but a real column rather than a generated
--    one so a market can also be closed by hand (impersonators, takedowns)
--    without inventing a fake price for it.
-- ---------------------------------------------------------------------
alter table public.artists_with_history
  add column if not exists tradeable boolean not null default true,
  add column if not exists untradeable_reason text;

-- Everything currently priced is tradeable; everything unpriced is not.
update public.artists_with_history
set tradeable = false,
    untradeable_reason = 'no index value'
where current_index_value is null
  and tradeable is distinct from false;

create index if not exists idx_artists_tradeable
  on public.artists_with_history (tradeable)
  where tradeable = false;

-- ---------------------------------------------------------------------
-- 2. The guard no path can bypass.
--
--    Scoped to OPENING and INCREASING a position. Closing or reducing an
--    untradeable position must always stay possible — otherwise delisting a
--    market would trap every holder in it, which is worse than the exposure
--    the guard exists to prevent.
-- ---------------------------------------------------------------------
create or replace function public.enforce_position_tradeable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_tradeable boolean;
  v_reason    text;
  v_price     numeric;
begin
  if tg_op = 'UPDATE' and new.contracts <= old.contracts then
    return new;   -- reducing or closing: always allowed
  end if;

  select a.tradeable, a.untradeable_reason, a.current_index_value
    into v_tradeable, v_reason, v_price
  from public.artists_with_history a
  where a.spotify_id = new.spotify_id;

  if not found then
    raise exception 'artist not found: %', new.spotify_id using errcode = 'P0002';
  end if;

  if coalesce(v_tradeable, false) = false then
    raise exception 'market closed for this artist (%)', coalesce(v_reason, 'not tradeable')
      using errcode = '55000';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'market closed for this artist (price unavailable)'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_position_tradeable on public.positions;
create trigger trg_enforce_position_tradeable
  before insert or update of contracts on public.positions
  for each row
  execute function public.enforce_position_tradeable();

-- ---------------------------------------------------------------------
-- 3. Slippage guard + dollar-denominated sizing.
--
--    Sizing in contracts is what made a mispriced market dangerous: at an
--    index of 0.000053 the 1,000,000-contract ceiling was reachable for $53.
--    Sizing in dollars cannot express that bug — a bad price yields an odd
--    fractional quantity, not an unbounded position.
--
--    Both parameters are optional so this is additive: pass p_quantity and it
--    behaves exactly as before.
-- ---------------------------------------------------------------------
create or replace function public.place_order_v2(
  p_user_id         uuid,
  p_spotify_id      text,
  p_side            text,
  p_quantity        numeric default null,
  p_notional        numeric default null,
  p_expected_price  numeric default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_price numeric;
  v_qty   numeric;
begin
  if (p_quantity is null) = (p_notional is null) then
    raise exception 'pass exactly one of quantity or notional' using errcode = '22023';
  end if;

  select a.current_index_value into v_price
  from public.artists_with_history a
  where a.spotify_id = p_spotify_id;

  if v_price is null or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  -- Slippage: reject if the live price has moved more than 1% from what the
  -- user's screen showed. Without this, a price that ticks between render and
  -- submit fills at a number the user never saw.
  if p_expected_price is not null and p_expected_price > 0
     and abs(v_price - p_expected_price) * 100 > p_expected_price then
    raise exception 'price just updated — review and confirm again' using errcode = '40001';
  end if;

  if p_notional is not null then
    if p_notional <= 0 then
      raise exception 'notional must be greater than zero' using errcode = '22023';
    end if;
    -- FLOOR, not round. place_order_tx charges quantity * price, and quantity
    -- carries 2 decimals, so rounding up overshoots the amount the user asked
    -- to spend: $100 at 45.464326 rounds to 2.2 contracts and bills $100.02.
    -- Harmless there, fatal at "spend my whole balance" — the order would fail
    -- on insufficient funds for a cent the user never agreed to.
    v_qty := floor(p_notional / v_price * 100) / 100;
    if v_qty <= 0 then
      raise exception 'order too small for this price — increase the amount'
        using errcode = '22023';
    end if;
  else
    v_qty := p_quantity;
  end if;

  -- Delegates to the audited path: advisory lock, FOR UPDATE on balance and
  -- position, ledger row, sqlstate error contract. All of it still applies.
  return public.place_order_tx(p_user_id, p_spotify_id, p_side, v_qty, p_idempotency_key);
end;
$$;

revoke all on function public.place_order_v2(uuid, text, text, numeric, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.place_order_v2(uuid, text, text, numeric, numeric, numeric, text)
  to service_role;

revoke all on function public.enforce_position_tradeable() from public, anon, authenticated;
