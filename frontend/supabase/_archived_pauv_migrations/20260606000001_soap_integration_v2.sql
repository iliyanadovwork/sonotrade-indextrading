-- =====================================================================
-- Migration: Soap+Glide payment rail v2 (single-file source of truth)
-- =====================================================================
-- Consolidated migration for the Soap-hosted checkout / Glide USDC
-- settlement rail. Replaces the two v1 migrations (20260529000001 +
-- 20260605000001), which were applied to staging during the v1 build
-- but not to prod. This file is intended to be the single source of
-- truth that ships to BOTH staging (where most of it is already
-- applied — idempotent no-ops) AND prod (clean install).
--
-- See docs/runbooks/soap-integration-v2-plan.md for the full design.
--
-- DESIGN INVARIANTS:
--   1. Strictly additive. No DROP COLUMN, no DROP CONSTRAINT, no
--      mutation of pre-existing rows. Re-runnable: every step gated
--      on IF NOT EXISTS / ON CONFLICT / DO block existence check.
--   2. Solana path remains untouched (provider='solana' rows behave
--      exactly as before). Soap path is additive (provider='soap').
--   3. Soft revert: UPDATE feature_flags SET jsonb_value = '"solana"'
--      WHERE key='payments_provider'. Instant. No schema work.
--      Hard revert: supabase/rollbacks/20260606000001_soap_integration_v2.rollback.sql
--      (NOT in supabase/migrations/, never auto-applied).
--   4. Single migration intentionally: easier to reason about, simpler
--      promotion path, one rollback to ship.

-- =====================================================================
-- SECTION 1. user_profiles — soap_customer_id + KYC fields
-- =====================================================================

-- 1.1 Soap customer linkage (lazy-created on first deposit attempt).
alter table user_profiles
  add column if not exists soap_customer_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_soap_customer_id_key'
  ) then
    alter table user_profiles
      add constraint user_profiles_soap_customer_id_key
      unique (soap_customer_id);
  end if;
end$$;

comment on column user_profiles.soap_customer_id is
  'Soap customer ID (cus_*). Lazy-created on first deposit. UNIQUE prevents duplicate creation under concurrent attempts. Lets Soap correlate webhooks back to a Pauv user via internal_id at customer-create time.';

-- 1.2 KYC fields. Collected via KycModal at first withdrawal attempt
-- (per project policy: KYC is for payouts only, not deposits). Sent
-- to Soap via POST /api/v1/kyc/upsert at withdraw time.
--
-- Pauv is USA-only (operator does geo-lock separately), so:
--   - country defaults to 'USA' (3-letter ISO 3166 alpha-3)
--   - state is 2-letter US postal code (UPPER)
--   - last_four_ssn is exactly 4 digits, optional
alter table user_profiles
  add column if not exists date_of_birth date,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state char(2),
  add column if not exists postal_code text,
  add column if not exists country char(3) default 'USA',
  add column if not exists last_four_ssn char(4),
  add column if not exists kyc_synced_at timestamptz;

-- Format guards. NULL-tolerant: KYC may be partially filled before
-- the user finishes the modal. Soap's API validates the final shape
-- at /kyc/upsert time anyway; these are belt-and-braces.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_state_upper_chk') then
    alter table user_profiles
      add constraint user_profiles_state_upper_chk
      check (state is null or state ~ '^[A-Z]{2}$');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_country_upper_chk') then
    alter table user_profiles
      add constraint user_profiles_country_upper_chk
      check (country is null or country ~ '^[A-Z]{3}$');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_ssn_digits_chk') then
    alter table user_profiles
      add constraint user_profiles_ssn_digits_chk
      check (last_four_ssn is null or last_four_ssn ~ '^[0-9]{4}$');
  end if;
end$$;

comment on column user_profiles.date_of_birth is
  'YYYY-MM-DD. Required by Soap KYC upsert. Collected via KycModal at first withdrawal attempt. Pauv is USA-only so we accept Postgres DATE without timezone.';
comment on column user_profiles.address_line_1 is
  'Primary US address line. Required by Soap KYC upsert.';
comment on column user_profiles.address_line_2 is
  'Optional secondary US address line (apt, suite, etc).';
comment on column user_profiles.city is
  'US city. Required by Soap KYC upsert.';
comment on column user_profiles.state is
  '2-letter US postal state code, UPPER (per Soap API regex ^[A-Z]{2}$). Required by Soap KYC upsert.';
comment on column user_profiles.postal_code is
  'US ZIP code. Required by Soap KYC upsert. Format not constrained at DB layer; client validates ^[0-9]{5}(-[0-9]{4})?$.';
comment on column user_profiles.country is
  '3-letter ISO 3166 alpha-3 country code, UPPER. Defaults to USA since Pauv is USA-only and operator enforces geo-lock separately.';
comment on column user_profiles.last_four_ssn is
  'Last 4 digits of US SSN. Optional everywhere — UI field, DB column, Soap KYC upsert.';
comment on column user_profiles.kyc_synced_at is
  'Timestamp of the last successful POST /api/v1/kyc/upsert to Soap. NULL means KYC has never been synced — withdrawal flow must collect KYC + call /api/profile/kyc before allowing a checkout.';

-- =====================================================================
-- SECTION 2. pending_deposits — provider discriminator + soap_* columns
-- =====================================================================

alter table pending_deposits
  add column if not exists provider text not null default 'solana',
  add column if not exists soap_checkout_id text,
  add column if not exists soap_checkout_url text,
  add column if not exists soap_charge_id text,
  add column if not exists soap_amount_cents bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pending_deposits_provider_check') then
    alter table pending_deposits
      add constraint pending_deposits_provider_check
      check (provider in ('solana','soap'));
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pending_deposits_soap_amount_cents_check') then
    alter table pending_deposits
      add constraint pending_deposits_soap_amount_cents_check
      check (soap_amount_cents is null or soap_amount_cents > 0);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pending_deposits_soap_checkout_id_key') then
    alter table pending_deposits
      add constraint pending_deposits_soap_checkout_id_key
      unique (soap_checkout_id);
  end if;
end$$;

-- Relax legacy NOT NULLs so soap rows can carry NULL. Shape guard
-- below enforces provider-specific NOT NULL semantics.
alter table pending_deposits
  alter column reference_pubkey drop not null,
  alter column treasury_address drop not null,
  alter column usdc_mint drop not null,
  alter column memo drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pending_deposits_provider_shape_check') then
    alter table pending_deposits
      add constraint pending_deposits_provider_shape_check
      check (
        (provider = 'solana'
          and reference_pubkey is not null
          and treasury_address is not null
          and usdc_mint is not null
          and memo is not null)
        or
        (provider = 'soap'
          and soap_checkout_id is not null)
      );
  end if;
end$$;

create index if not exists pending_deposits_provider_status_idx
  on pending_deposits (provider, status, created_at desc);

comment on column pending_deposits.provider is
  'Which rail this deposit uses: "solana" (legacy Helius/treasury) or "soap" (Soap hosted checkout via Glide).';

-- =====================================================================
-- SECTION 3. withdrawals — provider discriminator + soap_* columns
-- =====================================================================

alter table withdrawals
  add column if not exists provider text not null default 'solana',
  add column if not exists soap_checkout_id text,
  add column if not exists soap_checkout_url text,
  add column if not exists soap_charge_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'withdrawals_provider_check') then
    alter table withdrawals
      add constraint withdrawals_provider_check
      check (provider in ('solana','soap'));
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'withdrawals_soap_checkout_id_key') then
    alter table withdrawals
      add constraint withdrawals_soap_checkout_id_key
      unique (soap_checkout_id);
  end if;
end$$;

-- Relax legacy NOT NULLs. The shape guard below enforces per-provider
-- semantics: solana rows need destination_address + amount up front;
-- soap rows learn amount at checkout.hold webhook time.
alter table withdrawals
  alter column destination_address drop not null,
  alter column amount_microusdc drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'withdrawals_provider_shape_check') then
    alter table withdrawals
      add constraint withdrawals_provider_shape_check
      check (
        (provider = 'solana'
          and destination_address is not null
          and amount_microusdc is not null
          and amount_microusdc > 0)
        or
        (provider = 'soap'
          and destination_address is null
          and soap_checkout_id is not null
          and (amount_microusdc is null or amount_microusdc > 0))
      );
  end if;
end$$;

create index if not exists withdrawals_provider_status_idx
  on withdrawals (provider, status, created_at desc);

-- =====================================================================
-- SECTION 3b. webhook_events — forensic raw body + signature header
-- =====================================================================
-- Industry standard for payment integrations: keep the byte-exact body
-- and signature header so the HMAC can be re-verified offline during
-- dispute resolution. The HMAC is computed over the raw body and is
-- meaningless against the parsed `payload` jsonb (whitespace differs).
-- Additive + nullable: pre-existing rows keep payload-only, all new
-- soap rows populate both.

alter table webhook_events
  add column if not exists raw_body text,
  add column if not exists signature_header text;

comment on column webhook_events.raw_body is
  'Byte-exact request body as received. Required to re-verify HMAC signatures offline. Nullable for legacy rows that pre-date the column.';
comment on column webhook_events.signature_header is
  'Provider-specific signature header value (e.g. Soap''s SOAP-WEBHOOK-SIGNATURE: "t=...,v1=..."). Paired with raw_body for forensic re-verification.';

-- =====================================================================
-- SECTION 4. feature_flags — payments_provider + canary list
-- =====================================================================
-- Going-forward default is "soap". The legacy "solana" rail (Helius +
-- treasury wallet + Inngest deposit credit) is being removed in coming
-- days; prod will be cleaned and outstanding balances refunded manually
-- before the cutover, then this migration runs against prod with soap
-- already as the only live rail.
--
-- The `update` after the insert is a deliberate, one-time exception to
-- this migration's "no mutation of pre-existing rows" invariant: on
-- staging the prior version of this section inserted '"solana"', and we
-- want the going-forward default applied without requiring a manual
-- runbook step that could be forgotten. Idempotent: subsequent re-runs
-- of the migration set the value to the same '"soap"' it already is.

insert into feature_flags (key, jsonb_value, description) values
  (
    'payments_provider',
    '"soap"'::jsonb,
    'Default payment rail: "soap" (Soap-hosted checkout via Glide). The legacy "solana" rail is being deprecated and will be removed; until then, individual users can be routed to it via soap_canary_user_ids (semantics: list members get soap regardless of the global flag — vestigial now that soap IS the global default; kept so we can re-purpose it as a Solana opt-back-in list if needed during deprecation).'
  ),
  (
    'soap_canary_user_ids',
    '[]'::jsonb,
    'JSON array of user_id strings that see provider=soap regardless of the global payments_provider flag. Now that soap is the global default this list is functionally inert.'
  )
on conflict (key) do nothing;

-- Force payments_provider to 'soap' even on environments where a prior
-- run of this migration inserted '"solana"'. See section comment above
-- for the intentional exception to the "no mutation" invariant.
update feature_flags
  set jsonb_value = '"soap"'::jsonb
  where key = 'payments_provider';

-- Force withdrawals_require_kyc to true. The legacy default (set by
-- 20260507000002_withdrawals.sql) is false because the original Solana
-- admin-queue flow had no KYC step. Going-forward all withdrawals
-- require KYC: the Soap path enforces it via `kyc_synced_at IS NULL`
-- (collected through KycModal → POST /api/profile/kyc → Soap
-- /kyc/upsert); the legacy Solana path enforces it via this flag during
-- the deprecation window. Idempotent: subsequent re-runs set true→true.
update feature_flags
  set bool_value = true
  where key = 'withdrawals_require_kyc';

-- =====================================================================
-- SECTION 5. handle_new_auth_user — capture first_name + last_name
-- =====================================================================
-- Signup-cascade trigger. Extracts first_name + last_name from
-- raw_user_meta_data (set by AuthForm or OAuth providers like Google)
-- into user_profiles. Soap requires both fields at /customers create,
-- so this writes them at signup. CREATE OR REPLACE — idempotent.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent_iso text := new.raw_user_meta_data->>'agreed_to_terms_at';
  v_consent_at timestamptz := null;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
begin
  -- Consent timestamp.
  if v_consent_iso is not null and v_consent_iso <> '' then
    begin
      v_consent_at := v_consent_iso::timestamptz;
    exception when others then
      v_consent_at := null;
    end;
  end if;

  -- Name extraction with fallback chain:
  --   1. explicit first_name / last_name (AuthForm passes these)
  --   2. OAuth (given_name / family_name)
  --   3. full_name / name split on whitespace
  -- We do NOT fall back to email-derived names at the DB layer — the
  -- application's lib/soap/customers.ts resolveNames() does that at
  -- customer-create time if needed.
  v_first_name := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  if v_first_name is null then
    v_first_name := nullif(trim(new.raw_user_meta_data->>'given_name'), '');
  end if;

  v_last_name := nullif(trim(new.raw_user_meta_data->>'last_name'), '');
  if v_last_name is null then
    v_last_name := nullif(trim(new.raw_user_meta_data->>'family_name'), '');
  end if;

  if v_first_name is null or v_last_name is null then
    v_full_name := nullif(trim(coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )), '');
    if v_full_name is not null then
      if v_first_name is null then
        v_first_name := split_part(v_full_name, ' ', 1);
      end if;
      if v_last_name is null then
        v_last_name := nullif(
          trim(substring(v_full_name from position(' ' in v_full_name) + 1)),
          ''
        );
        if v_last_name = v_full_name then
          v_last_name := null;
        end if;
      end if;
    end if;
  end if;

  insert into public.user_profiles (user_id, agreed_to_terms_at, first_name, last_name)
  values (new.id, v_consent_at, v_first_name, v_last_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user() is
  'Signup-cascade entry point. Extracts agreed_to_terms_at, first_name, and last_name from raw_user_meta_data (set by AuthForm or OAuth providers) into public.user_profiles. SECURITY DEFINER. Re-runnable.';

-- =====================================================================
-- SECTION 6. expire-pendings cron — provider-aware
-- =====================================================================
-- Existing pg_cron schedule (set in 20260520000004_pg_cron_reconcile_deposits.sql)
-- catches stale solana pending_deposits via signature IS NULL. Soap
-- rows don't have a signature (USDC settlement is off-chain via Glide),
-- so the filter needs to be provider-aware. Soap rows get a 24h
-- expires_at at insert time (lib/soap/deposits.ts) for headroom over
-- the webhook latency. cron.schedule is upsert-by-jobname so this is
-- safe to re-run.

select cron.schedule(
  'expire-pendings',
  '*/5 * * * *',
  $cron$
    update public.pending_deposits
      set status = 'expired'
      where status = 'pending'
        and expires_at < now()
        and (
          -- Solana: signature IS NULL means no on-chain tx has bound
          -- yet. Required to avoid racing the Helius webhook on a tx
          -- that just landed.
          (provider = 'solana' and signature is null)
          -- Soap: no on-chain settlement to wait for. expires_at past
          -- means we never heard back from Soap within the 24h window.
          or provider = 'soap'
        );
  $cron$
);

-- =====================================================================
-- SECTION 7. Sanity assertions
-- =====================================================================
-- These would fail loudly if applying the migration violated invariants
-- on pre-existing data. Both should always return 0 on a healthy DB.

do $$
declare
  v_bad_dep int;
  v_bad_wd int;
begin
  select count(*) into v_bad_dep
    from pending_deposits
    where provider = 'solana'
      and (reference_pubkey is null
        or treasury_address is null
        or usdc_mint is null
        or memo is null);
  if v_bad_dep > 0 then
    raise exception 'migration_invariant_failed: % solana deposits missing required on-chain columns', v_bad_dep;
  end if;

  select count(*) into v_bad_wd
    from withdrawals
    where provider = 'solana'
      and (destination_address is null or amount_microusdc is null);
  if v_bad_wd > 0 then
    raise exception 'migration_invariant_failed: % solana withdrawals missing required columns', v_bad_wd;
  end if;
end$$;
