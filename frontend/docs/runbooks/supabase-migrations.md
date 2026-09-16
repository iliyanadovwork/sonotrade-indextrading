# Supabase migrations runbook

How to ship a schema change safely to staging and prod. Process is the
same for every migration; specific examples (e.g. the µUSDC price
precision migration in May 2026) are appended at the bottom.

## Project refs

| Environment | Project ref | Notes |
| --- | --- | --- |
| **Staging** | `stcprpfshrcbajrxvxrq` | Apply + verify migrations here first. App is connected via the staging URL. |
| **Prod** | `iawngxubkakulvrqvxal` | Only ever applied to after staging is green. Live user data. |

The project ref is public (it appears in every Supabase URL). The
*service-role key* and DB password for each ref are secrets — never
commit those.

## Universal pre-push checklist

Before running `supabase db push` against ANY environment:

1. The migration file lives in `supabase/migrations/` with a unique
   version prefix (`YYYYMMDDNNNNNN_*.sql`). Two files with the same
   prefix will collide with the remote `schema_migrations` primary key
   and the push will abort mid-stream — see "Common pitfalls" below.
2. The migration is wrapped in a single transaction implicitly (which
   Supabase CLI guarantees per file) — no `BEGIN`/`COMMIT` needed in
   the file itself.
3. The migration is **additive** when possible: `ADD COLUMN nullable`,
   `CREATE OR REPLACE`, new tables/functions/triggers. Avoid `DROP`,
   `ALTER COLUMN`, `RENAME` against live tables unless you have a
   genuine plan for rollback + zero-downtime cut-over.
4. If new columns are introduced, the application code that *reads*
   them must tolerate `NULL` for a brief deploy window. If it can't,
   write a `BEFORE INSERT/UPDATE` trigger that backfills the column so
   old code keeps producing valid rows.
5. Run `npx tsc --noEmit` + `npx eslint` on any code that touches the
   new schema. The migration alone can't catch type drift between the
   adapter and the schema.

## Step 1 — Apply to STAGING

```bash
# Link the CLI to the staging project. If it's already linked, this
# is a no-op (Supabase CLI re-uses the cached link in supabase/.temp/).
supabase link --project-ref stcprpfshrcbajrxvxrq

# Show the diff between local and remote migration state. The output
# should list ONLY the migration(s) you intend to push. If it lists
# anything else, stop — you have stale local files or a divergence to
# reconcile first.
supabase migration list

# Apply.
supabase db push
```

Acceptable output ends with `Finished supabase db push.` Anything else
— especially `duplicate key value violates unique constraint
"schema_migrations_pkey"` — means something went wrong; see "Common
pitfalls" below.

### Verify on staging

Run the relevant `SELECT` queries in Supabase Studio → SQL Editor on
the **staging** project, with eyes on:

- New columns exist on every table they were added to.
- Backfills populated 100% of existing rows (`count(*) filter (where
  new_col is null)` should be 0).
- Any new functions / triggers / views show up in `information_schema`.
- The application UI exercises the new schema end-to-end (open a page
  that uses the new column, perform an action that writes to it,
  refresh and confirm the read path works).

If any check fails on staging, **stop**. Do not proceed to prod until
staging is green or the migration is rolled back (see "Rollback" below).

## Step 2 — Apply to PROD

Only after staging is fully verified:

```bash
supabase link --project-ref iawngxubkakulvrqvxal

# Sanity-check: this should list exactly the migration(s) you just
# applied to staging, and nothing else.
supabase migration list

supabase db push
```

Re-run the same verification queries against the **prod** project. Then
deploy the application code (Amplify or whatever the current pipeline
is) so the new column writers + readers go live.

### Order matters

**Migration first, code deploy second.** The migration is designed to
be backwards-compatible (additive columns, triggers that auto-derive
new columns from old ones, defaults that keep `NOT NULL` constraints
satisfied). The code deploy can then start writing the new columns
directly without erroring against a schema that doesn't have them.

The reverse order — code first — fails because the new code's
`INSERT … (new_column) VALUES (…)` errors out on a schema where
`new_column` doesn't exist yet. Even if you somehow recover, the trade
that triggered that insert is lost.

## Rollback strategy

Every migration should be **mentally rollback-tested before push**. The
rule of thumb:

- **Additive changes** (`ADD COLUMN nullable`, `CREATE OR REPLACE` of
  functions, new triggers, new tables) — trivially rolled back by
  `DROP`/`ALTER … DROP` of the same objects. Write the rollback SQL
  in a comment at the bottom of the migration file or in the PR
  description.
- **Destructive changes** (`DROP COLUMN`, `ALTER COLUMN … TYPE`,
  `DROP TABLE`) — there is no clean rollback. Data is gone. These
  should be staged across multiple migrations (deprecate-then-drop)
  with a code deploy in between so nothing is reading the old shape
  when it disappears.

If a push to prod goes wrong, the recovery steps are usually:

1. Run the rollback SQL directly via Supabase Studio → SQL Editor.
2. Remove the migration version record so the next push doesn't think
   it's already applied:

   ```sql
   delete from supabase_migrations.schema_migrations
   where version = 'YYYYMMDDNNNNNN';
   ```

3. Delete or revise the local migration file.
4. Re-deploy the *previous* application code if necessary (Amplify
   rollback to the last green build).

## Common pitfalls

### `duplicate key value violates unique constraint "schema_migrations_pkey"`

The remote `schema_migrations` table already has a row with that
version number, but the local file content differs from what was
applied. Usually caused by:

- Two local files sharing the same `YYYYMMDDNNNNNN` prefix
  (different `_description.sql` suffixes).
- A migration applied to remote via SQL Editor outside the CLI, whose
  version number now collides with one you've just authored locally.

**Fix:** rename the local file to a fresh unused version number, then
re-push. The actual SQL inside the file may have *already executed*
during the failed push (the version-record INSERT runs last), so check
the verification queries — if the schema change is already in place,
the rename + re-push only updates the migration record.

### CLI link points to the wrong project

`supabase/.temp/project-ref` caches the most recent link. Always run
`supabase link --project-ref <ref>` immediately before `supabase db
push` to be sure. The `supabase migration list` output identifies the
project by URL in the connection string — read it before pushing.

### Trigger fires on UPDATE you didn't expect

`BEFORE UPDATE` triggers without an `OF column_list` clause fire on
every UPDATE, including ones that don't touch the column the trigger
is "about." Always scope them:

```sql
create trigger foo_sync
  before update of relevant_column on public.foo
  for each row execute function ...;
```

### SECURITY DEFINER views flagged by the Advisor

Supabase Advisor flags `security_definer_view`. If the view is
intentional (column allowlist is the security boundary), document it
with `COMMENT ON VIEW` and dismiss the lint in the dashboard. See
migration `20260507000004_market_price_history_view.sql` for the
canonical example.

---

## Migration archive — verification examples

### `20260519000002_price_microusdc_precision.sql`

Added 6-decimal price precision (`*_microusdc` columns) so the NPSI
chart doesn't flat-line on sub-cent moves. Additive, no destructive
operations. Triggers auto-derive microusdc from cents for any writer
that hasn't been upgraded.

**Post-push verification (run on both staging and prod after push):**

```sql
-- 1. Backfill completeness — every existing row has microusdc.
select count(*) as total,
       count(*) filter (where latest_price_microusdc is null) as null_microusdc
from public.markets;
-- Expect: null_microusdc = 0

select count(*) as total,
       count(*) filter (where price_before_microusdc is null
                          or price_after_microusdc is null) as null_microusdc
from public.transactions;
-- Expect: null_microusdc = 0

-- 2. View exposes the new columns.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'market_price_history'
order by ordinal_position;
-- Expect both: price_*_cents AND price_*_microusdc

-- 3. Triggers installed.
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_name in (
  'markets_sync_price_microusdc_ins',
  'markets_sync_price_microusdc_upd',
  'transactions_sync_price_microusdc_ins'
);
-- Expect three rows.

-- 4. After a fresh trade with the new app code, microusdc should
--    carry sub-cent precision (i.e. ≠ cents × 10_000).
select id, created_at,
       price_after_cents,
       price_after_microusdc,
       price_after_microusdc - (price_after_cents * 10000) as sub_cent_residual
from public.transactions
order by created_at desc
limit 5;
-- Non-zero sub_cent_residual on at least some rows confirms the
-- engine's sub-cent precision is reaching the DB.
```

**Rollback SQL (only run if you need to revert):**

```sql
drop trigger if exists transactions_sync_price_microusdc_ins on public.transactions;
drop trigger if exists markets_sync_price_microusdc_upd on public.markets;
drop trigger if exists markets_sync_price_microusdc_ins on public.markets;
drop function if exists public.sync_transaction_price_microusdc();
drop function if exists public.sync_market_price_microusdc();

create or replace view public.market_price_history
with (security_invoker = false) as
select market_id, q_before, q_after,
       price_before_cents, price_after_cents,
       action, created_at
from public.transactions;
grant select on public.market_price_history to anon, authenticated;

alter table public.transactions
  drop column if exists price_before_microusdc,
  drop column if exists price_after_microusdc;
alter table public.markets
  drop column if exists latest_price_microusdc;

delete from supabase_migrations.schema_migrations
where version = '20260519000002';
```
