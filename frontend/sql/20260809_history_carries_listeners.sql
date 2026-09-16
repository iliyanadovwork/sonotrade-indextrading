-- Make price history re-derivable: store the input alongside the output.
--
-- THE PROBLEM
--
-- artist_index_history stores the derived index and nothing else, and
-- artist_daily_streams stores the derived index keyed by artist_name. Neither
-- records what Spotify actually reported. So the pricing formula
-- (monthly_listeners / 2,000,000, floored at 0.01) can never be changed
-- retroactively — a new formula could only be applied going forward, leaving a
-- permanent discontinuity in every chart. TappedIn hit this twice and could
-- reconcile only because its history points carry followers and
-- monthly_listeners.
--
-- WHY NOT A RAW PAYLOAD TABLE
--
-- The plan called for an artist_metrics_raw equivalent: the whole Apify
-- response, retained and purged on a schedule. Measured first: the average
-- artists_with_history row is 17 kB, so a full daily dump is 42 MB/day and
-- 1.2 GB at 30-day retention. Two bigint columns on the history table cost
-- ~16 bytes per point — about 10 MB for all 656,915 existing rows, growing
-- ~40 kB a day — and deliver the whole stated benefit, which is re-derivability
-- rather than forensics. If full-payload retention is wanted later for
-- debugging, it should be a deliberate decision about a gigabyte, not a side
-- effect of this one.
--
-- Run in the Supabase SQL editor. Idempotent.

alter table public.artist_index_history
  add column if not exists monthly_listeners bigint,
  add column if not exists followers bigint;

comment on column public.artist_index_history.monthly_listeners is
  'Spotify monthly listeners as reported when this point was written. The input the index was derived from, so a formula change can be replayed over history.';

-- ---------------------------------------------------------------------
-- The trigger already runs inside the same UPDATE that sets
-- artists_with_history.monthly_listeners and .followers, so NEW carries the
-- fresh values — no extra lookup, no second write.
-- ---------------------------------------------------------------------
create or replace function public.append_index_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last jsonb;
begin
  if new.data_points is null
     or jsonb_typeof(new.data_points) <> 'array'
     or jsonb_array_length(new.data_points) = 0 then
    return null;
  end if;

  v_last := new.data_points -> -1;
  if v_last is null or not (v_last ? 'index') or not (v_last ? 'timestamp') then
    return null;
  end if;

  begin
    insert into public.artist_index_history (
      spotify_id, ts, index, monthly_listeners, followers
    )
    values (
      new.spotify_id,
      (v_last ->> 'timestamp')::timestamptz,
      (v_last ->> 'index')::numeric,
      new.monthly_listeners,
      new.followers
    )
    on conflict (spotify_id, ts) do update
      set index = excluded.index,
          -- coalesce, not overwrite: a later writer that does not know the
          -- listener count must not erase one already recorded.
          monthly_listeners = coalesce(excluded.monthly_listeners, public.artist_index_history.monthly_listeners),
          followers         = coalesce(excluded.followers, public.artist_index_history.followers);
  exception when others then
    -- A malformed tail point must never fail the artist write.
    null;
  end;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Backfill what is knowable. artists_with_history holds only the CURRENT
-- listener count, so only each artist's newest point can be filled in —
-- everything older is unrecoverable, which is the cost of not having stored it.
-- ---------------------------------------------------------------------
update public.artist_index_history h
set monthly_listeners = a.monthly_listeners,
    followers = a.followers
from public.artists_with_history a
where a.spotify_id = h.spotify_id
  and h.monthly_listeners is null
  and h.ts = (
    select max(h2.ts) from public.artist_index_history h2
    where h2.spotify_id = h.spotify_id
  );
