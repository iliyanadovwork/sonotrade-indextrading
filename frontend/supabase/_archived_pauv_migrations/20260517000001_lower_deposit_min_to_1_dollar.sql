-- ════════════════════════════════════════════════════════════════════
-- Lower the deposit minimum from $10 to $1.
-- ════════════════════════════════════════════════════════════════════
--
-- The production app reads this via `flags.deposits_min_microusdc` on every
-- /api/deposits/create call (no caching), and the DepositAmountStep UI
-- displays the formatted minimum dynamically. Flipping the value here
-- propagates to both server-side validation and the client-side input
-- helper text without a code change.
--
-- 10_000_000 µUSDC = $10 → 1_000_000 µUSDC = $1.

update feature_flags
set numeric_value = 1000000,
    description = 'Minimum deposit per tx ($1)'
where key = 'deposits_min_microusdc';
