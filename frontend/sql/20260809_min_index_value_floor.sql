-- Floor artists_with_history.current_index_value at 0.01, whatever the writer.
--
-- Why: the daily updater (sonotrade/index) computed
-- `index = monthly_listeners / 2_000_000` with no lower bound, so long-tail
-- artists were published at a sub-cent price — Laufey Soffía (105 monthly
-- listeners) sat at 0.000053. place_order_tx derives the trade price from this
-- column, so a $1,000 paper balance bought ~19 MILLION contracts of that
-- market. An index may crash; it must never approach zero, because every
-- consumer divides by it.
--
-- The updater now clamps at 0.01 (sonotrade/index @ 92c6a8c), and so do the
-- frontend's own writers (`seedIndexFromListeners`, /api/artists/refresh,
-- scraper/src/index-math.ts). This trigger is the backstop that holds the
-- invariant regardless of which writer — or which repo — touches the row.
--
-- Run in the Supabase SQL editor. Idempotent.

create or replace function public.clamp_current_index_value()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_index_value is not null and new.current_index_value < 0.01 then
    new.current_index_value := 0.01;
  end if;
  return new;
end;
$$;

-- Trigger NAMES matter here. Postgres fires BEFORE row triggers in alphabetical
-- order, and `trg_sync_current_index_value_*` (20260805_sync_current_index_value
-- .sql) rewrites current_index_value from data_points -> -1. The clamp must run
-- AFTER that, or a sub-cent tail point would be re-published unfloored. Hence
-- the `zz_` prefix — do not rename these to sort earlier.
drop trigger if exists trg_zz_clamp_current_index_value_ins on public.artists_with_history;
create trigger trg_zz_clamp_current_index_value_ins
  before insert on public.artists_with_history
  for each row
  execute function public.clamp_current_index_value();

-- Unqualified `before update` (not `of current_index_value`): the sync trigger
-- can set the column on a data_points-only write, and that path needs flooring
-- just as much as a direct write does.
drop trigger if exists trg_zz_clamp_current_index_value_upd on public.artists_with_history;
create trigger trg_zz_clamp_current_index_value_upd
  before update on public.artists_with_history
  for each row
  execute function public.clamp_current_index_value();

-- One-time repair for rows written before the floor existed. (Already applied
-- via PostgREST on 2026-08-09 — two rows, neither with an open position;
-- harmless to re-run.)
update public.artists_with_history
set current_index_value = 0.01
where current_index_value is not null
  and current_index_value < 0.01;

-- NOTE: this floors the tradeable price only, not the historical `data_points`
-- entries behind it. Charts for the two repaired artists still show their
-- sub-cent past, which is the honest record of what the feed published.
