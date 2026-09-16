-- =====================================================================
-- Migration 2: Update DTM 4.0 default curve parameters
-- =====================================================================
-- Changes b from 1 → 0.0005 and alpha from 0.015 → 1.
-- P0, fee_rate, and liquidation_threshold unchanged.
--
-- curve_params is versioned-append-only; the "current" params are
-- the most-recent row by effective_at. So we INSERT a new row rather
-- than UPDATE the existing one — preserves the audit trail.
--
-- Safe to apply because all markets currently have q = 0 (no trades
-- have happened yet). Once trades exist, future curve-shape changes
-- must go through admin-update-curve-params with the
-- acknowledge_invalidates_open_positions flag set by an owner.

insert into curve_params (
  p0, b, alpha, fee_rate, liquidation_threshold,
  acknowledge_invalidates_open_positions, reason
)
values (100, 0.0005, 1, 0.018, 0.95, false, 'updated DTM 4.0 defaults: b=0.0005, alpha=1');
