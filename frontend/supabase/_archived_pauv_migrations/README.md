# ARCHIVED — these migrations belong to a different product

These ~40 files describe the retired **Pauv** schema (`markets`, `profiles`,
`user_balances`, `ledger_entries`, `pending_deposits`, `withdrawals`,
`treasury_inflows`, `curve_params`, …). **None of them reference
`artists_with_history` or `artist_daily_streams`**, which are the tables this
application actually uses.

They were moved out of `supabase/migrations/` because leaving them there is
actively dangerous: running `supabase db push` against the live Sonotrade
project would attempt to apply a foreign schema to it.

The live Sonotrade schema is applied manually via the Supabase SQL editor.
Current DDL lives in `frontend/sql/`. Capturing the live schema into a real
migration chain (`supabase db pull`) is a tracked follow-up — until that is
done, no environment can be reproduced from this repo and RLS state cannot be
verified from source.

Keep these for historical reference only. Do not apply them.
