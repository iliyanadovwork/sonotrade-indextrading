-- Migration: personal fields for /account/settings
--
-- Adds first_name, last_name, phone_number to user_profiles. Phone is
-- optional and stored as an E.164 string (e.g. +14155551234) when present.
-- Names are length-bounded as a sanity check against pasted garbage.
--
-- Editability: extends the existing column GRANT on user_profiles so the
-- owner can self-update these fields (RLS row policy already gates the row
-- to auth.uid()). role / account_status / kyc_status remain admin-only —
-- mutated only via admin-* Edge Functions.

alter table user_profiles
  add column first_name   text,
  add column last_name    text,
  add column phone_number text;

-- E.164 format: optional leading +, first digit 1-9, then 6-14 more digits.
-- NULL allowed (phone is optional). Same regex is mirrored in
-- src/lib/phone.ts so client and DB stay in lockstep.
alter table user_profiles
  add constraint user_profiles_phone_e164_chk
  check (phone_number is null or phone_number ~ '^\+?[1-9][0-9]{6,14}$');

-- Length sanity on names. 80 chars covers every realistic legal name and
-- still rejects pasted blobs.
alter table user_profiles
  add constraint user_profiles_first_name_len_chk
    check (first_name is null or char_length(first_name) <= 80);

alter table user_profiles
  add constraint user_profiles_last_name_len_chk
    check (last_name is null or char_length(last_name) <= 80);

-- Re-issue column GRANT to include new fields. Postgres has no ADD-COLUMN
-- syntax for an existing column GRANT; you reissue the whole list.
revoke update on user_profiles from authenticated;
grant update (
  display_name, handle, agreed_to_terms_at,
  first_name, last_name, phone_number
) on user_profiles to authenticated;

comment on column user_profiles.phone_number is
  'E.164 string, e.g. +14155551234. Optional; format-validated by user_profiles_phone_e164_chk when present.';
