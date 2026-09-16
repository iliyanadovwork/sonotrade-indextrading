-- One-time repair for the artists the 0.01 floor pinned at a fake price.
--
-- PREREQUISITES — in this order, or the repair is undone the next day:
--   1. 20260906_min_order_value.sql      (the $1.00 minimum order)
--   2. 20260906_index_floor_epsilon.sql  (DB floor → 0.000001)
--   3. sonotrade/index deployed with MIN_INDEX_VALUE = 0.000001
--      (the daily Action at 13:00 UTC must run the new code)
--
-- WHAT IT DOES
--
-- artist_index_history has carried monthly_listeners alongside every point
-- since 20260809_history_carries_listeners.sql, precisely so the pricing
-- formula could be re-applied. For every history row that was floored —
-- index = 0.01 while listeners / 2,000,000 is below a cent — recompute the
-- index from the stored listeners. Then recompute_artist_changes() (from
-- 20260809_change_columns_set_based.sql) resets each affected artist's
-- current_index_value and all change_* columns from the repaired history.
--
-- Rows with no stored listener count (before 2026-08-09) are left at 0.01:
-- there is nothing to derive them from, and a flat prefix is the honest
-- record of what the feed published then.
--
-- SCOPE: only rows that are exactly at the old floor with listeners that
-- put the true value under it. Every other artist and every other row is
-- untouched — the WHERE clause cannot match a value above a cent.
--
-- EFFECT ON POSITIONS: two open longs sit on pinned artists (AKRILLA 50
-- contracts, werkin 100 contracts, $1.50 total cost). They reprice to the
-- true value immediately and show a paper loss; that is the honest outcome
-- and this file deliberately does not touch positions or balances.
--
-- Run in the Supabase SQL editor. Idempotent: a second run matches no rows.

begin;

-- 1. Repair the history points.
with repaired as (
  update public.artist_index_history h
     set index = greatest(round(h.monthly_listeners / 2000000.0, 6), 0.000001)
   where h.index = 0.01
     and h.monthly_listeners is not null
     and h.monthly_listeners < 20000          -- true value < 0.01
  returning h.spotify_id
)
select count(*) as history_rows_repaired,
       count(distinct spotify_id) as artists_touched
  from repaired;

-- 2. Reprice every artist that is still pinned at the old floor from its
--    (now repaired) newest history row, and recompute its change columns.
--    recompute_artist_changes reads artist_index_history, so it must run
--    after step 1 in the same transaction.
select a.spotify_id,
       a.current_index_value as price_before,
       public.recompute_artist_changes(a.spotify_id)
  from public.artists_with_history a
 where a.current_index_value = 0.01
   and a.monthly_listeners is not null
   and a.monthly_listeners < 20000;

-- 3. Show the result. Expect every row here to be well under 0.01 and to
--    equal round(monthly_listeners / 2,000,000, 6).
select spotify_id, artist_name, monthly_listeners, current_index_value,
       round(monthly_listeners / 2000000.0, 6) as expected
  from public.artists_with_history
 where monthly_listeners is not null
   and monthly_listeners < 20000
 order by monthly_listeners desc;

commit;

-- Afterwards: GET /api/health should report no index_below_floor and no
-- price_vs_newest_history findings, and each artist above should render its
-- real price with a chart that is no longer flat.
