-- ════════════════════════════════════════════════════════════════════
-- Ensure the user-creation cascade is in place on every environment.
-- ════════════════════════════════════════════════════════════════════
--
-- Background:
--   auth.users INSERT  →  on_auth_user_created trigger
--                       →  handle_new_auth_user()
--                       →  INSERT into public.user_profiles
--                       →  on_user_profile_created trigger
--                       →  handle_new_user_profile()
--                       →  INSERT into public.user_balances
--
-- The cascade was introduced in 20260430000001_init_foundation.sql and
-- the auth-side function was last updated in 20260518000006 (terms
-- consent capture). On the production project (iawngxubkakulvrqvxal)
-- the cascade is intact: all 48 auth users have matching user_profiles
-- AND user_balances rows.
--
-- On the staging project (stcprpfshrcbajrxvxrq), the cascade is
-- missing — 6 of 10 auth users have NO user_profiles row and therefore
-- NO user_balances row, so they can't see a balance and can't trade.
-- We don't have an explanation for the divergence (either the trigger
-- was dropped manually or the migration was never fully applied to
-- that project).
--
-- This migration is **strictly idempotent** so it can ship to both
-- environments via `supabase db push` from main:
--   - CREATE OR REPLACE FUNCTION re-installs the function bodies; on
--     prod the new bodies are byte-identical to what's already there,
--     so behavior doesn't change.
--   - DROP TRIGGER IF EXISTS + CREATE TRIGGER atomically recreates the
--     trigger inside the migration's implicit transaction (no window
--     where the trigger is missing on prod).
--   - The backfill SELECTs gate on `WHERE id NOT IN (…)`, so on prod
--     (where everyone already has rows) it inserts zero rows.
--
-- Verification (run on each project after push):
--   select
--     (select count(*) from auth.users)               as auth_users,
--     (select count(*) from public.user_profiles)     as user_profiles,
--     (select count(*) from public.user_balances)     as user_balances;
--   -- All three counts must be equal.
--
--   select tgname, tgrelid::regclass
--   from pg_trigger
--   where tgname in ('on_auth_user_created','on_user_profile_created');
--   -- Expect both rows, on auth.users and public.user_profiles
--   -- respectively.

-- ─── 1. handle_new_auth_user — copies consent timestamp, creates profile ──
-- Body kept verbatim from 20260518000006_signup_terms_consent.sql.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent_iso text := new.raw_user_meta_data->>'agreed_to_terms_at';
  v_consent_at timestamptz := null;
begin
  if v_consent_iso is not null and v_consent_iso <> '' then
    begin
      v_consent_at := v_consent_iso::timestamptz;
    exception when others then
      -- Malformed metadata — don't block account creation. The column
      -- stays null; ops can backfill later if needed.
      v_consent_at := null;
    end;
  end if;

  insert into public.user_profiles (user_id, agreed_to_terms_at)
  values (new.id, v_consent_at)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ─── 2. handle_new_user_profile — creates the balance row ─────────────────
-- Body kept verbatim from 20260430000001_init_foundation.sql.
create or replace function public.handle_new_user_profile()
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

-- ─── 3. Triggers (atomic drop-and-create inside this migration's txn) ─────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_user_profile_created on public.user_profiles;
create trigger on_user_profile_created
  after insert on public.user_profiles
  for each row execute function public.handle_new_user_profile();

-- ─── 4. Backfill any existing auth user whose cascade never fired ─────────
-- No-op on prod (all rows already present). On staging, fills the 6
-- known gaps. Uses ON CONFLICT DO NOTHING so re-runs are also no-ops.
insert into public.user_profiles (user_id)
select u.id
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

insert into public.user_balances (user_id, available_microusdc, pending_withdrawal_microusdc)
select p.user_id, 0, 0
from public.user_profiles p
left join public.user_balances b on b.user_id = p.user_id
where b.user_id is null
on conflict (user_id) do nothing;
