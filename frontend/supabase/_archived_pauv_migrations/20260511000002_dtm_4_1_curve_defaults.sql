-- ════════════════════════════════════════════════════════════════════
-- DTM 4.1 — flip global curve to α=100, b=0.001
-- ════════════════════════════════════════════════════════════════════
--
-- The DTM 4.0 atomic-jump liquidation algorithm was vulnerable to a
-- cascade exploit at α=1, b=0.0005 — nested shorts inside a buyback
-- range silently minted phantom cash. DTM 4.1 replaces atomic-jump with
-- walked liquidation + cascade-aware live trip Q + price-scaled
-- effectiveThreshold + UnderwaterRejection.
--
-- The price-scaled threshold schedule (floor 0.65 at $0.01, ramping to
-- 0.95 at $10+) is *calibrated specifically* for α=100, b=0.001. Changing
-- either parameter invalidates the schedule — you'd need to re-derive
-- floors and slopes via adversarial replay. Don't tune α or b without
-- updating math.ts in lockstep.
--
-- Per-market `markets.p0` is unchanged: still per-profile, admin-editable.
-- Only the GLOBAL params change here. Existing markets keep their p0.
--
-- Apply ONLY after every open position is closed (see deploy step 0 in
-- the cascade-fix plan). The α=1 → α=100 change creates wildly different
-- prices at the same Q; closing a pre-existing position post-flip would
-- credit/debit at the new curve's prices, which is unfair to the user.

insert into curve_params (
  p0, b, alpha, fee_rate, liquidation_threshold,
  acknowledge_invalidates_open_positions, reason
)
values (
  10, 0.001, 100, 0.018, 0.95, true,
  'DTM 4.1 cascade fix: flip global curve from α=1/b=0.0005 to α=100/b=0.001. Per-position liquidation_pct and trip_q are no longer set on new positions (engine recomputes liveTripQ on every walk).'
);
