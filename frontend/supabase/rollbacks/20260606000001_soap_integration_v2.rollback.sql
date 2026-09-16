-- =====================================================================
-- ROLLBACK for: 20260606000001_soap_integration_v2.sql
-- =====================================================================
-- This file is NOT in supabase/migrations/ — `supabase db push` will
-- NEVER auto-apply it. Apply manually via Supabase SQL editor or
-- psql when a hard schema revert is required.
--
-- PRE-FLIGHT CHECKLIST:
--   [ ] Soft revert already done: payments_provider = "solana".
--   [ ] All Soap-provider deposits/withdrawals are in TERMINAL states
--       (credited/expired/quarantined/rejected/completed/cancelled).
--       This rollback DELETES soap-provider rows; in-flight ones must
--       be resolved first.
--   [ ] Point-in-time backup taken.
--
-- After this runs, the schema returns to its pre-Soap shape. The
-- archive tables persist for audit; drop them manually if no longer
-- needed.

begin;

-- Block rollback if any active soap-provider rows still exist.
do $$
declare
  v_active_dep int;
  v_active_wd int;
begin
  select count(*) into v_active_dep
    from pending_deposits
    where provider = 'soap'
      and status not in ('credited','expired','quarantined','rejected','reorged','cap_exceeded');
  if v_active_dep > 0 then
    raise exception 'rollback_blocked: % active soap deposits — resolve before rollback', v_active_dep;
  end if;

  select count(*) into v_active_wd
    from withdrawals
    where provider = 'soap'
      and status not in ('completed','rejected','cancelled');
  if v_active_wd > 0 then
    raise exception 'rollback_blocked: % active soap withdrawals — resolve before rollback', v_active_wd;
  end if;
end$$;

-- Archive soap-provider rows for audit.
create table if not exists pending_deposits_soap_archive as table pending_deposits with no data;
create table if not exists withdrawals_soap_archive       as table withdrawals       with no data;
insert into pending_deposits_soap_archive select * from pending_deposits where provider = 'soap';
insert into withdrawals_soap_archive       select * from withdrawals       where provider = 'soap';

-- Delete soap-provider rows so SET NOT NULL succeeds.
delete from pending_deposits where provider = 'soap';
delete from withdrawals       where provider = 'soap';

-- Drop shape guards (allows restoring NOT NULLs).
alter table pending_deposits drop constraint if exists pending_deposits_provider_shape_check;
alter table withdrawals       drop constraint if exists withdrawals_provider_shape_check;

-- Restore column-level NOT NULLs.
alter table pending_deposits
  alter column reference_pubkey  set not null,
  alter column treasury_address  set not null,
  alter column usdc_mint         set not null,
  alter column memo              set not null;

alter table withdrawals
  alter column destination_address set not null,
  alter column amount_microusdc    set not null;

-- Drop the constraints we added.
alter table pending_deposits
  drop constraint if exists pending_deposits_provider_check,
  drop constraint if exists pending_deposits_soap_amount_cents_check,
  drop constraint if exists pending_deposits_soap_checkout_id_key;
alter table withdrawals
  drop constraint if exists withdrawals_provider_check,
  drop constraint if exists withdrawals_soap_checkout_id_key;

alter table user_profiles
  drop constraint if exists user_profiles_soap_customer_id_key,
  drop constraint if exists user_profiles_state_upper_chk,
  drop constraint if exists user_profiles_country_upper_chk,
  drop constraint if exists user_profiles_ssn_digits_chk;

-- Drop indexes.
drop index if exists pending_deposits_provider_status_idx;
drop index if exists withdrawals_provider_status_idx;

-- Drop columns.
alter table pending_deposits
  drop column if exists provider,
  drop column if exists soap_checkout_id,
  drop column if exists soap_checkout_url,
  drop column if exists soap_charge_id,
  drop column if exists soap_amount_cents;

alter table withdrawals
  drop column if exists provider,
  drop column if exists soap_checkout_id,
  drop column if exists soap_checkout_url,
  drop column if exists soap_charge_id;

alter table user_profiles
  drop column if exists soap_customer_id,
  drop column if exists date_of_birth,
  drop column if exists address_line_1,
  drop column if exists address_line_2,
  drop column if exists city,
  drop column if exists state,
  drop column if exists postal_code,
  drop column if exists country,
  drop column if exists last_four_ssn,
  drop column if exists kyc_synced_at;

-- Drop forensic columns added to webhook_events.
alter table webhook_events
  drop column if exists raw_body,
  drop column if exists signature_header;

-- Drop feature flags.
delete from feature_flags
  where key in ('payments_provider','soap_canary_user_ids');

-- Note: handle_new_auth_user is NOT reverted — the pre-Soap version
-- didn't capture first_name/last_name, but keeping them is harmless
-- and removing them would break other flows. Trigger stays.
--
-- Note: expire-pendings cron is NOT reverted to pre-Soap form — the
-- provider-aware filter still works correctly for solana-only rows.

commit;
