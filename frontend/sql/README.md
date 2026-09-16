# Sonotrade live schema — apply order

## Validate before pasting into the SQL editor

There is no local Postgres in this project, so SQL here is easy to get wrong in
ways that only surface as a failed run against the live database. Two real
examples from authoring these files: `date_trunc('day', timestamptz)` is only
STABLE and so cannot appear in an index expression, and an index expression
containing a cast needs its own surrounding parentheses —
`((expr)::date)`, not `(expr)::date`.

Catch that class of error first:

```bash
python3 -m venv /tmp/pgvenv && /tmp/pgvenv/bin/pip install pglast
/tmp/pgvenv/bin/python scripts/validate-sql.py
```

`pglast` wraps libpg_query — the actual PostgreSQL parser — so a clean run means
the server will accept the syntax. It does **not** check semantics (volatility,
missing columns, privilege ordering, whether a backfill is correct); only a real
run does that. Note it cannot parse `returns trigger` function bodies (a pglast
limitation) — those are covered by the outer statement parse instead.


The live schema is **not** managed by `supabase db push`. Apply these by hand
in the Supabase SQL editor, in order. Every file is idempotent and safe to
re-run, so a partial application can be resumed by running the file again.

`supabase/_archived_pauv_migrations/` contains a foreign schema — never apply it.

---

## Order

| # | File | What it does | Risk |
|---|------|--------------|------|
| 0 | *(rotate the service-role key first — see below)* | | |
| 1 | `20260804_hardening_part1_constraints_indexes.sql` | Money constraints, the missing indexes, like-table uniqueness, comment counters, ingest dedupe | Low. Read the PRE-FLIGHT notices it prints. |
| 2 | `20260804_hardening_part2_ledger_and_trade_rpcs.sql` | `trade_ledger`, `idempotency_keys`, `place_order_tx`, `close_position_tx` | Low, but **the app code already calls these** — apply before deploying. |
| 3 | `20260804_hardening_part3_rls.sql` | Enables RLS everywhere, revokes default grants | **Medium.** Verify reads still work immediately after. |
| 4 | `20260804_hardening_part4_price_history_table.sql` | Moves price history out of the `data_points` jsonb | **High / phased.** Do not run the step-8 cutover until the app reads v2. |
| — | `20260724_artist_history_rpc.sql` | Pre-existing history RPC. Confirm it is actually applied — several routes assume it. | — |

## 2026-09-06: index floor → epsilon, $1 minimum order

Three files, applied in this order. The first two are independent of each
other and safe to run alone; the third is a one-time repair that must come
last.

| # | File | What it does | Risk |
|---|------|--------------|------|
| 1 | `20260906_min_order_value.sql` | `place_order_tx` rejects any exposure-opening leg under $1.00 (opens, adds, the new leg of a flip). Reduces and closes are exempt. | Low. Same body as the live function plus three guards; the panel mirrors the message client-side. |
| 2 | `20260906_index_floor_epsilon.sql` | Lowers the index floor from 0.01 to 0.000001 in `clamp_current_index_value()`, `poller_ingest()` and `sonotrade_invariants()`. | Low. No-op for every artist above a cent (2,557 of 2,570). |
| 3 | `20260906_backfill_floored_artists.sql` | Recomputes the 13 pinned artists' history and price from their stored listener counts via `recompute_artist_changes()`. | **Order-sensitive.** Run only after file 2 AND after `sonotrade/index` is deployed with `MIN_INDEX_VALUE = 0.000001`, or the next 13:00 UTC feed run re-floors them. Two open positions ($1.50) reprice to their real value. |

Verify afterwards: `GET /api/health` reports no `index_below_floor` or
`price_vs_newest_history` findings; a $0.50 order is rejected with
"order value must be at least $1.00"; a pinned artist (e.g. Priku, ~15.9k
listeners) shows ~0.0079 with a chart that is no longer flat.

## Before you start

**Rotate `SUPABASE_SERVICE_ROLE_KEY`.** A live key for project
`zvgsjbphobukppeyymfp` was committed to this repo in `test_accounting.mjs` and
`test_auth.mjs`. Those files have been deleted from the working tree, but the
key remains in git history and in every existing clone and fork. Deleting the
files is not remediation — rotate the key, then update it in the Amplify
environment and in every local `.env.local`.

Also set a real `JWT_SECRET` (`openssl rand -base64 48`) in the deployment
environment. `lib/auth.ts` now throws if it is missing or under 32 characters,
and `amplify.yml` fails the build early rather than deploying without it.

## Ordering constraint that matters

Part 2 defines the functions the API routes now call. Part 1 defines a
constraint those functions rely on (`positions.status` must accept
`'liquidated'`, and the partial unique index is what guarantees "at most one
open position per user per artist" — which is why `close_position_tx` can
safely resolve a position by `spotify_id`).

So: **1 → 2 → deploy code → 3 → 4.** Applying 2 without 1 will fail on the
first short liquidation. Deploying the code without 2 will fail every trade
with "function does not exist" — which is the correct fail-closed direction,
but it is downtime.

## After each part

Part 1 — check the notices. Three unique indexes are deliberately left
commented out or will fail if duplicate data exists:
- duplicate open positions per (user, artist),
- case-duplicate emails,
- case-duplicate usernames.

Merging accounts is a business decision, so the migration reports rather than
guesses. Resolve, then uncomment the two `lower()` indexes at the end of part 1.

Part 3 — immediately confirm anonymous reads still work (home page, artist
page, search) and that a signed-out PostgREST call cannot read `users`:

```sql
select c.relname, c.relrowsecurity as rls_enabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relrowsecurity, c.relname;
```

Every row must read `true`. This query is the only way to answer "is RLS on in
production?" — it cannot be answered from this repo.

Part 4 — verify the backfill count before doing anything else:

```sql
select count(*) from public.artist_index_history;
select sum(jsonb_array_length(coalesce(data_points,'[]'::jsonb)))
  from public.artists_with_history;
```

These should match closely. Then switch the reader routes to
`artist_history_v2()` and the scraper to `scraper_ingest_v2()`, run both
representations in parallel for a few days, and only then run the step-8
`drop column data_points` + `vacuum full`. Until that drop happens, the write
amplification this file exists to fix is still occurring.

## Still not done

There is no migration chain. `supabase db pull` into a real
`supabase/migrations/` directory, with `supabase/config.toml`, is the tracked
follow-up — until then no environment can be reproduced from this repo and
constraint/RLS state can only be verified by querying the database.
