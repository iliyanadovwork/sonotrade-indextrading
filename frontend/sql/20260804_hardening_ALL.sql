-- =====================================================================
-- SONOTRADE HARDENING — COMPLETE SCRIPT
--
-- Everything in one file, in dependency order. Paste into the Supabase SQL
-- editor and run. Idempotent: safe to re-run, and safe to re-run after a
-- partial failure.
--
-- DELIBERATELY NOT WRAPPED IN A SINGLE TRANSACTION. An earlier version was,
-- which meant one failing statement rolled back every other fix and the
-- pre-flight warnings never survived to be read. Here each statement commits
-- on its own and the operations that can legitimately fail on existing data
-- (the two unique indexes) catch the error and RAISE NOTICE instead. Read the
-- notices in the output.
--
-- WHAT EACH SECTION DOES
--   1. Money constraints, ~18 missing indexes (foreign keys do not create
--      them), like-table uniqueness, comment counters, ingest dedupe.
--   2. trade_ledger + idempotency_keys + place_order_tx / close_position_tx.
--      The application ALREADY CALLS these two functions, so trades fail until
--      this section is applied.
--   3. Row Level Security on every table, default grants revoked. Verify
--      anonymous reads still work immediately after.
--   4. Moves price history out of the data_points jsonb. The backfill runs but
--      the destructive cutover (dropping data_points) stays commented out
--      until the app reads the new table.
--
-- BEFORE YOU RUN
--   * Rotate SUPABASE_SERVICE_ROLE_KEY. A live key was committed to the repo
--     and remains in git history.
--   * Set a real JWT_SECRET (openssl rand -base64 48) in the runtime env.
--
-- AFTER YOU RUN, confirm RLS actually took effect — this query is the only way
-- to answer "is RLS on in production?":
--
--   select c.relname, c.relrowsecurity as rls_enabled
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--    order by c.relrowsecurity, c.relname;
-- =====================================================================



-- =====================================================================
-- SECTION 1 — CONSTRAINTS, INDEXES, DEDUPE
-- (source: sql/20260804_hardening_part1_constraints_indexes.sql)
-- =====================================================================
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


-- =====================================================================
-- SECTION 2 — TRADE LEDGER, IDEMPOTENCY, TRANSACTIONAL TRADE RPCS
-- (source: sql/20260804_hardening_part2_ledger_and_trade_rpcs.sql)
-- =====================================================================
-- =====================================================================
-- Sonotrade hardening — PART 2: trade ledger, idempotency, and the two
-- transactional RPCs that replace the racy multi-REST-call trade paths.
--
-- Apply via the Supabase SQL editor, AFTER part 1.
--
-- WHY THIS EXISTS
-- The previous flow read the balance, computed in JS, then issued three
-- INDEPENDENT Supabase REST calls (each its own transaction) via
-- Promise.all, discarding the positions-write error entirely. That allowed:
--   * double-close: N concurrent closes all saw status='open' and all
--     credited the balance (the UPDATE filtered on id only);
--   * balance double-spend: two orders both read the same balance and both
--     passed the funds check;
--   * torn writes: balance debited with no position created, returning 200;
--   * rounding drift: total_cost was re-derived from a rounded average
--     instead of being the sum of actual debits, minting ~1c per cycle.
--
-- Both functions below take a per-user transaction-scoped advisory lock,
-- re-read the balance and position FOR UPDATE, and perform every write in
-- one transaction. If anything raises, the whole trade rolls back.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. APPEND-ONLY TRADE LEDGER
--    Previously nothing recorded a balance change: partial reductions
--    wrote no history row at all, and the order id returned to the client
--    was a throwaway randomUUID() never persisted. Without this table a
--    balance can never be reconciled or repaired after an incident.
-- ---------------------------------------------------------------------
create table if not exists public.trade_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id),
  spotify_id     text references public.artists_with_history(spotify_id),
  position_id    uuid references public.positions(id),
  action         text not null,
  quantity       numeric not null check (quantity > 0),
  price          numeric not null check (price > 0),
  cash_delta     numeric not null,              -- signed change to users.balance
  realized_pnl   numeric not null default 0,
  balance_after  numeric not null,
  idempotency_key text,
  created_at     timestamptz not null default now()
);

create index if not exists trade_ledger_user_created_idx
  on public.trade_ledger (user_id, created_at desc);
create index if not exists trade_ledger_spotify_created_idx
  on public.trade_ledger (spotify_id, created_at desc);


-- ---------------------------------------------------------------------
-- 2. IDEMPOTENCY
--    A network retry, a double-tap on the trade slider, or a platform
--    lambda retry previously executed the trade twice.
-- ---------------------------------------------------------------------
create table if not exists public.idempotency_keys (
  key        text primary key,
  user_id    uuid,
  endpoint   text not null,
  response   jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idempotency_keys_expires_idx
  on public.idempotency_keys (expires_at);


-- ---------------------------------------------------------------------
-- 3. HARDEN update_balance
--    The original was SECURITY DEFINER with NO pinned search_path (the
--    classic privilege-escalation vector) and did a blind
--    `balance = balance + p_amount` with no floor and no NULL guard — so
--    passing NULL set the balance to NULL permanently.
--    Kept for compatibility; the RPCs below do not use it.
-- ---------------------------------------------------------------------
create or replace function public.update_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new numeric;
begin
  if p_amount is null or p_amount = 'NaN'::numeric then
    raise exception 'update_balance: amount must be a real number (got %)', p_amount
      using errcode = '22023';
  end if;

  update public.users
     set balance = round(balance + p_amount, 2),
         updated_at = now()
   where id = p_user_id
  returning balance into v_new;

  if not found then
    raise exception 'update_balance: user % not found', p_user_id using errcode = 'P0002';
  end if;
  if v_new < 0 then
    raise exception 'update_balance: would make balance negative (%).', v_new
      using errcode = '23514';
  end if;
  return v_new;
end $$;

revoke all on function public.update_balance(uuid, numeric) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. PLACE ORDER — single transaction, per-user lock, exact accounting
--
--    Accounting rule: total_cost is ALWAYS the running sum of actual cash
--    debited, never re-derived from a rounded average price. entry_price
--    is a derived display value (total_cost / contracts). Because of that,
--    a full close credits exactly round(price * contracts, 2) and nothing
--    is minted or destroyed by rounding.
-- ---------------------------------------------------------------------
create or replace function public.place_order_tx(
  p_user_id         uuid,
  p_spotify_id      text,
  p_side            text,
  p_quantity        numeric,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty            numeric;
  v_price          numeric;
  v_artist_name    text;
  v_balance        numeric;
  v_pos            public.positions;
  v_is_long        boolean;
  v_same_side      boolean;
  v_cash_delta     numeric := 0;
  v_realized_pnl   numeric := 0;
  v_notional       numeric;
  v_qty_to_close   numeric;
  v_portion_cost   numeric;
  v_proceeds       numeric;
  v_flip_qty       numeric;
  v_flip_cost      numeric;
  v_new_contracts  numeric;
  v_new_total_cost numeric;
  v_position_id    uuid;
  v_action         text;
  v_cached         jsonb;
  v_result         jsonb;
  v_now            timestamptz := now();
begin
  -- ---- input validation -------------------------------------------------
  -- The route used `!quantity` and `quantity <= 0`, which a non-numeric
  -- value passes (NaN comparisons are false), producing NaN -> NULL and
  -- bricking the balance. Validate hard here so no caller can bypass it.
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid side: %', p_side using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric then
    raise exception 'quantity must be a number' using errcode = '22023';
  end if;

  v_qty := round(p_quantity, 2);
  if v_qty <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = '22023';
  end if;
  if v_qty > 1000000 then
    raise exception 'quantity exceeds the maximum of 1,000,000' using errcode = '22023';
  end if;

  -- ---- idempotency replay ----------------------------------------------
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  -- ---- serialise all of this user's money movement ----------------------
  -- Transaction-scoped: released automatically on commit or rollback, so a
  -- validation failure can never leave a stuck lock (the Redis lock it
  -- replaces was only released inside a narrow finally block, so every
  -- early return held it for the full TTL).
  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select balance into v_balance from public.users where id = p_user_id for update;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- ---- price: server-derived, and it must be real -----------------------
  select current_index_value, artist_name into v_price, v_artist_name
    from public.artists_with_history where spotify_id = p_spotify_id;
  if not found then
    raise exception 'artist not found' using errcode = 'P0002';
  end if;
  -- current_index_value is nullable (an artist whose data_points is empty,
  -- or whose ingest failed). The read routes all guard with `?? 0`; the
  -- trade routes did a bare parseFloat -> NaN -> NULL balance.
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  v_notional := round(v_price * v_qty, 2);
  if v_notional <= 0 then
    raise exception 'order value rounds to zero — increase the quantity' using errcode = '22023';
  end if;

  -- The partial unique index from part 1 guarantees at most one open row.
  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;

  if v_pos.id is null then
    -- ============ open a brand-new position ============
    if v_balance < v_notional then
      raise exception 'insufficient funds: need %, have %', v_notional, v_balance
        using errcode = '23514';
    end if;
    v_cash_delta := -v_notional;
    v_action := case when p_side = 'buy' then 'open_long' else 'open_short' end;

    insert into public.positions (
      user_id, spotify_id, artist_name, position_type, contracts,
      entry_price, total_cost, status, opened_at, updated_at
    ) values (
      p_user_id, p_spotify_id, v_artist_name,
      case when p_side = 'buy' then 'long' else 'short' end,
      v_qty, v_price, v_notional, 'open', v_now, v_now
    ) returning id into v_position_id;

  else
    v_is_long   := (v_pos.position_type = 'long');
    v_same_side := (v_is_long and p_side = 'buy') or (not v_is_long and p_side = 'sell');
    v_position_id := v_pos.id;

    if v_same_side then
      -- ============ add to the existing position ============
      if v_balance < v_notional then
        raise exception 'insufficient funds: need %, have %', v_notional, v_balance
          using errcode = '23514';
      end if;
      v_cash_delta     := -v_notional;
      v_new_contracts  := round(v_pos.contracts + v_qty, 2);
      -- Running sum of real debits. The old code recomputed this as
      -- round(avg_price * contracts), which did not equal the cash taken.
      v_new_total_cost := round(v_pos.total_cost + v_notional, 2);
      v_action := case when v_is_long then 'add_long' else 'add_short' end;

      update public.positions set
        contracts   = v_new_contracts,
        total_cost  = v_new_total_cost,
        entry_price = round(v_new_total_cost / v_new_contracts, 8),
        updated_at  = v_now
      where id = v_pos.id;

    else
      -- ============ opposite side: reduce, close, or flip ============
      v_qty_to_close := least(v_qty, v_pos.contracts);
      v_portion_cost := round(v_pos.total_cost * (v_qty_to_close / v_pos.contracts), 2);

      if v_is_long then
        -- Selling longs: receive market value for the closed portion.
        v_proceeds := round(v_price * v_qty_to_close, 2);
      else
        -- Buying back shorts: margin portion returned, adjusted by the
        -- price move, floored at zero so a runaway short cannot drive the
        -- balance negative (there is no margin engine and no liquidation
        -- job in this system).
        v_proceeds := greatest(
          0,
          round(v_portion_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_qty_to_close, 2)
        );
      end if;

      v_realized_pnl := round(v_proceeds - v_portion_cost, 2);
      v_cash_delta   := v_proceeds;

      if v_qty < v_pos.contracts then
        -- partial reduction
        v_new_contracts  := round(v_pos.contracts - v_qty_to_close, 2);
        v_new_total_cost := round(v_pos.total_cost - v_portion_cost, 2);
        v_action := case when v_is_long then 'reduce_long' else 'reduce_short' end;

        update public.positions set
          contracts   = v_new_contracts,
          total_cost  = v_new_total_cost,
          entry_price = round(v_new_total_cost / v_new_contracts, 8),
          updated_at  = v_now
        where id = v_pos.id;

      else
        -- full close (and possibly a flip)
        v_action := case when v_is_long then 'close_long' else 'close_short' end;

        update public.positions set
          status         = 'closed',
          current_price  = v_price,
          unrealized_pnl = v_realized_pnl,
          closed_at      = v_now,
          updated_at     = v_now
        where id = v_pos.id;

        if v_qty > v_pos.contracts then
          v_flip_qty  := round(v_qty - v_pos.contracts, 2);
          v_flip_cost := round(v_price * v_flip_qty, 2);
          if v_balance + v_cash_delta < v_flip_cost then
            raise exception 'insufficient funds to flip: need %, have %',
              v_flip_cost, round(v_balance + v_cash_delta, 2) using errcode = '23514';
          end if;
          v_cash_delta := round(v_cash_delta - v_flip_cost, 2);
          v_action := case when p_side = 'buy' then 'flip_to_long' else 'flip_to_short' end;

          insert into public.positions (
            user_id, spotify_id, artist_name, position_type, contracts,
            entry_price, total_cost, status, opened_at, updated_at
          ) values (
            p_user_id, p_spotify_id, v_artist_name,
            case when p_side = 'buy' then 'long' else 'short' end,
            v_flip_qty, v_price, v_flip_cost, 'open', v_now, v_now
          ) returning id into v_position_id;
        end if;
      end if;
    end if;
  end if;

  -- ---- apply the balance change (same transaction) ----------------------
  update public.users set
    balance      = round(balance + v_cash_delta, 2),
    total_volume = coalesce(total_volume, 0) + v_notional,
    total_pnl    = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at   = v_now
  where id = p_user_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'trade would make balance negative (%)', v_balance using errcode = '23514';
  end if;

  -- ---- market volume ---------------------------------------------------
  update public.artists_with_history
     set volume = coalesce(volume, 0) + v_notional
   where spotify_id = p_spotify_id;

  -- ---- audit trail -----------------------------------------------------
  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_position_id, v_action, v_qty, v_price,
    v_cash_delta, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'action', v_action,
    'position_id', v_position_id,
    'filled_quantity', v_qty,
    'price', v_price,
    'cash_delta', v_cash_delta,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'orders/place', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $$;

revoke all on function public.place_order_tx(uuid, text, text, numeric, text) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. CLOSE POSITION — the double-close fix
--    The old route SELECTed with status='open' but then UPDATEd filtering
--    on id alone, never checking the row count, while crediting the
--    balance in a parallel call. Ten concurrent requests credited ten
--    times. Here the row is taken FOR UPDATE inside the same transaction
--    as the credit, and the UPDATE re-asserts status='open', so the
--    second caller finds nothing to close.
-- ---------------------------------------------------------------------
create or replace function public.close_position_tx(
  p_user_id         uuid,
  p_spotify_id      text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos          public.positions;
  v_price        numeric;
  v_proceeds     numeric;
  v_realized_pnl numeric;
  v_balance      numeric;
  v_rows         integer;
  v_cached       jsonb;
  v_result       jsonb;
  v_now          timestamptz := now();
begin
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;
  if v_pos.id is null then
    raise exception 'no open position found' using errcode = 'P0002';
  end if;

  select current_index_value into v_price
    from public.artists_with_history where spotify_id = p_spotify_id;
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  if v_pos.position_type = 'long' then
    v_proceeds := round(v_price * v_pos.contracts, 2);
  else
    v_proceeds := greatest(
      0,
      round(v_pos.total_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_pos.contracts, 2)
    );
  end if;
  v_realized_pnl := round(v_proceeds - v_pos.total_cost, 2);

  -- Re-asserting status='open' is what makes a concurrent double-close
  -- impossible even if the advisory lock were removed.
  update public.positions set
    -- 'liquidated' when the short floor bound and the whole margin was
    -- lost. Nothing in the codebase ever wrote this status before, even
    -- though /api/trades/history reads it.
    status         = case
                       when v_pos.position_type = 'short' and v_proceeds = 0 then 'liquidated'
                       else 'closed'
                     end,
    current_price  = v_price,
    unrealized_pnl = v_realized_pnl,
    closed_at      = v_now,
    updated_at     = v_now
  where id = v_pos.id and status = 'open';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'position already closed' using errcode = '40001';
  end if;

  update public.users set
    balance    = round(balance + v_proceeds, 2),
    total_pnl  = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at = v_now
  where id = p_user_id
  returning balance into v_balance;

  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_pos.id,
    case when v_pos.position_type = 'long' then 'close_long' else 'close_short' end,
    v_pos.contracts, v_price, v_proceeds, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'position_id', v_pos.id,
    'contracts', v_pos.contracts,
    'price', v_price,
    'proceeds', v_proceeds,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'trades/close', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $$;

revoke all on function public.close_position_tx(uuid, text, text) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. increment_artist_volume — referenced by the old code path but not
--    defined in any SQL file in the repo. Created here so the fallback
--    cannot 500, though place_order_tx now updates volume inline.
-- ---------------------------------------------------------------------
create or replace function public.increment_artist_volume(p_spotify_id text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 0 then
    return;
  end if;
  update public.artists_with_history
     set volume = coalesce(volume, 0) + p_amount
   where spotify_id = p_spotify_id;
end $$;

revoke all on function public.increment_artist_volume(text, numeric) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Housekeeping: expire idempotency keys. Run from pg_cron if available.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_idempotency_keys()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.idempotency_keys where expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- select cron.schedule('purge-idempotency', '17 * * * *',
--   $$select public.purge_expired_idempotency_keys()$$);


-- =====================================================================
-- SECTION 3 — ROW LEVEL SECURITY
-- (source: sql/20260804_hardening_part3_rls.sql)
-- =====================================================================
-- =====================================================================
-- Sonotrade hardening — PART 3: Row Level Security
--
-- Apply via the Supabase SQL editor, AFTER parts 1 and 2.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS
-- `lib/db/supabase.ts` states "Sonotrade runs RLS-off, so the anon key can
-- read/write". The anon key is inlined into the browser bundle by
-- definition (NEXT_PUBLIC_*). With RLS off and the default PostgREST
-- grants in place, anyone can open DevTools, copy that key, and call
-- PostgREST directly:
--     GET   /rest/v1/users?select=*            -> every email + password_hash
--     PATCH /rest/v1/users?id=eq.<uuid>        -> set their own balance
-- Every auth check, rate limit, and validation in the API layer is
-- bypassed. The repo already had supabase_rls.sql at the root, but nothing
-- proves it was ever applied and the code comment asserts the opposite.
--
-- This file supersedes /supabase_rls.sql: same intent, plus the tables that
-- file missed (waitlist, artist_metrics, trade_ledger, idempotency_keys),
-- plus explicit REVOKEs so a missing policy cannot fall back to a grant.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Enable RLS everywhere. With RLS on and no policy for a role, that
--    role is denied — the safe default.
-- ---------------------------------------------------------------------
alter table public.users                    enable row level security;
alter table public.positions                enable row level security;
alter table public.artists_with_history     enable row level security;
alter table public.artist_daily_streams     enable row level security;
alter table public.comments                 enable row level security;
alter table public.comment_likes            enable row level security;
alter table public.feed_posts               enable row level security;
alter table public.feed_post_likes          enable row level security;
alter table public.feed_post_comments       enable row level security;
alter table public.feed_post_comment_likes  enable row level security;
alter table public.trade_ledger             enable row level security;
alter table public.idempotency_keys         enable row level security;

-- Tables the root supabase_rls.sql never covered. `waitlist` is the acute
-- one: it holds email addresses plus bcrypt OTP hashes and expiries, and
-- with RLS never enabled it was world-readable and world-writable.
do $$ begin
  execute 'alter table public.waitlist enable row level security';
exception when undefined_table then
  raise notice 'skipping waitlist (table not present in this project)';
end $$;

do $$ begin
  execute 'alter table public.artist_metrics enable row level security';
exception when undefined_table then
  raise notice 'skipping artist_metrics (table not present in this project)';
end $$;


-- ---------------------------------------------------------------------
-- 2. Revoke the default grants.
--    Enabling RLS is not sufficient on its own to reason about: an
--    accidentally permissive future policy plus a broad grant is how these
--    leaks happen. Grant back only what is needed, below.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- The service role bypasses RLS entirely; all server routes use it.
grant usage on schema public to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Public read-only surfaces (anonymous browsing).
--    SELECT only. No INSERT/UPDATE/DELETE policy exists for anon or
--    authenticated anywhere in this file, so all mutation must go through
--    a server route holding the service-role key — which is what makes the
--    API-layer rate limits and validation actually load-bearing.
-- ---------------------------------------------------------------------
grant select on public.artists_with_history to anon, authenticated;
drop policy if exists artists_public_read on public.artists_with_history;
create policy artists_public_read on public.artists_with_history
  for select to anon, authenticated using (true);

grant select on public.artist_daily_streams to anon, authenticated;
drop policy if exists streams_public_read on public.artist_daily_streams;
create policy streams_public_read on public.artist_daily_streams
  for select to anon, authenticated using (true);

grant select on public.comments to anon, authenticated;
drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments
  for select to anon, authenticated using (true);

grant select on public.comment_likes to anon, authenticated;
drop policy if exists comment_likes_public_read on public.comment_likes;
create policy comment_likes_public_read on public.comment_likes
  for select to anon, authenticated using (true);

grant select on public.feed_posts to anon, authenticated;
drop policy if exists feed_posts_public_read on public.feed_posts;
create policy feed_posts_public_read on public.feed_posts
  for select to anon, authenticated using (true);

grant select on public.feed_post_likes to anon, authenticated;
drop policy if exists feed_post_likes_public_read on public.feed_post_likes;
create policy feed_post_likes_public_read on public.feed_post_likes
  for select to anon, authenticated using (true);

grant select on public.feed_post_comments to anon, authenticated;
drop policy if exists feed_post_comments_public_read on public.feed_post_comments;
create policy feed_post_comments_public_read on public.feed_post_comments
  for select to anon, authenticated using (true);

grant select on public.feed_post_comment_likes to anon, authenticated;
drop policy if exists feed_post_comment_likes_public_read on public.feed_post_comment_likes;
create policy feed_post_comment_likes_public_read on public.feed_post_comment_likes
  for select to anon, authenticated using (true);


-- ---------------------------------------------------------------------
-- 4. NO public access at all: users, positions, trade_ledger,
--    idempotency_keys, waitlist, artist_metrics.
--    RLS is on with zero policies for anon/authenticated = implicit deny.
--    Deliberately no policy statements here — that is the control.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 5. public.users gets NO anonymous access at all.
--
--    An earlier version of this file created a `public_profiles` view with
--    security_invoker plus a column-limited SELECT grant on public.users, so
--    anon could read a safe projection. Two reasons that is gone:
--
--    1. Nothing needs it. Every read of `users` in this app is server-side
--       through the service role — the leaderboard route, the public profile
--       page, and all of app/api/auth/*. The only consumers of the browser
--       (anon) client are the realtime hooks, and they subscribe to
--       artists_with_history. Verified by grep, not assumed.
--    2. A column grant is a standing invitation to leak: the moment someone
--       adds a column to that view, or widens the grant, email and
--       password_hash are one edit away from being public.
--
--    So `users` keeps RLS on with zero policies for anon/authenticated, which
--    is an implicit deny. If a genuine public-profile surface is ever needed,
--    add a view with security_invoker = true AND a matching narrow policy —
--    and note that CREATE OR REPLACE VIEW cannot change an existing view's
--    column list (error 42P16), so it has to be dropped and recreated.
--
--    Drop the stale view left behind by the retired supabase_rls.sql. Wrapped
--    so a dependent object reports instead of aborting the whole script.
-- ---------------------------------------------------------------------
do $$
begin
  execute 'drop view if exists public.public_profiles';
  raise notice 'public_profiles dropped (unused; anon has no access to users).';
exception when others then
  raise notice 'SKIPPED dropping public_profiles (%): %', sqlstate, sqlerrm;
end $$;

drop policy if exists users_public_projection_read on public.users;
revoke all on public.users from anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. Verify. Every row should read `rls_enabled = true`.
--    Keep this query; it is the only way to answer "is RLS on in prod?"
-- ---------------------------------------------------------------------
-- select c.relname as table_name, c.relrowsecurity as rls_enabled
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r'
--  order by c.relrowsecurity, c.relname;


-- =====================================================================
-- SECTION 4 — PRICE HISTORY TABLE (phased; read the notes)
-- (source: sql/20260804_hardening_part4_price_history_table.sql)
-- =====================================================================
-- =====================================================================
-- Sonotrade hardening — PART 4 (PHASE 2): move the price series out of the
-- artists_with_history.data_points jsonb array and into a real table.
--
-- THIS IS THE BIGGEST SINGLE PERFORMANCE CHANGE AVAILABLE, and unlike
-- parts 1-3 it is not a drop-in: it changes where price history lives, so
-- apply it deliberately, verify the backfill, and only then switch the
-- reader RPCs over (step 5) and the ingest (step 6).
--
-- WHY
-- data_points is one unbounded jsonb array per artist, appended daily —
-- roughly 76KB and ~1,200 points for a 3-year artist, 73% of the row. It is
-- TOASTed, which makes it pathological in both directions:
--
--   READS: any query that selects the row WITH data_points detoasts and
--   parses the whole array. /api/artist/[id] returned it in full per
--   rendered trade-embed card; the batch-history fallback pulled 200 x 76KB
--   ≈ 15MB in one response; pct_change_since scans the array five times per
--   ingest. Windowed history has to be computed in JS or by expanding
--   jsonb_array_elements over ~238,000 rows per batch call.
--
--   WRITES: appending one ~40-byte point rewrites the entire 76KB value as
--   a new tuple (MVCC). ~2,500 artists/day ≈ 190MB of dead tuples and
--   ~380MB of WAL per day, sustained autovacuum pressure, and TOAST bloat
--   that only grows. Supabase Realtime also ships the full changed row, so
--   every price tick pushes 76KB to every subscriber — and silently drops
--   the event once the row exceeds the 1MB max_record_bytes ceiling.
--
-- AFTER THIS: appends are ~100-byte inserts, windowed reads are index range
-- scans, the artist row stops being rewritten, and realtime payloads on the
-- artist row drop to well under 1KB.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. The history table.
--    Composite primary key doubles as the range-scan index and makes the
--    ingest naturally idempotent per (artist, timestamp).
-- ---------------------------------------------------------------------
create table if not exists public.artist_index_history (
  spotify_id text        not null references public.artists_with_history(spotify_id) on delete cascade,
  ts         timestamptz not null,
  index      numeric     not null check (index >= 0),
  constraint artist_index_history_pkey primary key (spotify_id, ts)
);

-- Descending companion for "latest N points" reads, which is the shape
-- every chart query actually wants.
create index if not exists artist_index_history_spotify_ts_desc_idx
  on public.artist_index_history (spotify_id, ts desc);

-- BRIN is tiny and ideal for the append-only, time-correlated scans used by
-- cross-artist analytics and retention jobs.
create index if not exists artist_index_history_ts_brin_idx
  on public.artist_index_history using brin (ts);

-- RLS must be set HERE, not in the RLS section, because this table is created
-- after that section has already run. Supabase grants default privileges on
-- newly-created public tables to anon and authenticated, so without this the
-- price series every position's P&L derives from would be insertable and
-- updatable with the anon key that ships in the browser bundle.
alter table public.artist_index_history enable row level security;

revoke all on public.artist_index_history from anon, authenticated;
grant select on public.artist_index_history to anon, authenticated;

drop policy if exists artist_index_history_public_read on public.artist_index_history;
create policy artist_index_history_public_read on public.artist_index_history
  for select to anon, authenticated using (true);
-- No INSERT/UPDATE/DELETE policy: writes go through scraper_ingest_v2 under
-- the service role only.


-- ---------------------------------------------------------------------
-- 2. Denormalised current price + change windows on the artist row.
--    current_index_value is currently either a GENERATED column or a
--    DEFAULT expression over data_points depending on which dump you read
--    — verify which with:
--      select column_name, is_generated, generation_expression, column_default
--        from information_schema.columns
--       where table_name = 'artists_with_history'
--         and column_name = 'current_index_value';
--    A DEFAULT would mean the price NEVER updates when data_points is
--    appended, only on INSERT. If it is generated, it must be dropped
--    before it can become a plain writable column (step 6 writes it).
-- ---------------------------------------------------------------------
do $$
declare v_is_generated text;
begin
  select is_generated into v_is_generated
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'artists_with_history'
     and column_name = 'current_index_value';

  if v_is_generated = 'ALWAYS' then
    raise notice 'current_index_value is a GENERATED column. Converting it to a plain column so the ingest can write it directly.';
    alter table public.artists_with_history
      alter column current_index_value drop expression;
  else
    raise notice 'current_index_value is already a plain column (is_generated = %).', coalesce(v_is_generated, 'NO');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. Backfill from the existing jsonb. Idempotent: re-running skips rows
--    already present. Expect this to take a while on a large table.
-- ---------------------------------------------------------------------
insert into public.artist_index_history (spotify_id, ts, index)
select
  a.spotify_id,
  (p->>'timestamp')::timestamptz,
  (p->>'index')::numeric
from public.artists_with_history a
cross join lateral jsonb_array_elements(coalesce(a.data_points, '[]'::jsonb)) as p
where p ? 'timestamp'
  and p ? 'index'
  and (p->>'index') ~ '^[0-9]+(\.[0-9]+)?$'
on conflict (spotify_id, ts) do nothing;

-- Verify before proceeding. These two counts should match closely (small
-- differences are malformed points the WHERE clause above skipped):
--   select count(*) from public.artist_index_history;
--   select sum(jsonb_array_length(coalesce(data_points,'[]'::jsonb)))
--     from public.artists_with_history;


-- ---------------------------------------------------------------------
-- 4. Read API over the new table. Same output contract as the existing
--    artist_history / artist_history_batch RPCs so the routes can switch
--    with no response-shape change. Downsampling stays server-side.
-- ---------------------------------------------------------------------
create or replace function public.artist_history_v2(
  p_spotify_id text,
  p_window     text default 'all',
  p_max_points int  default 240
)
returns table (ts timestamptz, index numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_total int;
  v_stride int;
begin
  v_since := case p_window
    when '1h' then now() - interval '1 hour'
    when '1d' then now() - interval '1 day'
    when '1w' then now() - interval '7 days'
    when '1m' then now() - interval '30 days'
    when '1y' then now() - interval '365 days'
    else '-infinity'::timestamptz
  end;

  select count(*) into v_total
    from public.artist_index_history h
   where h.spotify_id = p_spotify_id and h.ts >= v_since;

  -- Keep every point when the window is already small enough; otherwise
  -- take every Nth so the payload is bounded regardless of history depth.
  v_stride := greatest(1, ceil(v_total::numeric / greatest(p_max_points, 1))::int);

  return query
    with ordered as (
      select h.ts, h.index, row_number() over (order by h.ts) as rn
        from public.artist_index_history h
       where h.spotify_id = p_spotify_id and h.ts >= v_since
    )
    select o.ts, o.index
      from ordered o
     where o.rn % v_stride = 0 or o.rn = v_total
     order by o.ts;
end $$;

grant execute on function public.artist_history_v2(text, text, int) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. Change-window recomputation from the new table.
--    Replaces pct_change_since(), which expanded the jsonb array five
--    times per ingest — so per-write cost grew with total history depth.
-- ---------------------------------------------------------------------
create or replace function public.recompute_artist_changes(p_spotify_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
begin
  select index into v_current
    from public.artist_index_history
   where spotify_id = p_spotify_id
   order by ts desc limit 1;

  if v_current is null then
    return;
  end if;

  update public.artists_with_history a set
    current_index_value = v_current,
    change_1h = public.pct_change_from(p_spotify_id, v_current, interval '1 hour'),
    change_1d = public.pct_change_from(p_spotify_id, v_current, interval '1 day'),
    change_1w = public.pct_change_from(p_spotify_id, v_current, interval '7 days'),
    change_1m = public.pct_change_from(p_spotify_id, v_current, interval '30 days'),
    change_1y = public.pct_change_from(p_spotify_id, v_current, interval '365 days')
  where a.spotify_id = p_spotify_id;
end $$;

create or replace function public.pct_change_from(
  p_spotify_id text,
  p_current    numeric,
  p_interval   interval
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  -- The point at or immediately before the window boundary; one index
  -- lookup instead of a full array scan.
  select case
           when prev.index is null or prev.index = 0 then null
           else round(((p_current - prev.index) / prev.index) * 100, 4)
         end
    from (
      select index
        from public.artist_index_history
       where spotify_id = p_spotify_id
         and ts <= now() - p_interval
       order by ts desc
       limit 1
    ) prev;
$$;


-- ---------------------------------------------------------------------
-- 6. Idempotent ingest against the new table.
--    scraper_ingest did a bare INSERT into artist_daily_streams plus an
--    unconditional `||` append to data_points, so a retried workflow run —
--    or the lazy /api/artists/refresh path — duplicated both. Day-bucketing
--    the key makes a re-run a no-op.
-- ---------------------------------------------------------------------
create or replace function public.scraper_ingest_v2(
  p_spotify_id  text,
  p_index       numeric,
  p_listeners   bigint default null,
  p_ts          timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_index is null or p_index = 'NaN'::numeric or p_index < 0 then
    raise exception 'scraper_ingest_v2: invalid index %', p_index using errcode = '22023';
  end if;

  -- One point per artist per day; a same-day re-run overwrites rather than
  -- appending a duplicate.
  insert into public.artist_index_history (spotify_id, ts, index)
    values (p_spotify_id, date_trunc('day', p_ts), p_index)
    on conflict (spotify_id, ts) do update set index = excluded.index;

  -- ON CONFLICT has to name the same immutable expression the unique index in
  -- part 1 was built on, or Postgres cannot infer the arbiter.
  insert into public.artist_daily_streams (artist_name, index, "timestamp")
    select a.artist_name, p_index, date_trunc('day', p_ts)
      from public.artists_with_history a
     where a.spotify_id = p_spotify_id
  on conflict (artist_name, ((timezone('UTC', "timestamp"))::date)) do update
    set index = excluded.index;

  update public.artists_with_history
     set monthly_listeners = coalesce(p_listeners, monthly_listeners),
         last_updated = greatest(last_updated, p_ts)
   where spotify_id = p_spotify_id;

  perform public.recompute_artist_changes(p_spotify_id);
end $$;

revoke all on function public.scraper_ingest_v2(text, numeric, bigint, timestamptz) from anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Optional retention. An index that ticks daily needs no more than a
--    few years of full resolution; older points can be thinned to weekly.
--    Enable once you are confident in the backfill.
-- ---------------------------------------------------------------------
create or replace function public.thin_old_index_history(p_older_than interval default interval '2 years')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.artist_index_history h
   where h.ts < now() - p_older_than
     and extract(dow from h.ts) <> 1;   -- keep Mondays
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- select cron.schedule('thin-index-history', '0 4 * * 0',
--   $$select public.thin_old_index_history()$$);


-- ---------------------------------------------------------------------
-- 8. CUTOVER (do NOT run until the application is reading v2)
--    Once /api/markets/* use artist_history_v2 and the scraper uses
--    scraper_ingest_v2, drop the jsonb array. This is the step that
--    actually reclaims the space and stops the row rewrites — until it
--    runs, both representations are maintained and nothing has improved
--    on the write side.
-- ---------------------------------------------------------------------
-- alter table public.artists_with_history drop column data_points;
-- vacuum full analyze public.artists_with_history;
