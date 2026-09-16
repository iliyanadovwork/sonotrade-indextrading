-- ════════════════════════════════════════════════════════════════════
-- Lower the withdrawal minimum from $10 to $1.
-- ════════════════════════════════════════════════════════════════════
--
-- Mirrors 20260517000001 (deposits). The production app reads this via
-- `flags.withdrawals_min_microusdc` on every /api/withdrawals/create call,
-- and the WithdrawAmountStep UI displays the formatted minimum dynamically.
-- Flipping the value here propagates to both server-side validation and
-- the client-side input helper text without a code change.
--
-- 10_000_000 µUSDC = $10 → 1_000_000 µUSDC = $1.

update feature_flags
set numeric_value = 1000000,
    description = 'Minimum withdrawal per request ($1)'
where key = 'withdrawals_min_microusdc';
