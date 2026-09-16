-- Server-side windowing + downsampling of artists_with_history.data_points.
--
-- Apply MANUALLY via the Supabase SQL editor (project zvgsjbphobukppeyymfp).
-- DO NOT put this under frontend/supabase/migrations/ — that directory belongs
-- to a dead prior product and `supabase db push` against this project would be
-- destructive.
--
-- Semantics mirror app/api/markets/[ticker]/history/route.ts:
--   windows: 1h/24h/7d/30d/all; buckets: 30s/15m/1h/4h;
--   downsample only when >240 points; keep LAST point per bucket; asc order;
--   fallback to a single current_index_value point when the window is empty.
-- 'all' uses an ADAPTIVE bucket — max(1h, span/240) — so the output is always
-- ~<=240 points. A fixed 1h bucket never reduced daily-cadence data (1,192
-- points for a 3-year artist), defeating the downsample's purpose.

-- Core helper: operates on a jsonb array passed by value, so the batch variant
-- evaluates artists_with_history exactly once per artist.
create or replace function public._artist_history_points(
  p_data          jsonb,
  p_current_index float8,
  p_window        text
)
returns jsonb
language sql
stable
parallel safe
set search_path = public
as $$
with cfg as (
  select
    case p_window
      when '1h'  then now() - interval '1 hour'
      when '24h' then now() - interval '24 hours'
      when '7d'  then now() - interval '7 days'
      when '30d' then now() - interval '30 days'
      else null::timestamptz                          -- 'all' or anything else
    end as cutoff,
    case p_window
      when '1h'  then 30000::bigint                   -- 30 s
      when '24h' then 900000::bigint                  -- 15 min
      when '7d'  then 3600000::bigint                 -- 1 h
      when '30d' then 14400000::bigint                -- 4 h
      else 3600000::bigint                            -- 'all' -> 1 h
    end as bucket_ms
),
pts as (
  select
    (e.dp->>'index')::float8          as price,       -- float8 = JS Number semantics
    e.dp->>'timestamp'                as ts_raw,      -- re-emitted verbatim (byte parity with JS)
    (e.dp->>'timestamp')::timestamptz as ts,
    e.ord
  from jsonb_array_elements(coalesce(p_data, '[]'::jsonb))
       with ordinality as e(dp, ord)
  where ( jsonb_typeof(e.dp->'index') = 'number'
          or e.dp->>'index' ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$' )
    and e.dp->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}'
),
windowed as (
  select p.* from pts p cross join cfg
  where cfg.cutoff is null or p.ts >= cfg.cutoff
),
span as (
  select count(*)                                        as n,
         extract(epoch from min(ts)) * 1000              as t0_ms,
         extract(epoch from max(ts)) * 1000              as t1_ms
  from windowed
),
eff as (
  -- Fixed windows are bounded by construction (<=180 buckets). 'all' spans
  -- arbitrary history, so its bucket adapts: span/240, floored at 1h.
  select case
    when cfg.cutoff is null
      then greatest(cfg.bucket_ms, ceil((s.t1_ms - s.t0_ms) / 240)::bigint)
    else cfg.bucket_ms
  end as bucket_ms
  from cfg cross join span s
),
ranked as (
  -- rn=1 marks the LAST point per time bucket (max ts, ties -> later array
  -- index), matching the JS Map-overwrite downsample. n = points in window.
  select w.*,
         s.n,
         row_number() over (
           partition by floor(extract(epoch from w.ts) * 1000 / e.bucket_ms)
           order by w.ts desc, w.ord desc
         ) as rn
  from windowed w cross join span s cross join eff e
),
sampled as (
  select price, ts_raw, ts, ord
  from ranked
  where n <= 240 or rn = 1          -- JS: downsample only when length > 240
)
select case
  when exists (select 1 from sampled) then
    (select jsonb_agg(jsonb_build_object('price', price, 'timestamp', ts_raw)
                      order by ts asc, ord asc)
       from sampled)
  when p_current_index is not null then
    jsonb_build_array(jsonb_build_object(
      'price',     p_current_index,
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  else '[]'::jsonb
end
$$;

-- Single artist. Returns the JSON array the route passes straight through.
-- Returns SQL NULL when the artist doesn't exist (route maps null -> []).
create or replace function public.artist_history(
  p_spotify_id text,
  p_window     text default 'all'
)
returns jsonb
language sql
stable
parallel safe
set search_path = public
as $$
  select public._artist_history_points(a.data_points, a.current_index_value::float8, p_window)
  from artists_with_history a
  where a.spotify_id = p_spotify_id
  limit 1
$$;

-- Batch (sparklines). One evaluation of artists_with_history per artist.
create or replace function public.artist_history_batch(
  p_spotify_ids text[],
  p_window      text default '30d'
)
returns table (spotify_id text, points jsonb)
language sql
stable
parallel safe
set search_path = public
as $$
  select a.spotify_id,
         public._artist_history_points(a.data_points, a.current_index_value::float8, p_window)
  from artists_with_history a
  where a.spotify_id = any(p_spotify_ids)
$$;

grant execute on function public._artist_history_points(jsonb, float8, text) to anon, authenticated, service_role;
grant execute on function public.artist_history(text, text)                  to anon, authenticated, service_role;
grant execute on function public.artist_history_batch(text[], text)          to anon, authenticated, service_role;

-- CONDITIONAL — run ONLY if artists_with_history is a real table.
-- Check first:
--   select relkind from pg_class where relname = 'artists_with_history';
-- 'r' = table -> run the index; 'v'/'m' = view -> skip (cannot index).
-- create unique index if not exists artists_with_history_spotify_id_idx
--   on public.artists_with_history (spotify_id);
