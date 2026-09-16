-- Keep artists_with_history.current_index_value tracking the NEWEST entry in
-- data_points, no matter which writer touches the row.
--
-- Why: the daily updater (sonotrade/index) appended to data_points but never
-- wrote current_index_value, so every consumer of the column — place_order_tx
-- (trade pricing!), the betslip live PnL, /api/artist, discover/trade sort
-- orders — served prices frozen at import time while the charts (which read
-- data_points) kept moving. The updater is fixed to write the column, and the
-- frontend list route writes it on insert; this trigger is the backstop that
-- makes the invariant hold regardless of writer.
--
-- Run in the Supabase SQL editor. Idempotent.

create or replace function public.sync_current_index_value()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_last jsonb;
begin
  if new.data_points is not null
     and jsonb_typeof(new.data_points) = 'array'
     and jsonb_array_length(new.data_points) > 0 then
    v_last := new.data_points -> -1;
    if v_last ? 'index' then
      begin
        new.current_index_value := (v_last ->> 'index')::numeric;
      exception when others then
        -- Malformed index value in the newest point: keep whatever the writer
        -- set rather than failing the whole write.
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;

-- INSERT: always derive from the seeded data_points.
drop trigger if exists trg_sync_current_index_value_ins on public.artists_with_history;
create trigger trg_sync_current_index_value_ins
  before insert on public.artists_with_history
  for each row
  execute function public.sync_current_index_value();

-- UPDATE: only when data_points actually changed — a manual correction that
-- touches current_index_value alone must not be clobbered by the trigger.
drop trigger if exists trg_sync_current_index_value_upd on public.artists_with_history;
create trigger trg_sync_current_index_value_upd
  before update of data_points on public.artists_with_history
  for each row
  when (old.data_points is distinct from new.data_points)
  execute function public.sync_current_index_value();

-- One-time repair for rows that drifted before the trigger existed. (Already
-- applied via script on 2026-08-05; harmless to re-run.)
update public.artists_with_history
set current_index_value = (data_points -> -1 ->> 'index')::numeric
where jsonb_typeof(data_points) = 'array'
  and jsonb_array_length(data_points) > 0
  and (data_points -> -1 ->> 'index') ~ '^[0-9]+\.?[0-9]*$'
  and current_index_value is distinct from (data_points -> -1 ->> 'index')::numeric;
