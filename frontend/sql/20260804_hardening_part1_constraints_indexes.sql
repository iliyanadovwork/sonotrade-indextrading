-- =====================================================================
-- Sonotrade hardening — PART 1: constraints, indexes, dedupe
-- Apply via the Supabase SQL editor (the live schema is not managed by
-- `supabase db push` in this project).
--
-- Run PART 1 first, then PART 2 (ledger + RPCs), then PART 3 (RLS).
-- Every statement is idempotent and safe to re-run.
--
-- Read the PRE-FLIGHT section before running: three of the unique indexes
-- will fail if duplicate data already exists, and the dedupe for those is
-- deliberately NOT automatic where it would destroy user data.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. PRE-FLIGHT: report data that will block the unique indexes below.
--    These raise NOTICEs; they do not change anything.
-- ---------------------------------------------------------------------
do $$
declare
  v_dupe_emails int;
  v_dupe_usernames int;
  v_dupe_open_positions int;
begin
  select count(*) into v_dupe_emails from (
    select lower(email) from public.users group by lower(email) having count(*) > 1
  ) d;

  select count(*) into v_dupe_usernames from (
    select lower(username) from public.users group by lower(username) having count(*) > 1
  ) d;

  select count(*) into v_dupe_open_positions from (
    select user_id, spotify_id from public.positions
    where status = 'open' group by user_id, spotify_id having count(*) > 1
  ) d;

  if v_dupe_emails > 0 then
    raise notice 'PRE-FLIGHT: % email(s) differ only by case. The lower(email) unique index at the end of this file is commented out; merge these accounts manually first.', v_dupe_emails;
  end if;
  if v_dupe_usernames > 0 then
    raise notice 'PRE-FLIGHT: % username(s) differ only by case. Same as above.', v_dupe_usernames;
  end if;
  if v_dupe_open_positions > 0 then
    raise notice 'PRE-FLIGHT: % (user_id, spotify_id) pair(s) have MORE THAN ONE open position. These users currently cannot close those positions at all (the close route uses .single()). Consolidate them before the partial unique index will apply.', v_dupe_open_positions;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1. MONEY INVARIANTS
--    These are the constraints that would have contained the balance
--    exploits at the database layer instead of relying on JS checks.
--    NOT VALID means existing rows are not re-checked (so the migration
--    cannot fail on legacy data) but all new writes are enforced.
--    Run the VALIDATE statements once you have cleaned any bad rows.
-- ---------------------------------------------------------------------

-- A NULL balance is unrecoverable: every subsequent `balance + x` yields
-- NULL and every JS funds check silently passes. Backfill then forbid it.
update public.users set balance = 0 where balance is null;
alter table public.users alter column balance set not null;
alter table public.users alter column balance set default 1000.00;

do $$ begin
  alter table public.users add constraint users_balance_non_negative check (balance >= 0) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users add constraint users_total_volume_non_negative check (total_volume >= 0) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.positions add constraint positions_total_cost_non_negative check (total_cost >= 0) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.positions add constraint positions_entry_price_positive check (entry_price > 0) not valid;
exception when duplicate_object then null; end $$;

-- A position with a NULL spotify_id can never be priced or closed.
do $$ begin
  alter table public.positions add constraint positions_spotify_id_present check (spotify_id is not null) not valid;
exception when duplicate_object then null; end $$;

-- The status CHECK allows only ('open','closed'), but
-- /api/trades/history already queries for 'liquidated' — a status the
-- database would reject on write. Widen it so the short liquidation floor
-- in close_position_tx (part 2) can record what actually happened.
--
-- The existing constraint was declared inline, so Postgres auto-named it.
-- Dropping a guessed name would silently no-op and leave the old, narrower
-- constraint in force — so find it by what it actually constrains.
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'positions'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.positions drop constraint %I', r.conname);
    raise notice 'dropped old status check: %', r.conname;
  end loop;

  alter table public.positions add constraint positions_status_check
    check (status::text = any (array['open', 'closed', 'liquidated']));
end $$;

-- Run these after confirming the pre-flight notices are clean:
--   alter table public.users     validate constraint users_balance_non_negative;
--   alter table public.positions validate constraint positions_total_cost_non_negative;
--   alter table public.positions validate constraint positions_entry_price_positive;
--   alter table public.positions validate constraint positions_spotify_id_present;


-- ---------------------------------------------------------------------
-- 2. POSITIONS: the index that makes duplicate open positions impossible
--    Without this, one concurrent double-open creates two open rows and
--    the close endpoint (.single()) then 404s forever — the user's stake
--    is stuck with no in-product recovery path.
--    NOTE: fails if the pre-flight reported duplicates. Consolidate first.
-- ---------------------------------------------------------------------
-- Tolerated rather than fatal: if duplicates exist this cannot be created, and
-- aborting here would roll back every other fix in the script. The NOTICE tells
-- you to consolidate, then re-run.
do $$
begin
  execute $ddl$
    create unique index if not exists positions_one_open_per_user_artist_idx
      on public.positions (user_id, spotify_id)
      where status = 'open'
  $ddl$;
exception when unique_violation then
  raise notice 'SKIPPED positions_one_open_per_user_artist_idx: duplicate open positions exist. Consolidate them (see the pre-flight notice) and re-run this file.';
end $$;


-- ---------------------------------------------------------------------
-- 3. MISSING INDEXES
--    Postgres does NOT create indexes for foreign keys, so every query
--    below was a sequential scan over the whole table.
-- ---------------------------------------------------------------------

-- positions: portfolio, open-position lookup during a trade, history
create index if not exists positions_user_status_opened_idx
  on public.positions (user_id, status, opened_at desc);
create index if not exists positions_user_artist_status_idx
  on public.positions (user_id, spotify_id, status);
create index if not exists positions_user_status_closed_idx
  on public.positions (user_id, status, closed_at desc);
create index if not exists positions_spotify_id_idx
  on public.positions (spotify_id);

-- comments
create index if not exists comments_spotify_created_idx
  on public.comments (spotify_id, created_at desc);
create index if not exists comments_parent_idx
  on public.comments (parent_id) where parent_id is not null;
create index if not exists comments_user_idx
  on public.comments (user_id);

-- likes (all three tables were unindexed on their parent column)
create index if not exists comment_likes_comment_idx
  on public.comment_likes (comment_id);
create index if not exists comment_likes_user_idx
  on public.comment_likes (user_id);
create index if not exists feed_post_likes_post_idx
  on public.feed_post_likes (post_id);
create index if not exists feed_post_comment_likes_comment_idx
  on public.feed_post_comment_likes (comment_id);

-- feed
create index if not exists feed_posts_created_idx
  on public.feed_posts (created_at desc);
create index if not exists feed_posts_user_created_idx
  on public.feed_posts (user_id, created_at desc);
create index if not exists feed_post_comments_post_created_idx
  on public.feed_post_comments (post_id, created_at);
create index if not exists feed_post_comments_user_created_idx
  on public.feed_post_comments (user_id, created_at desc);

-- artists: search. A leading-wildcard ILIKE can never use a btree index;
-- this is why /api/search sequentially scanned the table on every
-- keystroke. (The only trigram index in the repo targeted `profiles`,
-- which belongs to the retired schema.)
create extension if not exists pg_trgm;
create index if not exists artists_with_history_name_trgm_idx
  on public.artists_with_history using gin (artist_name gin_trgm_ops);
create index if not exists artists_with_history_name_idx
  on public.artists_with_history (artist_name);
create index if not exists artists_with_history_last_updated_idx
  on public.artists_with_history (last_updated desc nulls last);

-- Duplicate index: artists_with_history_current_index_value_idx and
-- idx_artists_index_value are the same index, paying double write cost on
-- every ingest.
drop index if exists public.idx_artists_index_value;


-- ---------------------------------------------------------------------
-- 4. LIKE TABLES: enforce one like per user
--    All three used a surrogate `id` primary key with no uniqueness on
--    (parent, user). The application catches Postgres error 23505 to
--    handle a repeat like — that error could never fire, so like counts
--    were inflatable without limit.
--    Duplicates are collapsed first (keeping the earliest row); this is
--    safe because a duplicate like carries no information.
-- ---------------------------------------------------------------------
delete from public.comment_likes cl using (
  select id, row_number() over (partition by comment_id, user_id order by created_at, id) as rn
  from public.comment_likes
) d where cl.id = d.id and d.rn > 1;

create unique index if not exists comment_likes_unique_idx
  on public.comment_likes (comment_id, user_id);

delete from public.feed_post_likes fl using (
  select id, row_number() over (partition by post_id, user_id order by created_at, id) as rn
  from public.feed_post_likes
) d where fl.id = d.id and d.rn > 1;

create unique index if not exists feed_post_likes_unique_idx
  on public.feed_post_likes (post_id, user_id);

delete from public.feed_post_comment_likes fcl using (
  select id, row_number() over (partition by comment_id, user_id order by created_at, id) as rn
  from public.feed_post_comment_likes
) d where fcl.id = d.id and d.rn > 1;

create unique index if not exists feed_post_comment_likes_unique_idx
  on public.feed_post_comment_likes (comment_id, user_id);


-- ---------------------------------------------------------------------
-- 5. COMMENT COUNTER COLUMNS
--    The comments API embedded `likes:comment_likes(user_id)` — one JSON
--    row per like, for every comment on the page — purely to call
--    .length in JS. One viral comment made that a multi-MB response.
--    Maintain the count in the database instead.
-- ---------------------------------------------------------------------
alter table public.comments add column if not exists like_count integer not null default 0;
alter table public.comments add column if not exists reply_count integer not null default 0;

do $$ begin
  alter table public.comments add constraint comments_like_count_non_negative check (like_count >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.comments add constraint comments_reply_count_non_negative check (reply_count >= 0);
exception when duplicate_object then null; end $$;

-- Backfill from the source of truth.
update public.comments c set like_count = coalesce(l.n, 0)
from (select comment_id, count(*)::int as n from public.comment_likes group by comment_id) l
where c.id = l.comment_id and c.like_count <> coalesce(l.n, 0);

update public.comments c set reply_count = coalesce(r.n, 0)
from (select parent_id, count(*)::int as n from public.comments where parent_id is not null group by parent_id) r
where c.id = r.parent_id and c.reply_count <> coalesce(r.n, 0);

create or replace function public.tg_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_comment_like_count on public.comment_likes;
create trigger trg_comment_like_count
  after insert or delete on public.comment_likes
  for each row execute function public.tg_comment_like_count();

create or replace function public.tg_comment_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.parent_id is not null then
    update public.comments set reply_count = reply_count + 1 where id = new.parent_id;
  elsif tg_op = 'DELETE' and old.parent_id is not null then
    update public.comments set reply_count = greatest(0, reply_count - 1) where id = old.parent_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_comment_reply_count on public.comments;
create trigger trg_comment_reply_count
  after insert or delete on public.comments
  for each row execute function public.tg_comment_reply_count();


-- ---------------------------------------------------------------------
-- 6. artist_daily_streams: make the daily ingest idempotent
--    `scraper_ingest` does a bare INSERT with no ON CONFLICT, so a
--    retried workflow (or the lazy /api/artists/refresh path) appends a
--    duplicate row for the same artist and day.
-- ---------------------------------------------------------------------
-- The day bucket must be an IMMUTABLE expression to be indexable.
-- date_trunc('day', timestamptz) is only STABLE — its result depends on the
-- session TimeZone — so it is rejected in an index expression (42P17).
-- `timezone('UTC', ts)::date` is immutable: the zone is fixed, so the value
-- can never change for a given row.
--
-- The column is named "timestamp", which is a type keyword, hence the quoting.
delete from public.artist_daily_streams ads using (
  select id, row_number() over (
    partition by artist_name, (timezone('UTC', "timestamp"))::date
    order by "timestamp" desc, id desc
  ) as rn
  from public.artist_daily_streams
) d where ads.id = d.id and d.rn > 1;

-- Same expression as the dedupe above, or rows it kept could still collide.
do $$
begin
  execute $ddl$
    create unique index if not exists artist_daily_streams_artist_day_idx
      on public.artist_daily_streams (artist_name, ((timezone('UTC', "timestamp"))::date))
  $ddl$;
exception when unique_violation then
  raise notice 'SKIPPED artist_daily_streams_artist_day_idx: same-day duplicates remain after dedupe. Inspect artist_daily_streams and re-run.';
end $$;

create index if not exists artist_daily_streams_artist_ts_idx
  on public.artist_daily_streams (artist_name, "timestamp" desc);


-- ---------------------------------------------------------------------
-- 7. USERS: case-insensitive identity
--    email/username are case-sensitive varchar UNIQUE, so Alice@x.com and
--    alice@x.com are two accounts with two starting balances. The
--    application normalises case for rate-limit keys but not for lookups.
--
--    These are COMMENTED OUT because they fail when case-duplicate
--    accounts already exist, and merging accounts is a business decision
--    (which balance and which positions survive?), not something a
--    migration should guess. Check the pre-flight notice, merge, then
--    uncomment and run.
-- ---------------------------------------------------------------------
-- create unique index if not exists users_email_lower_idx    on public.users (lower(email));
-- create unique index if not exists users_username_lower_idx on public.users (lower(username));

commit;
