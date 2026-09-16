-- Move the chart RPCs off the data_points jsonb and onto artist_index_history.
--
-- The signatures, window vocabulary ('1h','24h','7d','30d','all') and output
-- shape ({price, timestamp}) are all preserved exactly, so no route, hook or
-- component changes. Only the source of the rows changes.
--
-- Measured before this file (pg_stat_statements, 2026-08-09):
--   artist_history_batch   666 ms mean over 1,257 calls
-- Every call detoasted and parsed each artist's entire data_points array — up
-- to 1,253 elements — to return at most 240 points.
--
-- Safe to make now because 20260809_index_history_sync.sql reconciled the
-- table to data_points exactly (667,713 = 667,713) and keeps it there via
-- trg_append_index_history.
--
-- Run in the Supabase SQL editor. Idempotent.

-- ---------------------------------------------------------------------
-- The shared implementation, batched by design: one pass over the table
-- for every requested artist, rather than one call per artist.
--
-- Bucketing mirrors _artist_history_points exactly — same cutoffs, same
-- bucket widths, same "last point wins per bucket", same 240-point cap and
-- the same adaptive bucket for the unbounded 'all' window — so an existing
-- chart redraws identically.
-- ---------------------------------------------------------------------
create or replace function public._artist_history_points_v2(
  p_spotify_ids text[],
  p_window text
)
returns table(spotify_id text, points jsonb)
language sql
stable
parallel safe
set search_path to 'public', 'pg_catalog'
as $$
  with cfg as (
    select
      case p_window
        when '1h'  then now() - interval '1 hour'
        when '24h' then now() - interval '24 hours'
        when '7d'  then now() - interval '7 days'
        when '30d' then now() - interval '30 days'
        else null::timestamptz
      end as cutoff,
      case p_window
        when '1h'  then 30000::bigint      -- 30 s
        when '24h' then 900000::bigint     -- 15 min
        when '7d'  then 3600000::bigint    -- 1 h
        when '30d' then 14400000::bigint   -- 4 h
        else 3600000::bigint               -- 'all' -> 1 h floor
      end as bucket_ms
  ),
  windowed as (
    select h.spotify_id, h.ts, h.index::float8 as price
    from public.artist_index_history h
    cross join cfg
    where h.spotify_id = any(p_spotify_ids)
      and (cfg.cutoff is null or h.ts >= cfg.cutoff)
  ),
  span as (
    select w.spotify_id,
           count(*) as n,
           extract(epoch from min(w.ts)) * 1000 as t0_ms,
           extract(epoch from max(w.ts)) * 1000 as t1_ms
    from windowed w
    group by w.spotify_id
  ),
  eff as (
    select s.spotify_id, s.n,
           case
             when cfg.cutoff is null
               then greatest(cfg.bucket_ms, ceil((s.t1_ms - s.t0_ms) / 240)::bigint)
             else cfg.bucket_ms
           end as bucket_ms
    from span s cross join cfg
  ),
  ranked as (
    select w.spotify_id, w.ts, w.price, e.n,
           row_number() over (
             partition by w.spotify_id,
                          floor(extract(epoch from w.ts) * 1000 / e.bucket_ms)
             order by w.ts desc
           ) as rn
    from windowed w
    join eff e on e.spotify_id = w.spotify_id
  ),
  sampled as (
    select r.spotify_id, r.ts, r.price
    from ranked r
    where r.n <= 240 or r.rn = 1     -- downsample only past the cap, as before
  )
  select s.spotify_id,
         jsonb_agg(
           -- to_json on a timestamptz emits ISO-8601 with the 'T' separator,
           -- matching the strings data_points stored. A bare ::text would give
           -- '2026-08-03 02:47:34+00', which not every JS engine parses.
           jsonb_build_object('price', s.price, 'timestamp', to_json(s.ts) #>> '{}')
           order by s.ts asc
         )
  from sampled s
  group by s.spotify_id;
$$;

-- ---------------------------------------------------------------------
-- Same names, same signatures, same return types — only the body changes.
-- ---------------------------------------------------------------------
create or replace function public.artist_history(
  p_spotify_id text,
  p_window text default 'all'
)
returns jsonb
language sql
stable
parallel safe
set search_path to 'public', 'pg_catalog'
as $$
  select coalesce(
    (select p.points
       from public._artist_history_points_v2(array[p_spotify_id], p_window) p
      limit 1),
    -- No history yet (a market listed today): one synthetic point at the
    -- current price, so a fresh chart draws a flat line instead of nothing.
    (select jsonb_build_array(jsonb_build_object(
              'price', a.current_index_value::float8,
              'timestamp', to_json(now()) #>> '{}'))
       from public.artists_with_history a
      where a.spotify_id = p_spotify_id
        and a.current_index_value is not null),
    '[]'::jsonb
  );
$$;

create or replace function public.artist_history_batch(
  p_spotify_ids text[],
  p_window text default '30d'
)
returns table(spotify_id text, points jsonb)
language sql
stable
parallel safe
set search_path to 'public', 'pg_catalog'
as $$
  select p.spotify_id, p.points
  from public._artist_history_points_v2(p_spotify_ids, p_window) p;
$$;

-- The helper is not SECURITY DEFINER, so the caller's own EXECUTE is checked
-- when artist_history invokes it. Default privileges now revoke EXECUTE from
-- PUBLIC (20260809_function_execute_lockdown.sql), so grant it explicitly.
revoke all on function public._artist_history_points_v2(text[], text) from public;
grant execute on function public._artist_history_points_v2(text[], text) to anon, authenticated, service_role;
