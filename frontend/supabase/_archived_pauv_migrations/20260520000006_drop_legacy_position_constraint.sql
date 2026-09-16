-- ════════════════════════════════════════════════════════════════════
-- Drop legacy DTM 4.0 NOT-NULL invariant on negative positions
-- ════════════════════════════════════════════════════════════════════
--
-- DTM 4.0 stored `liquidation_pct` and `trip_q` per-position on every
-- negative forecast, and the original schema enforced that via:
--
--   constraint positions_negative_carries_escrow check (
--     direction = 'positive'
--     or (escrow_microusdc is not null
--         and liquidation_pct is not null
--         and trip_q is not null)
--   )
--
-- DTM 4.1 (already shipped in `packages/pauv-engine/`) recomputes the
-- per-position trip point on every walk via `liveTripQ` / `computeAllLiveTripQs`
-- — it's not stored. The threshold is global on `curve_params` and
-- price-scaled by `effectiveThreshold`. So `liquidation_pct` and
-- `trip_q` are intentionally NULL on new negative positions, which
-- trips the legacy constraint and turns every negative-forecast insert
-- into a 23514 (`Couldn't open forecast. Try again` in the UI).
--
-- Fix: replace the check with a weaker invariant — negatives still
-- carry escrow, but the two unused columns may be NULL. Keep the
-- columns themselves for now (older rows already populated). Future
-- cleanup can drop them entirely once we're sure no downstream reader
-- references them.

alter table public.positions
  drop constraint if exists positions_negative_carries_escrow;

-- DTM 4.1 invariant: negatives must carry escrow; liquidation_pct +
-- trip_q are intentionally unconstrained (engine recomputes live).
alter table public.positions
  add constraint positions_negative_carries_escrow check (
    direction = 'positive'
    or escrow_microusdc is not null
  );

comment on constraint positions_negative_carries_escrow on public.positions is
  'DTM 4.1: negatives must escrow at open. liquidation_pct + trip_q are unconstrained — the engine recomputes live trip Q on every walk.';
