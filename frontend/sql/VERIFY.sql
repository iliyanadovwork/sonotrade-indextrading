-- =====================================================================
-- Did the hardening script actually apply? Run this after
-- 20260804_hardening_ALL.sql. Every row should read PRESENT / ON.
-- Read-only: changes nothing.
-- =====================================================================

select 'SECTION 2 · table trade_ledger' as check,
       case when to_regclass('public.trade_ledger') is not null
            then 'PRESENT' else 'MISSING — section 2 did not run' end as status
union all
select 'SECTION 2 · table idempotency_keys',
       case when to_regclass('public.idempotency_keys') is not null
            then 'PRESENT' else 'MISSING — section 2 did not run' end
union all
select 'SECTION 2 · function place_order_tx',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname = 'place_order_tx')
            then 'PRESENT' else 'MISSING — trades will fail with 500' end
union all
select 'SECTION 2 · function close_position_tx',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname = 'close_position_tx')
            then 'PRESENT' else 'MISSING — closes will fail with 500' end
union all
select 'SECTION 4 · table artist_index_history',
       case when to_regclass('public.artist_index_history') is not null
            then 'PRESENT' else 'MISSING — section 4 did not run' end
union all
select 'SECTION 4 · artist_index_history RLS',
       coalesce((select case when relrowsecurity then 'ON' else 'OFF — anon can write the price series' end
                   from pg_class where oid = to_regclass('public.artist_index_history')),
                'n/a (table absent)')
union all
-- Section 1: the constraint that makes double-close and negative balances
-- impossible at the database layer.
select 'SECTION 1 · users.balance >= 0 constraint',
       case when exists (select 1 from pg_constraint
                          where conname = 'users_balance_non_negative')
            then 'PRESENT' else 'MISSING' end
union all
select 'SECTION 1 · positions.status accepts liquidated',
       case when exists (select 1 from pg_constraint
                          where conname = 'positions_status_check'
                            and pg_get_constraintdef(oid) ilike '%liquidated%')
            then 'PRESENT' else 'MISSING — short liquidations will fail' end
union all
select 'SECTION 1 · one-open-position-per-artist index',
       case when to_regclass('public.positions_one_open_per_user_artist_idx') is not null
            then 'PRESENT' else 'MISSING — check for a SKIPPED notice (duplicate open positions)' end
union all
select 'SECTION 1 · comments.like_count column',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'comments'
                            and column_name = 'like_count')
            then 'PRESENT' else 'MISSING' end
union all
select 'SECTION 1 · pg_trgm search index',
       case when to_regclass('public.artists_with_history_name_trgm_idx') is not null
            then 'PRESENT' else 'MISSING — search stays a full table scan' end
union all
select 'SECTION 1 · positions user/status index',
       case when to_regclass('public.positions_user_status_opened_idx') is not null
            then 'PRESENT' else 'MISSING' end
union all
select 'SECTION 1 · comment_likes uniqueness',
       case when to_regclass('public.comment_likes_unique_idx') is not null
            then 'PRESENT' else 'MISSING — likes remain inflatable' end
union all
select 'SECTION 1 · duplicate index dropped',
       case when to_regclass('public.idx_artists_index_value') is null
            then 'PRESENT (dropped)' else 'STILL THERE — double write cost per ingest' end
order by 1;


-- Index count on the tables section 1 targets. Expect roughly 27+ once
-- applied (this counts pre-existing ones too).
select count(*) as indexes_on_hardened_tables
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('positions','comments','comment_likes','feed_posts',
                     'feed_post_likes','feed_post_comments',
                     'feed_post_comment_likes','artists_with_history',
                     'artist_daily_streams');


-- Any public table still without RLS. Should return zero rows.
select c.relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;


-- Backfill sanity for section 4. The two numbers should be close; a large
-- shortfall means malformed points were skipped.
select (select count(*) from public.artist_index_history) as history_rows,
       (select sum(jsonb_array_length(coalesce(data_points, '[]'::jsonb)))
          from public.artists_with_history) as jsonb_points;
