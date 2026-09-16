# Soap Integration v2 — Plan

**Status:** Plan for review. No code lands until user sign-off.
**Branch target:** `staging` (already reset to main; deploys to `testing.pauv.com`).
**DB target:** Staging Supabase (`stcprpfshrcbajrxvxrq`) — already wiped of activity, 5 users preserved at $0 balance.
**Driver:** Clean from-zero rebuild of the Soap+Glide payment rail, applying lessons from v1.

---

## 1. Soap API surface (verified against MCP docs + OpenAPI spec, 2026-06-06)

### 1.1 Endpoints we use

| Endpoint | Purpose | Required fields | Notes |
|---|---|---|---|
| `POST /api/v1/customers` | Create customer | `email`, `first_name`, `last_name` | Optional: `phone_number` (10 digits, no `+1`, no formatting), `date_of_birth` (YYYY-MM-DD), `internal_id` |
| `GET /api/v1/customers/search` | Lookup existing customer | `email` and/or `phone_number` (≥1) | Returns `{ results: [...] }`. Empty array if none. Email case-insensitive. **Always call before create** to avoid 422 collisions. |
| `GET /api/v1/charges/{id}` | Fetch detailed charge | path: `id` | Returns full state machine + payment_method (card / bank_account / crypto_wallet) + 3DS. Useful for post-webhook reconciliation. |
| `POST /api/v1/checkouts` | Create checkout session | `customer_id`, `type` | See §1.2 — schema differs per flow type. Returns hosted-page `url` to redirect to. |
| `POST /api/v1/kyc/upsert` | Sync KYC data | `customer_id`, `first_name`, `last_name`, `date_of_birth`, `address_line_1`, `city`, `state`, `postal_code`, `country`, `provider`, `verified` | Optional: `email`, `phone_number`, `address_line_2`, `last_four_ssn` (exactly 4 digits). |
| `POST /api/v1/device_pings` | Geo check | `latitude`, `longitude`, `customer_id` | Browser-side call (uses client secret, NOT API key). Optional for v2. |
| `GET /api/v1/device_pings/latest_geo_check` | Server-side geo verification | query: `customer_id` | Returns latest geo_check or null. Optional for v2. |

### 1.2 Checkout schema (per account configuration)

**Pauv's account = Preset Amount Deposit + Balance Withdrawal** (verified by hitting both shapes in v1):

```jsonc
// Deposit (account-locked to Preset Amount):
{
  "customer_id": "cus_*",
  "type": "deposit",
  "fixed_amount_cents": 100,      // REQUIRED — our account requires this
  "experience": "web",            // optional, "web" | "webview"
  "return_url": "https://testing.pauv.com/portfolio?deposit=<our_uuid>"
}

// Withdrawal (Balance Withdrawal):
{
  "customer_id": "cus_*",
  "type": "withdrawal",
  "balance_amount_cents": 10000,  // REQUIRED — caps user-selectable amount
  "experience": "web",
  "return_url": "https://testing.pauv.com/portfolio?withdrawal=<our_uuid>"
}
```

Response shape: `{ id: "chk_*", url, client_secret, line_items: [], line_items_total_amount_cents: null, balance_amount_cents, type, experience }`.

### 1.3 Webhook surface (all events)

Signed with header `SOAP-WEBHOOK-SIGNATURE: t=<unix>,v1=<hex>`; HMAC-SHA256 over `${t}.${rawBody}` using webhook signing secret. Retries 4x with 10s timeout EXCEPT `checkout.hold` (zero retries — single-shot synchronous critical path).

| Event | Trigger | Handler action |
|---|---|---|
| `checkout.pending` | Charge entered processing | Status update only, no ledger |
| `checkout.succeeded` | Payment completed | Deposit → credit balance + ledger; withdrawal → finalize |
| `checkout.failed` | Charge failed | Usually no ledger change; check `from_status` for succeeded→failed reversal (withdrawals) |
| `checkout.returned` | Bounced (after `succeeded`) | Reverse the ledger |
| `checkout.voided` | Voided after `succeeded` | Reverse the ledger |
| `checkout.expired` | Session expired | Release any held funds (withdrawals) |
| `checkout.terminally_failed` | KYC/geo/fraud failure | Release any holds; mark terminal |
| `checkout.hold` | **Withdrawal pre-flight** | Verify balance, debit, mark held, respond 2xx (or non-2xx if insufficient) |
| `checkout.release_hold` | Withdrawal failed after hold | Restore the held funds |
| `checkout.review.created/approved/declined` | Manual review lifecycle | Audit log only |

All webhook event_id is the idempotency key for de-duplication.

---

## 2. Field gap analysis (Soap-required vs Pauv-has-now)

### 2.1 For DEPOSIT (Preset Amount, Soap customer creation prerequisite)

| Field | Soap requires | Pauv has now | Action |
|---|---|---|---|
| `email` | ✓ | ✓ `auth.users.email` | use as-is |
| `first_name` | ✓ | ✓ `user_profiles.first_name` (collected at signup post-migration) | use as-is |
| `last_name` | ✓ | ✓ `user_profiles.last_name` (collected at signup) | use as-is |
| `internal_id` | optional | ✓ `auth.users.id` (uuid) | pass for audit-trail correlation |
| `phone_number` | optional | column exists, NULL for all 5 current users | skip in v2 — caused 422 in v1 |
| `date_of_birth` | optional | not in schema | skip in v2 — needed for KYC anyway |

**Conclusion: NO new data collection needed before deposits.** Existing signup flow is sufficient.

### 2.2 For WITHDRAWAL + KYC (Pauv policy: KYC for payouts only)

| Field | Soap requires | Pauv has now | Action |
|---|---|---|---|
| `customer_id` | ✓ | ✓ (from soap_customer_id, set on first deposit) | use as-is |
| `first_name` | ✓ | ✓ | use as-is |
| `last_name` | ✓ | ✓ | use as-is |
| `date_of_birth` | ✓ | **MISSING** | collect via KYC modal |
| `address_line_1` | ✓ | **MISSING** | collect via KYC modal |
| `address_line_2` | optional | **MISSING** | collect via KYC modal (optional input) |
| `city` | ✓ | **MISSING** | collect via KYC modal |
| `state` | ✓ (2-letter UPPER) | **MISSING** | collect via KYC modal (state dropdown) |
| `postal_code` | ✓ | **MISSING** | collect via KYC modal |
| `country` | ✓ (3-letter UPPER) | **MISSING** | default to `'USA'`, no UI for v2 |
| `provider` | ✓ (string) | n/a | hard-code `"pauv_self_attested"` for v2 (no KYC vendor integrated yet) |
| `verified` | ✓ (boolean) | n/a | send `false` — Soap accepts unverified attestation and runs its own checks |
| `last_four_ssn` | optional (exactly 4 digits) | **MISSING** | collect via KYC modal (optional input) |
| `phone_number` | optional | NULL | optional collect via KYC modal |
| `email` | optional | ✓ | pass through |

### 2.3 Geo check (optional for v2)

Browser-side `POST /device_pings` uses `SOAP_CLIENT_SECRET`. Not blocking — Soap's hosted checkout runs its own geo check and fires `checkout.terminally_failed` if it fails. We can add pre-flight later for friendlier UX.

---

## 3. Schema strategy

### 3.1 Current DB state (staging)

Already applied from previous migrations (still in DB even after branch reset):
- `user_profiles.soap_customer_id` (text)
- `user_profiles.first_name`, `last_name`, `phone_number` (text)
- `pending_deposits` + `withdrawals`: `provider`, `soap_checkout_id`, `soap_checkout_url`, `soap_charge_id`, `soap_amount_cents` (deposits only)
- `webhook_events`, `ledger_entries`, `audit_log` tables
- Signup-cascade trigger `handle_new_auth_user` extracts `first_name` + `last_name` from `user_metadata`

Missing from current schema:
- `user_profiles.date_of_birth`, `address_line_1`, `address_line_2`, `city`, `state`, `postal_code`, `country`, `last_four_ssn`, `kyc_synced_at`

### 3.2 New migration: `20260606000001_soap_integration_v2.sql`

**Single idempotent migration** that:

1. **Adds soap_* columns to `pending_deposits`, `withdrawals`, `user_profiles` if not present** (no-op on staging, full create on prod when promoted).
2. **Adds KYC columns to `user_profiles`** (new everywhere):
   - `date_of_birth DATE`
   - `address_line_1 TEXT` + `address_line_2 TEXT`
   - `city TEXT`, `state CHAR(2)` (CHECK `^[A-Z]{2}$`), `postal_code TEXT`
   - `country CHAR(3) DEFAULT 'USA'` (CHECK `^[A-Z]{3}$`)
   - `last_four_ssn CHAR(4)` (CHECK `^[0-9]{4}$`) — store as encrypted-at-rest plaintext per Supabase defaults
   - `kyc_synced_at TIMESTAMPTZ` — set when we successfully `POST /kyc/upsert`
3. **Adds shape-guard CHECK constraint** on `pending_deposits` / `withdrawals` reusing v1's pattern (provider='solana' → solana columns NOT NULL; provider='soap' → soap_checkout_id NOT NULL).
4. **Inserts feature_flags** for Soap defaults using `ON CONFLICT (key) DO NOTHING`.
5. **Cron job patch** — extends existing expire-pendings cron to handle `provider='soap'` rows on `expires_at` rather than `signature IS NULL`.

Every step gated on `IF NOT EXISTS` / `ON CONFLICT` / `DO $$ BEGIN ... END $$` blocks so a re-run is a no-op.

### 3.3 Rollback companion

`supabase/rollbacks/20260606000001_soap_integration_v2.rollback.sql` — same defensive pattern from v1. NOT in `supabase/migrations/` so CLI never auto-applies. Used only for hard schema revert.

---

## 4. Code architecture

### 4.1 `lib/soap/` module layout

| File | Responsibility |
|---|---|
| `lib/soap/types.ts` | TypeScript types for every Soap API + webhook payload. Discriminated unions; type guards. No defaults. |
| `lib/soap/client.ts` | Bearer-auth REST client with 8s timeout, 3-attempt backoff (5xx only). Methods: `createCustomer`, `searchCustomerByEmail`, `createDepositCheckout`, `createWithdrawalCheckout`, `upsertKyc`, `getCharge`, `getLatestGeoCheck`. |
| `lib/soap/webhook-signature.ts` | HMAC-SHA256 verify with 5-min replay window, timing-safe compare. |
| `lib/soap/customers.ts` | `ensureSoapCustomer(userId)` — fast-path → SELECT FOR UPDATE → **search-by-email first** → create-on-miss → cache to user_profiles. |
| `lib/soap/kyc.ts` | `syncKycToSoap(userId, kycData)` — pulls user_profiles, validates, POSTs `/kyc/upsert`, stamps `kyc_synced_at`. |
| `lib/soap/deposits.ts` | `createSoapDeposit({ userId, amountMicroUsdc, baseUrl })` — pre-generates UUID, ensures customer, creates Preset checkout with `fixed_amount_cents`, INSERTs row. |
| `lib/soap/withdrawals.ts` | `createSoapWithdrawal({ userId, availableMicroUsdc, baseUrl })` — pre-flight KYC check, creates Balance Withdrawal checkout with `balance_amount_cents`, INSERTs row. |
| `lib/soap/provider.ts` | `resolvePaymentsProvider(userId)` — reads `payments_provider` + `soap_canary_user_ids`. Fails safe to `"solana"`. |
| `lib/soap/return-url.ts` | Returns proxy-aware base URL. Reads `x-forwarded-host` before `request.url` (the Amplify SSR Lambda fix from v1). |
| `lib/soap/webhook-handlers.ts` | Per-event handlers (12 events). Each runs in a single `sql.begin` transaction with idempotency-keyed ledger inserts. |
| `lib/soap/money.ts` | `centsToMicroUsdc(n: number): bigint` + `microUsdcToCentsFloor(n: bigint): number`. The ONLY cents↔µUSDC boundary. |

### 4.2 API route layout

| Route | Method | Purpose |
|---|---|---|
| `/api/soap/webhook` | POST | Single dispatcher: HMAC verify → dedup via `webhook_events` UNIQUE → call `dispatchSoapEvent` → mark processed. Returns 422 on `checkout.hold` insufficient_balance. |
| `/api/deposits/create` | POST | Branches on `resolvePaymentsProvider`. Soap branch: validates amount, calls `createSoapDeposit`, returns `{ provider: "soap", depositId, checkoutUrl }`. |
| `/api/withdrawals/create` | POST | Branches on provider. Soap branch: **checks KYC complete in user_profiles** before creating checkout. 412 if KYC missing. Calls `createSoapWithdrawal`. |
| `/api/profile/kyc` | POST | Receives KYC form payload. Validates. Updates user_profiles. Calls `syncKycToSoap`. |
| `/api/payments/provider` | GET | Returns resolved provider for current user — used by modals to pre-render correctly. |

### 4.3 UI changes

| Component | Change |
|---|---|
| `components/auth/AuthForm.tsx` | No change — already collects first_name + last_name (from v1 work). |
| `components/funds/DepositModal.tsx` | Provider-aware. Soap branch: AmountStep → click Next → POST create → redirect to `checkoutUrl`. |
| `components/funds/WithdrawModal.tsx` | Provider-aware. Soap branch: pre-check KYC via new endpoint → if missing, route to KYC modal; if present, AmountStep + POST create → redirect. |
| `components/funds/KycModal.tsx` | **NEW**. Form for DOB + address + state dropdown + optional last 4 SSN. Submits to `/api/profile/kyc`. Reused by withdrawal pre-flight. |
| `components/funds/SoapPaymentReturn.tsx` | Mostly the same as v1. Honest "Verifying" copy already in place. Drives off Realtime on `pending_deposits` / `withdrawals` row. |
| `app/portfolio/page.tsx` | Mount `<SoapPaymentReturn />` to handle `?deposit=` / `?withdrawal=` params. |

### 4.4 Webhook state machine

Reuses v1 design (it was correct). One handler per event type. Every ledger insert uses an idempotency key:
- `deposit_credit:<deposit_uuid>` — deposit succeeded
- `deposit_reversal:<deposit_uuid>:<charge_id>` — returned / voided
- `withdrawal_request:<withdrawal_uuid>` — checkout.hold
- `withdrawal_cancelled:<withdrawal_uuid>` — release_hold
- `withdrawal_returned:<withdrawal_uuid>:<charge_id>` — withdrawal returned post-success

State transitions verified against Soap's `from_status` field to handle out-of-order webhook delivery.

---

## 5. Implementation phases (sequenced)

### Phase 1: Migration + rollback file (no code change)
- `supabase/migrations/20260606000001_soap_integration_v2.sql`
- `supabase/rollbacks/20260606000001_soap_integration_v2.rollback.sql`
- Apply to staging via `supabase db push --linked` (staging is `stcprpfshrcbajrxvxrq`)
- Verify columns + flags landed via probe script

### Phase 2: Core `lib/soap/*` module
- Build all 9 files listed in §4.1
- Unit testable via Vitest
- TypeScript clean, ESLint clean

### Phase 3: Webhook route + handler
- `app/api/soap/webhook/route.ts`
- Per-event handlers in `lib/soap/webhook-handlers.ts`
- 422 on hold insufficient_balance; 200 on dedup; 200 with `processing_status='failed'` on not-found

### Phase 4: Deposit flow
- Modify `app/api/deposits/create/route.ts` with provider branch
- Modify `components/funds/DepositModal.tsx` with provider branch
- Pre-flight smoke test against testing.pauv.com end-to-end

### Phase 5: KYC modal + endpoint
- `components/funds/KycModal.tsx` (new) with form validation
- `app/api/profile/kyc/route.ts` (new) — validate, persist, sync to Soap
- Profile state derived: `kyc_status = 'pending'` after first save (synced to Soap with `verified: false`)

### Phase 6: Withdrawal flow
- Modify `app/api/withdrawals/create/route.ts` with provider branch + KYC gate
- Modify `components/funds/WithdrawModal.tsx` with KYC pre-check + provider branch
- Smoke test withdrawal end-to-end

### Phase 7: Return URL handler
- `components/funds/SoapPaymentReturn.tsx` (port from v1, already proven)
- Mount on `/portfolio` page

### Phase 8: Cutover
- Set `payments_provider = "soap"` in feature_flags
- Verify Amplify env vars (SOAP_API_KEY, SOAP_WEBHOOK_SIGNING_SECRET, SOAP_API_BASE_URL=https://api-sandbox.paywithsoap.com, SOAP_CLIENT_SECRET, SOAP_RETURN_URL=https://testing.pauv.com)
- Re-register webhook URL in Soap dashboard: `https://testing.pauv.com/api/soap/webhook`
- CEO smoke test

---

## 6. Lessons from v1 carried forward

These all stay in v2 — they're not bugs to re-introduce:

1. **Search-customer-by-email BEFORE create.** Eliminates "Email has already been taken" 422 collision dead-end.
2. **Phone number omitted from customer creation.** Soap's docs say "10 digits no formatting" but their validator regex rejected `17373426330` in v1. Until clarified, skip the field.
3. **`fixed_amount_cents` mandatory on deposits.** Our account is Preset-configured. Don't try DraftKings style.
4. **`x-forwarded-host` for return URL.** Amplify Lambda sees `localhost:3000` as `request.url`. The `x-forwarded-host` header is the canonical public hostname.
5. **`expires_at` on soap-provider deposits = `now() + 24h`.** Soap checkout sessions live longer than the legacy 15-min Solana matcher window. The cron job is provider-aware (per `20260605000001`).
6. **HMAC-SHA256 over the RAW body, not parsed.** Reading `request.text()` once and using both for HMAC verify and JSON parse.
7. **`checkout.hold` is single-shot — NO retries.** Critical-path handler keeps DB lock window under 100ms; returns 422 on insufficient balance per docs.
8. **Honest "Verifying deposit" copy on return UI.** Soap uses ONE `return_url` for both success AND cancel.

---

## 7. Lessons from v1 we are CHANGING

1. **No lazy customer creation with bad data.** v1 used email-prefix fallback for names when profile was empty. v2 requires real first_name + last_name at signup (already in place per `20260605000001` migration).
2. **No KYC collection at signup.** v1 mentioned collecting DOB / address at signup. v2 defers KYC to the FIRST WITHDRAWAL ATTEMPT, gated by `withdrawals_require_kyc` flag (set to `true` for the soap rail).
3. **Single comprehensive migration file** for the schema, not two separate ones. Easier to reason about, simpler to roll out.
4. **No `expires_at = now() + 15min` default leaking into Soap rows.** New migration sets a column-level default of `now() + interval '24 hours'` for soap rows OR enforces it at insert time.
5. **First-class `/api/profile/kyc` endpoint** with proper validation, not just a profile UPDATE.

---

## 8. Prerequisites checklist (must hold before any code lands)

| Item | How to verify | Status |
|---|---|---|
| Staging branch = main + no soap commits | `git log origin/main..origin/staging` returns empty | ✓ verified 2026-06-06 |
| Staging DB wiped of activity | counts = 0 on positions / transactions / ledger / deposits / withdrawals / webhook_events | ✓ verified 2026-06-06 |
| `payments_provider = "solana"` (won't accidentally route during integration build) | `SELECT jsonb_value FROM feature_flags WHERE key='payments_provider'` | ✓ verified 2026-06-06 |
| Amplify env: SOAP_API_KEY, SOAP_WEBHOOK_SIGNING_SECRET, SOAP_CLIENT_SECRET present | Amplify Console → Environment variables | needs user re-verify |
| Amplify env: APP_BASE_URL set to https://testing.pauv.com | Amplify Console | needs user re-verify |
| Amplify env: amplify.yml allowlist includes SOAP_ prefix (was on staging-soap-v1-backup) | grep amplify.yml | **REQUIRES PORT** from backup branch |
| Soap sandbox dashboard: webhook URL `https://testing.pauv.com/api/soap/webhook` registered | Soap Dashboard → Developer → Webhook Settings | will re-verify after cutover |
| Glide wallets unchanged (main + payout `ENA6...awTe`) | memory note `project_soap_glide_migration.md` | ✓ assumed valid |
| MCP server reachable | `mcp__soap__search_soap` probe | ✓ this session |
| User accounts preserved | `SELECT count(*) FROM auth.users` returns 5 | ✓ verified 2026-06-06 |
| Migration 20260605000001 still applied (signup trigger handles names) | `SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260605000001'` | ✓ verified 2026-06-06 |

### 8.1 Things the user must do before Phase 8 cutover

1. Port `amplify.yml` SOAP_ allowlist change from `staging-soap-v1-backup` to a new commit on `staging`. (I'll prepare this commit; user just reviews/merges.)
2. Verify Amplify Console env vars haven't been removed when the rollback rebuild ran.
3. Confirm Soap dashboard webhook signing secret matches `SOAP_WEBHOOK_SIGNING_SECRET` in Amplify (we never rotated it; should still match).

---

## 9. Risk register

| Risk | Mitigation |
|---|---|
| `checkout.hold` synchronous critical path returning non-2xx by accident | Strict 2xx-or-422-only branching in handler; integration test with sandbox |
| KYC modal field validation drifts from Soap's regex (e.g., state 2-letter, country 3-letter) | Validate client + server with the EXACT regex from Soap OpenAPI (`^[A-Z]{2}$`, `^[A-Z]{3}$`, `^[0-9]{4}$` for SSN); copy these regexes verbatim |
| Soap customer search returns multiple matches | Per docs "Email matching is case-insensitive" + unique-per-merchant — should never happen. Defensive: take first result, log warning if > 1 |
| Migration 20260606000001 fails on staging because of constraint conflict | Idempotent CHECK adds wrapped in DO blocks; verified column exists before adding constraint |
| Webhook event arrives before `pending_deposits` row exists (race between create + Soap fire) | Handler returns `{ ok: false, reason: 'deposit_not_found' }` with 200 + log. Soap retries 4x; usually row exists by then. |
| Encrypted-at-rest SSN handling | Supabase Postgres provides Transparent Data Encryption out of the box; no app-side encryption needed for staging. For prod, add column-level masking RLS if needed. |
| Re-running the migration accidentally | Idempotent: every IF NOT EXISTS / ON CONFLICT / DO block check |

---

## 10. Acceptance criteria

A successful v2 integration on testing.pauv.com:

1. New user signs up at https://testing.pauv.com with first/last name + email + password.
2. User clicks Deposit → enters $1 → redirected to wallet-sandbox.paywithsoap.com.
3. User pays $1 in test crypto (Glide leg).
4. Soap fires `checkout.pending` then `checkout.succeeded` to our webhook → balance updates to $1.00 → modal shows "Deposit credited" via Realtime.
5. User clicks Withdraw → KYC modal appears (first time) → fills DOB + address + state + postal → submits → POST /kyc/upsert returns 200 → user_profiles.kyc_synced_at populated.
6. User enters withdrawal amount → redirected to Soap → completes withdrawal.
7. Soap fires `checkout.hold` → we debit + return 2xx within <1s → fires `checkout.succeeded` → withdrawal marked completed.
8. Ledger entries reconcile: `SUM(ledger_entries) = SUM(user_balances)`.
9. Zero `webhook_events.processing_status = 'failed'` rows over the smoke test window.

---

## 11. Open questions

These are intentional unknowns I'm flagging for the user — not blockers, but worth noting:

1. **State + country dropdowns vs free-text** — full US state list or just text? Going with `<select>` of all 50 + DC. Country `<select>` defaults to USA, hidden until user clicks "non-US" (v3 concern).
2. **SSN: optional or required?** Soap docs say optional. Crypto-rail withdrawal at scale may need it for compliance. v2 makes it optional; field shown but not required.
3. **Withdraw flag — `withdrawals_require_kyc`** — currently `false`. v2 sets it to `true` on cutover so the modal actually gates. Confirm intent.
4. **What happens if Soap KYC verification fails downstream?** Soap's hosted page handles its own verification; if it rejects, fires `checkout.terminally_failed`. Our `kyc_synced_at` stays populated (we synced the data; Soap rejected it). UX: show "We couldn't process your withdrawal. Update your details and try again."
5. **Phone number** — skipped in v2 entirely. Add back when Soap clarifies the regex they actually use.
