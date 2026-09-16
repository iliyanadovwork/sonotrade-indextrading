-- =====================================================================
-- Migration 1: Foundation
-- =====================================================================
-- Identity (user_profiles), profiles (NPSI subjects), markets (per-profile
-- curve state), curve_params (versioned), feature flags, user_balances.
-- RLS, is_admin() helper, auto-created identity rows on auth.users insert.
-- Subsequent migrations add positions, ledger, transactions, queues, etc.

-- ─── Extensions ──────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ─── Enums ───────────────────────────────────────────────────────────
create type user_role as enum ('forecaster', 'admin', 'super_admin', 'owner');
create type account_status as enum ('active', 'suspended');
create type kyc_status as enum ('none', 'pending', 'verified', 'rejected');
create type claim_status as enum ('unclaimed', 'submitted', 'in_progress', 'verified', 'rejected');
create type claim_payout_pref as enum ('accept', 'donate');

-- ─── updated_at helper ───────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- user_profiles — extends auth.users with Pauv identity columns
-- =====================================================================
create table user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  handle citext unique,
  role user_role not null default 'forecaster',
  account_status account_status not null default 'active',
  kyc_status kyc_status not null default 'none',
  agreed_to_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_updated_at before update on user_profiles
  for each row execute function set_updated_at();

-- Auto-create user_profiles row when auth.users row is inserted.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

-- =====================================================================
-- is_admin() — used by RLS policies on admin-scoped tables
-- =====================================================================
create or replace function is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = uid and role in ('admin', 'super_admin', 'owner')
  );
$$;

-- =====================================================================
-- valid_industry() — single source of truth for the industry whitelist.
-- Mirrors src/lib/industries.ts. When industries become admin-managed
-- (PRD §6.4), this becomes a FK to a real industries table.
-- =====================================================================
create or replace function valid_industry(ind text)
returns boolean
language sql
immutable
as $$
  select ind in (
    'Actor', 'Artist', 'Athlete', 'Author', 'Chef', 'Coach',
    'Comedian', 'Designer', 'Entrepreneur', 'Fashion', 'Filmmaker',
    'Gamer', 'Influencer', 'Journalist', 'Musician', 'Podcaster',
    'Public Speaker', 'Rapper', 'Streamer'
  );
$$;

-- =====================================================================
-- profiles — the NPSI subjects (public figures)
-- =====================================================================
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  ticker citext not null unique,
  name text not null,
  bio text,
  photo_url text,
  industry text not null check (valid_industry(industry)),

  -- Information boxes (PRD §5.2 / §6.3)
  info_location text,
  info_subcategory text,
  info_active_since text,
  info_language text,

  -- Social links — URL strings; empty string = no link
  social_spotify text not null default '',
  social_applemusic text not null default '',
  social_genius text not null default '',
  social_x text not null default '',
  social_instagram text not null default '',
  social_tiktok text not null default '',
  social_youtube text not null default '',
  social_facebook text not null default '',
  social_linkedin text not null default '',
  social_linktree text not null default '',
  social_reddit text not null default '',
  social_telegram text not null default '',
  social_threads text not null default '',
  social_twitch text not null default '',
  social_ticketmaster text not null default '',
  social_imdb text not null default '',
  social_website text not null default '',

  -- Claim state
  claim_status claim_status not null default 'unclaimed',
  claimed_payout_pref claim_payout_pref,
  claimed_payout_destination jsonb,

  -- Listing state — soft delete (PRD §6.3 Delist). Profiles are never
  -- hard-deleted because forecasts may exist against them.
  delisted_at timestamptz,
  delisted_reason text,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_admin_id uuid references auth.users(id) on delete set null
);

create index profiles_industry_idx on profiles (industry);
create index profiles_active_idx on profiles (created_at desc) where delisted_at is null;
create index profiles_claim_status_idx on profiles (claim_status);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- =====================================================================
-- curve_params — global DTM 4.0 parameters, versioned (append-only).
-- "Current" = SELECT * FROM curve_params ORDER BY effective_at DESC LIMIT 1.
-- Updates are made by Edge Functions (admin-update-curve-params) which
-- enforce the freeze rule: P0/b/alpha cannot change while any market has
-- q != 0 unless the actor is owner and explicitly acknowledges.
-- =====================================================================
create table curve_params (
  id bigserial primary key,
  p0 numeric(38,18) not null,
  b numeric(38,18) not null,
  alpha numeric(38,18) not null,
  fee_rate numeric(6,5) not null check (fee_rate >= 0 and fee_rate < 0.1),
  liquidation_threshold numeric(6,5) not null check (liquidation_threshold > 0 and liquidation_threshold < 1),
  effective_at timestamptz not null default now(),
  set_by_user_id uuid references auth.users(id) on delete set null,
  acknowledge_invalidates_open_positions boolean not null default false,
  reason text
);

create index curve_params_effective_at_idx on curve_params (effective_at desc);

-- Seed: initial DTM 4.0 defaults (matches packages/pauv-engine defaults)
insert into curve_params (p0, b, alpha, fee_rate, liquidation_threshold, reason)
values (100, 0.0005, 1, 0.018, 0.95, 'initial DTM 4.0 defaults');

-- =====================================================================
-- markets — per-profile curve state and denormalized public stats.
-- One row per profile. Created by admin-create-profile Edge Function
-- with q=0 and latest_price_cents = (current curve_params.p0 * 100).
-- All writes happen inside the forecast-execute Edge Function transaction.
-- =====================================================================
create table markets (
  profile_id uuid primary key references profiles(id) on delete restrict,
  q numeric(38,18) not null default 0,
  holders_count int not null default 0 check (holders_count >= 0),
  total_volume_lifetime_cents bigint not null default 0 check (total_volume_lifetime_cents >= 0),
  latest_price_cents bigint not null check (latest_price_cents >= 0),
  latest_tick_at timestamptz not null default now(),
  frozen boolean not null default false,
  frozen_reason text,
  frozen_at timestamptz,
  frozen_by_admin_id uuid references auth.users(id) on delete set null
);

create index markets_latest_tick_idx on markets (latest_tick_at desc);
create index markets_holders_idx on markets (holders_count desc);

-- =====================================================================
-- user_balances — internal USD ledger. One row per user.
-- All updates happen inside Edge Function transactions with FOR UPDATE.
-- =====================================================================
create table user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_cents bigint not null default 0 check (available_cents >= 0),
  pending_withdrawal_cents bigint not null default 0 check (pending_withdrawal_cents >= 0),
  updated_at timestamptz not null default now()
);

create trigger user_balances_updated_at before update on user_balances
  for each row execute function set_updated_at();

-- Auto-create user_balances row when user_profiles row is inserted.
create or replace function handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_balances (user_id) values (new.user_id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_user_profile_created
after insert on user_profiles
for each row execute function handle_new_user_profile();

-- =====================================================================
-- feature_flags — runtime kill switches and tunables.
-- =====================================================================
create table feature_flags (
  key text primary key,
  bool_value boolean,
  numeric_value numeric,
  string_value text,
  description text not null,
  last_changed_by uuid references auth.users(id) on delete set null,
  last_changed_at timestamptz not null default now()
);

insert into feature_flags (key, bool_value, description) values
  ('trading_enabled', true, 'Master switch for forecast-execute endpoint.'),
  ('deposits_enabled', true, 'Master switch for crypto deposits crediting balance.'),
  ('withdrawals_enabled', true, 'Master switch for withdrawal-create endpoint.');

insert into feature_flags (key, numeric_value, description) values
  ('withdrawal_review_threshold_cents', 100000, 'Withdrawals at or above this cents amount require admin approval. Default $1000.'),
  ('max_negative_forecasts_per_market', 500, 'Cap on open negative forecasts per market to bound the liquidation walk.');

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table user_profiles enable row level security;
alter table profiles enable row level security;
alter table curve_params enable row level security;
alter table markets enable row level security;
alter table user_balances enable row level security;
alter table feature_flags enable row level security;

-- ─── user_profiles ────────────────────────────────────────────────────
-- SELECT: self or admin.
create policy user_profiles_self_select on user_profiles
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- UPDATE: self only, and only on display_name / handle / agreed_to_terms_at
-- (column grants below enforce which columns; the RLS policy gates rows).
-- Role / account_status / kyc_status changes go through admin-* Edge Functions.
create policy user_profiles_self_update on user_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Column-level grants — authenticated users can only update three columns.
revoke update on user_profiles from anon, authenticated;
grant select on user_profiles to anon, authenticated;
grant update (display_name, handle, agreed_to_terms_at) on user_profiles to authenticated;

-- ─── profiles ─────────────────────────────────────────────────────────
-- Public SELECT (skeleton + production both).
-- All writes go through admin-* Edge Functions running with service_role.
create policy profiles_public_select on profiles for select using (true);
revoke insert, update, delete on profiles from anon, authenticated;

-- ─── curve_params ─────────────────────────────────────────────────────
-- Public SELECT (current params are visible to clients for previews).
-- Writes go through admin-update-curve-params Edge Function.
create policy curve_params_public_select on curve_params for select using (true);
revoke insert, update, delete on curve_params from anon, authenticated;

-- ─── markets ──────────────────────────────────────────────────────────
-- Public SELECT (latest_price_cents, q, holders_count are all public info).
-- Writes only by forecast-execute / admin-* Edge Functions.
create policy markets_public_select on markets for select using (true);
revoke insert, update, delete on markets from anon, authenticated;

-- ─── user_balances ────────────────────────────────────────────────────
-- SELECT: self or admin. Writes only via Edge Functions with service_role.
create policy user_balances_self_select on user_balances
  for select using (user_id = auth.uid() or is_admin(auth.uid()));
revoke insert, update, delete on user_balances from anon, authenticated;

-- ─── feature_flags ────────────────────────────────────────────────────
-- Public SELECT (clients need to know if trading is on).
-- Writes only by admin-* Edge Functions.
create policy feature_flags_public_select on feature_flags for select using (true);
revoke insert, update, delete on feature_flags from anon, authenticated;

-- =====================================================================
-- Realtime publication — opt rows in for logical replication broadcasts
-- =====================================================================
-- markets row UPDATE → broadcast to clients on `market:{ticker}` channel
-- user_balances row UPDATE → broadcast to clients on `user:{uid}:balance` channel
-- The Realtime client filters by primary key value to subscribe per-row.
alter publication supabase_realtime add table markets;
alter publication supabase_realtime add table user_balances;
