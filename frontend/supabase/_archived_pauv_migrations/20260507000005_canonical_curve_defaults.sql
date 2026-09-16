-- ════════════════════════════════════════════════════════════════════
-- Canonical DTM 4.0 curve defaults
-- ════════════════════════════════════════════════════════════════════
--
-- The project's canonical curve parameters, locked in by product:
--
--   p0                    = 10       -- baseline NPSI in USD at q=0
--   b                     = 0.0005   -- step-up per unit of q (very flat)
--   alpha                 = 1        -- linear regime
--   fee_rate              = 0.018    -- 1.8 % gross fee per trade
--   liquidation_threshold = 0.95     -- 95 % default for shorts that
--                                       don't carry an explicit override
--
-- curve_params is versioned-append-only — the active row is the one with
-- the latest `effective_at`. Inserting here makes these the active params
-- on a fresh DB and on existing environments alike (the new row supersedes
-- whatever's currently latest). The engine's `defaultConfig()` in
-- packages/pauv-engine/src/math.ts mirrors these exact values; keep the
-- two in sync if either is ever changed in the future.
--
-- Trade-off note: at p0=10, b=0.0005 the curve is intentionally flat —
-- prices move on the order of cents per $1k traded. Short-side capacity
-- from a fresh q=0 market is p0² / (2b) = $100k, well above the
-- per-trade cap.

insert into curve_params (
  p0, b, alpha, fee_rate, liquidation_threshold,
  acknowledge_invalidates_open_positions, reason
)
values (
  10, 0.0005, 1, 0.018, 0.95, false,
  'canonical project defaults: p0=$10, b=0.0005, alpha=1, fee=1.8%, liq=95%'
);
