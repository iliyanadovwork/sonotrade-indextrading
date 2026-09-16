-- ════════════════════════════════════════════════════════════════════
-- Forecasts: per-user daily cap flag
-- ════════════════════════════════════════════════════════════════════
--
-- Deposits and withdrawals each have a daily cap (`deposits_daily_cap`,
-- `withdrawals_daily_cap`). Forecasts currently only have a per-trade
-- cap (`forecasts_max_microusdc_per_trade`). For symmetric risk control
-- — and to stop a single user from grinding 10× their per-trade cap on
-- the same day — add a daily cap.
--
-- Default $20,000/day. Enforcement in the forecast-execute route
-- handler (queries today's forecast_open_debit ledger entries for the
-- user, sums them, rejects if + new would exceed the cap).

insert into feature_flags (key, bool_value, jsonb_value, numeric_value, description)
values
  ('forecasts_daily_cap_microusdc', null, null, 20000000000,
    'Maximum total forecast open volume per user per UTC day ($20,000). Sum of forecast_open_debit ledger entries for the day must stay below this.')
on conflict (key) do nothing;
