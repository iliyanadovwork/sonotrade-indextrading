-- ════════════════════════════════════════════════════════════════════
-- FK hardening: forbid CASCADE deletion of users with deposit/withdrawal
-- history. Audit trails must survive user deactivation.
-- ════════════════════════════════════════════════════════════════════
--
-- The original `pending_deposits` and `withdrawals` tables (migrations
-- 20260507000001 and 20260507000002) declared their `user_id` foreign
-- keys with `ON DELETE CASCADE`. That means deleting a user via the
-- Supabase Auth admin API silently wipes their entire deposit and
-- withdrawal history. Two problems:
--   1. Money-movement audit trail is destroyed (compliance issue).
--   2. There's no "undo" for an accidental Auth delete.
--
-- Switch both to `ON DELETE RESTRICT`. Real user removal is now done
-- via soft-delete: set `user_profiles.deactivated_at = now()`. Operator
-- runbooks should follow that path.

-- pending_deposits
alter table public.pending_deposits
  drop constraint pending_deposits_user_id_fkey;

alter table public.pending_deposits
  add constraint pending_deposits_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- withdrawals
alter table public.withdrawals
  drop constraint withdrawals_user_id_fkey;

alter table public.withdrawals
  add constraint withdrawals_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete restrict;

-- Soft-delete timestamp on user_profiles. Distinct from account_status
-- (which gates app behavior like login / deposits) so we keep an audit
-- record of WHEN the user was deactivated, and can implement grace-period
-- restoration logic later if needed. NULL = active.
alter table public.user_profiles
  add column if not exists deactivated_at timestamptz null;

comment on column public.user_profiles.deactivated_at is
  'Soft-delete timestamp. NULL = active. Set when an operator deactivates a user — prefer this over deleting the auth.users row, which would now be blocked by the FK RESTRICT on pending_deposits/withdrawals anyway.';

create index if not exists user_profiles_deactivated_at_idx
  on public.user_profiles (deactivated_at)
  where deactivated_at is not null;
