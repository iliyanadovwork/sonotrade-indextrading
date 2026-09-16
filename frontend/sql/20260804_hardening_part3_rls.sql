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

begin;

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

commit;
