-- Cross-check every pair of independently-stored numbers that must agree.
--
-- Modelled on TappedIn's get_number_invariant_violations(). Sonotrade is
-- better set up for this than TappedIn is: trade_ledger records balance_after
-- and realized_pnl on every row, so cash reconciles directly instead of being
-- reconstructed from an assumed starting balance.
--
-- Every check below was run against production before being written in, and
-- every one returned zero rows. That matters: a check that has never been
-- green is indistinguishable from a check that is wrong, and the first
-- violation it reports would be argued with rather than fixed.
--
-- Empty result = healthy. Call it from the daily feed and alert on any row.
--
-- Run in the Supabase SQL editor. Idempotent.

create or replace function public.sonotrade_invariants()
returns table(check_name text, entity text, detail text)
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  -- 1. Cash must equal the ledger's own running balance. place_order_tx and
  --    close_position_tx both stamp balance_after; if users.balance has drifted
  --    from it, something wrote a balance outside the trade RPCs.
  select 'balance_vs_ledger'::text,
         coalesce(u.username, u.id::text)::text,
         ('balance=' || u.balance || ' last_ledger_balance_after=' || l.balance_after)::text
  from public.users u
  join lateral (
    select t.balance_after
    from public.trade_ledger t
    where t.user_id = u.id
    order by t.created_at desc, t.id desc
    limit 1
  ) l on true
  where abs(u.balance - l.balance_after) > 0.005

  union all
  -- 2. An open position's size must equal the signed sum of its ledger rows.
  --    Action vocabulary is open_long/open_short/add_long/add_short (increase)
  --    and close_*/reduce_* (decrease) — read off the live table, not guessed.
  select 'position_qty_vs_ledger',
         p.spotify_id,
         'contracts=' || p.contracts || ' ledger_qty=' || coalesce(x.qty, 0)
  from public.positions p
  left join lateral (
    select sum(case
                 when t.action like 'open%' or t.action like 'add%'    then t.quantity
                 when t.action like 'close%' or t.action like 'reduce%' then -t.quantity
                 else 0
               end) as qty
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.contracts - coalesce(x.qty, 0)) > 0.005

  union all
  -- 3. total_cost is the running sum of cash actually debited — never an
  --    average price multiplied back out. That recomputation is exactly where
  --    the pre-hardening rounding drift came from.
  select 'total_cost_vs_cash_debited',
         p.spotify_id,
         'total_cost=' || p.total_cost || ' cash_out=' || round(-coalesce(x.cash, 0), 2)
  from public.positions p
  left join lateral (
    select sum(t.cash_delta) as cash
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.total_cost + coalesce(x.cash, 0)) > 0.02

  union all
  -- 4. The balance CHECK constraint is NOT VALID on this table, so it is not
  --    enforced for pre-existing rows. Verify rather than assume.
  select 'negative_balance',
         coalesce(u.username, u.id::text),
         'balance=' || u.balance
  from public.users u
  where u.balance < 0

  union all
  -- 5. The 0.01 floor, checked rather than trusted. Three separate things now
  --    enforce it (the poller, poller_ingest, and trg_zz_clamp_*); this is what
  --    notices if all three are bypassed.
  select 'index_below_floor',
         a.spotify_id,
         'current_index_value=' || a.current_index_value
  from public.artists_with_history a
  where a.current_index_value is not null
    and a.current_index_value < 0.01

  union all
  -- 6. An open position on a market with no usable price cannot be closed:
  --    close_position_tx raises 55000 and the user is stuck holding it.
  select 'open_position_unpriced',
         p.spotify_id,
         'position=' || p.id || ' price=' || coalesce(a.current_index_value::text, 'null')
  from public.positions p
  join public.artists_with_history a on a.spotify_id = p.spotify_id
  where p.status = 'open'
    and (a.current_index_value is null or a.current_index_value <= 0)

  union all
  -- 7. At most one open position per user per artist. A partial unique index
  --    from hardening part 1 is supposed to guarantee this, and close_position_tx
  --    resolves a position by spotify_id on that assumption — so if the index
  --    is not actually live, closes would hit the wrong row.
  select 'duplicate_open_position',
         p.spotify_id,
         'user=' || p.user_id || ' open_rows=' || count(*)
  from public.positions p
  where p.status = 'open'
  group by p.user_id, p.spotify_id
  having count(*) > 1

  union all
  -- 8. The tradeable price and the newest charted point must agree. They are
  --    written by the same statement in poller_ingest, so a divergence means
  --    another writer moved one without the other.
  select 'price_vs_newest_history',
         a.spotify_id,
         'current=' || a.current_index_value || ' newest_point=' || h.index
  from public.artists_with_history a
  join lateral (
    select h2.index
    from public.artist_index_history h2
    where h2.spotify_id = a.spotify_id
    order by h2.ts desc
    limit 1
  ) h on true
  where a.current_index_value is not null
    and abs(a.current_index_value - h.index) > greatest(0.01, a.current_index_value * 0.05);
$$;

revoke all on function public.sonotrade_invariants() from public, anon, authenticated;
grant execute on function public.sonotrade_invariants() to service_role;
