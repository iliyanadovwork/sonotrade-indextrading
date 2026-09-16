-- =====================================================================
-- Migration 3: Profile views — unique-viewer tracking
-- =====================================================================
-- Adds a YouTube-style "unique views" counter on each profile.
--
-- Design:
--   - profiles.view_count    — denormalized cache, displayed on the UI.
--                              Reflects unique viewers (lifetime) per profile.
--   - profile_views          — one row per (profile_id, viewer_id) combo.
--                              viewer_id is an anonymous UUID generated
--                              client-side and stored in localStorage.
--                              Logged-in users could swap to auth.uid()
--                              later but for now everyone is anon.
--   - record_profile_view()  — the only way to insert/upsert a view event
--                              and atomically bump the cached counter.
--                              Called from /api/profile-view via the
--                              service-role client.

-- ─── profiles.view_count ─────────────────────────────────────────────
alter table profiles
  add column view_count bigint not null default 0
  check (view_count >= 0);

-- ─── profile_views ───────────────────────────────────────────────────
create table profile_views (
  profile_id uuid not null references profiles(id) on delete cascade,
  viewer_id text not null check (length(viewer_id) between 8 and 64),
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count int not null default 1 check (view_count > 0),
  primary key (profile_id, viewer_id)
);

create index profile_views_last_idx
  on profile_views (profile_id, last_viewed_at desc);

alter table profile_views enable row level security;
-- service_role only. Users never read or write this table directly;
-- the RPC function below is the only entry point.
revoke all on profile_views from anon, authenticated;

-- ─── record_profile_view RPC ─────────────────────────────────────────
-- Atomically:
--   1. Resolves the profile by ticker (case-insensitive via citext).
--   2. Upserts a profile_views row for this (profile, viewer) pair.
--   3. If this is a new unique viewer, increments profiles.view_count.
--   4. Returns the current view_count.
--
-- Idempotent: same viewer hitting the same profile twice in a session
-- bumps the per-row view_count timestamp but doesn't over-count uniques.
create or replace function record_profile_view(p_ticker text, v_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  p_id uuid;
  is_new_viewer boolean;
  result bigint;
begin
  if v_id is null or length(v_id) < 8 or length(v_id) > 64 then
    raise exception 'invalid viewer_id';
  end if;

  select id into p_id
  from profiles
  where ticker = p_ticker and delisted_at is null;

  if p_id is null then
    return 0;
  end if;

  -- Upsert the per-viewer row. Returns the inserted/updated row.
  insert into profile_views (profile_id, viewer_id)
  values (p_id, v_id)
  on conflict (profile_id, viewer_id) do update
    set last_viewed_at = now(),
        view_count = profile_views.view_count + 1
  returning (xmax = 0) into is_new_viewer;
  -- xmax = 0 on freshly inserted tuples; non-zero after ON CONFLICT update.

  if is_new_viewer then
    update profiles
      set view_count = view_count + 1
      where id = p_id
      returning view_count into result;
  else
    select view_count into result from profiles where id = p_id;
  end if;

  return result;
end;
$$;

-- The function is the only way to write to profile_views. Make sure
-- service_role can execute it (default), and revoke from public roles.
revoke all on function record_profile_view(text, text) from public;
grant execute on function record_profile_view(text, text) to service_role;

-- ─── Backfill: zero already-existing profiles ──────────────────────
-- (column was added with default 0; explicit so the migration is
-- defensive and grep-able.)
update profiles set view_count = 0 where view_count is null;
