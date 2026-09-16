-- ════════════════════════════════════════════════════════════════════
-- Signup consent capture
-- ════════════════════════════════════════════════════════════════════
--
-- Public real-money launch requires recording when a user agreed to
-- the Terms of Service / Privacy Policy / Regulatory Framework. The
-- `user_profiles.agreed_to_terms_at` column already exists (from
-- migration 20260506000001) but nothing writes to it.
--
-- The AuthForm signup path now passes the consent timestamp via
-- supabase.auth.signUp({ options: { data: { agreed_to_terms_at: ... } } }),
-- which is stored on auth.users.raw_user_meta_data. The existing
-- on_auth_user_created trigger creates the user_profiles row.
-- Extend that trigger to copy the consent timestamp into the column
-- on insert.

create or replace function handle_new_auth_user()
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
