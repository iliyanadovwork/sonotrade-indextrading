# Soap Integration v2 — Staging Cutover Runbook

Run this once the PR is merged + `testing.pauv.com` has redeployed from the new staging tip. Sequence is deliberate — don't skip steps.

**Environment:** staging Supabase (`stcprpfshrcbajrxvxrq`) → testing.pauv.com (Amplify, staging branch).
**Estimated wall clock:** ~20 min including a $1 smoke deposit.
**Pre-condition:** Phase 1–7 code is in `staging` branch and Amplify build is green.

---

## Step 1 — Verify Amplify env vars (Manual, AWS Console)

Open Amplify Console → your testing.pauv.com app → Environment variables. Confirm ALL of these are set:

| Env var | Expected value | Source |
|---|---|---|
| `SOAP_API_KEY` | `key_...` | Soap Dashboard → Developer → API Keys |
| `SOAP_WEBHOOK_SIGNING_SECRET` | secret string | Soap Dashboard → Developer → Webhook Secret (click "Show") |
| `SOAP_CLIENT_SECRET` | `secr...` | Soap Dashboard → Developer → Client Secrets (browser-side device pings; not used in v2 but configured for future) |
| `SOAP_API_BASE_URL` | `https://api-sandbox.paywithsoap.com` | hardcoded sandbox |
| `APP_BASE_URL` | `https://testing.pauv.com` | matches Amplify domain |

If any are missing or stale, set them in Amplify Console → save → trigger a redeploy from the Amplify Console (the next git push would also trigger one, but a manual redeploy is faster). Wait for green.

The `amplify.yml` already has `SOAP_` in its env-var allowlist (Phase 1), so all of these will be baked into `.env.production` and reach the SSR Lambda at runtime.

---

## Step 2 — Register webhook URL on Soap dashboard

Soap Dashboard → Developer → Webhook Settings:

| Field | Value |
|---|---|
| **Webhook URL** | `https://testing.pauv.com/api/soap/webhook` |
| **Webhook Secret** | must match `SOAP_WEBHOOK_SIGNING_SECRET` set in Amplify in Step 1 |

Click **Save Webhook Settings**, then refresh the page — the URL should persist. If it reverts, the save failed (permission issue or backend error).

---

## Step 3 — Pre-flight probe (smoke test the route is up + HMAC layer is alive)

Open a terminal anywhere with curl. Hit the public webhook URL with an UNSIGNED body:

```bash
curl -sS -o /tmp/probe.json -w "HTTP %{http_code}\n" \
  -X POST https://testing.pauv.com/api/soap/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_id":"v2_cutover_probe","type":"checkout.pending","data":{}}'
cat /tmp/probe.json; echo; rm /tmp/probe.json
```

**Expected output:**
```
HTTP 400
{"error":"invalid_signature","request_id":"..."}
```

This proves:
- Amplify is serving the new code (Phase 3 route exists).
- HMAC verification is active (rejected our unsigned probe).
- Soap dashboard's Webhook Secret matches what's in Amplify (we don't know this yet — the next real webhook delivery will confirm).

If you get `HTTP 404`, deploy hasn't propagated yet — wait 1–2 min and re-probe.

---

## Step 4 — Verify feature flag defaults

Both flags relevant to this cutover are now set by the migration itself
(section 4 of `20260606000001_soap_integration_v2.sql` — force-updated on
re-apply too, so a `supabase db push` against prod lands both):

| Flag | Set to | Why |
|---|---|---|
| `payments_provider` | `"soap"` | going-forward default rail |
| `withdrawals_require_kyc` | `true` | KYC required for all withdrawals |

This step is now a verification, not a flip. Supabase Studio → SQL editor
(staging project `stcprpfshrcbajrxvxrq`):

```sql
select key, jsonb_value, bool_value
  from feature_flags
  where key in ('payments_provider', 'withdrawals_require_kyc',
                'soap_canary_user_ids', 'deposits_require_kyc');
```

Expected `select` output (after commit):

| key | jsonb_value | bool_value |
|---|---|---|
| deposits_require_kyc | NULL | false |
| payments_provider | "soap" | NULL |
| soap_canary_user_ids | [] | NULL |
| withdrawals_require_kyc | NULL | true |

After this commit, every user who hits Deposit or Withdraw routes through Soap. No browser refresh needed; the next deposit/withdraw click reads the new flag.

---

## Step 5 — Live smoke test (E2E happy path)

Sign in to `testing.pauv.com` as any test user (your own account works). Watch four places simultaneously:

| Window | What to watch |
|---|---|
| Browser → `/portfolio` | Modal flow + return overlay |
| Soap Dashboard → **Webhook Events** | Delivery attempts + response codes |
| Supabase Studio → `pending_deposits` / `webhook_events` / `user_balances` / `ledger_entries` | Row writes |
| Amplify Console → CloudWatch logs for the SSR Lambda | Server-side errors (if any) |

### 5a. Deposit $1

1. Click **Deposit** → enter `1` → Next.
2. Browser redirects to `https://wallet-sandbox.paywithsoap.com/...`.
3. Pay with the **crypto / USDC** option (banking rails aren't enabled on Pauv's sandbox account — see `project_soap_account_flow.md` in memory).
4. Soap redirects back to `https://testing.pauv.com/portfolio?deposit=<uuid>`.
5. SoapPaymentReturn overlay shows "Verifying deposit" (honest copy).
6. Within ~30s the overlay flips to **"Deposit credited"** as Soap fires `checkout.pending` → `checkout.succeeded`.

**Success signature:**
- Soap dashboard → Webhook Events: two 200 responses (pending + succeeded).
- `webhook_events`: 2 new rows, `processing_status = 'processed'`, `error IS NULL`.
- `pending_deposits.status` for the row: `pending` → `credited`. `soap_charge_id` populated. `soap_amount_cents = 100`. `amount_microusdc_actual = 1000000`.
- `user_balances.available_microusdc` jumps from `0` to `1000000` (= $1.00).
- `ledger_entries`: new row with `kind='deposit_credit'`, `direction='credit'`, `amount_microusdc=1000000`, `idempotency_key='deposit_credit:<deposit_uuid>'`.

### 5b. Withdraw the $1

1. Click **Withdraw**.
2. Modal opens → "Loading…" → since `kyc_synced_at IS NULL`, it shows **KycRequiredStep** with shield icon. KycModal opens on top.
3. Fill in DOB, street, city, state (dropdown), ZIP. SSN and phone optional. Click **Save and continue**.
4. KycModal closes → WithdrawModal shows **SoapConfirmStep** with available balance `$1.00`.
5. Click **Continue to checkout** → browser redirects to Soap.
6. Pick a crypto payout option, confirm withdrawal.
7. Soap redirects back to `/portfolio?withdrawal=<uuid>`.
8. Overlay shows "Verifying withdrawal" → within ~30s flips to **"Withdrawal complete"**.

**Success signature:**
- Soap → Webhook Events: `checkout.hold` (200, within ~2s), `checkout.succeeded` (200).
- `webhook_events`: 2 new rows, processed.
- `withdrawals.status`: `pending` → `processing` (after hold) → `completed`.
- `user_balances.available_microusdc` back to `0`. `pending_withdrawal_microusdc` momentarily nonzero then `0` after `succeeded`.
- `ledger_entries`: new row with `kind='withdrawal_request'`, `direction='debit'`.
- `user_profiles.kyc_synced_at` populated. `kyc_status` = `'pending'`.

### Reconciliation invariant

```sql
-- Should always hold: ledger net = balance per user.
select u.id, u.email,
       b.available_microusdc,
       coalesce(sum(
         case l.direction
           when 'credit' then l.amount_microusdc
           else -l.amount_microusdc
         end
       ), 0) as ledger_net
  from auth.users u
  left join user_balances b on b.user_id = u.id
  left join ledger_entries l on l.account_id = u.id
  group by u.id, u.email, b.available_microusdc;
```

`available_microusdc - ledger_net` should be **0** for every user. If it's non-zero, the ledger and balance drifted — STOP and investigate before allowing more activity.

---

## Step 6 — Rollback (if anything looks wrong)

### Soft revert (fast, no schema change) — flips users back to Solana

```sql
-- Instant rollback. Soap code stays in the tree but no user routes to it.
-- In-flight Soap deposits/withdrawals continue to settle via webhook
-- (we just stop creating new ones).
begin;
update feature_flags
  set jsonb_value = '"solana"'::jsonb
  where key = 'payments_provider';
update feature_flags
  set bool_value = false
  where key = 'withdrawals_require_kyc';
commit;
```

Take effect: next deposit/withdraw click.

### Soft revert + disable transactions entirely

If something is so broken that even Solana shouldn't be allowed:

```sql
update feature_flags set bool_value = false where key = 'deposits_enabled';
update feature_flags set bool_value = false where key = 'withdrawals_enabled';
```

### Webhook URL: also point Soap dashboard away

Soap Dashboard → Developer → Webhook URL → blank it out + Save. Soap stops trying to deliver to us until we re-register.

### Hard revert (schema)

ONLY if the schema itself is the problem. The companion file at `supabase/rollbacks/20260606000001_soap_integration_v2.rollback.sql` archives Soap rows + drops all the columns. **Not in `supabase/migrations/` — never auto-applied.** Apply manually via psql or Supabase SQL editor only after:
1. Soft revert is already in place (above).
2. No in-flight Soap deposits/withdrawals — all in terminal states.
3. Fresh point-in-time backup taken.

---

## Step 7 — Monitor for 24h post-cutover

Spot-check the following twice in the first 24h:

- **Soap Dashboard → Webhook Events**: any non-2xx attempts indicate a code regression. Drill in.
- **Supabase Studio → `webhook_events` WHERE processing_status='failed'**: should be empty.
- **Reconciliation invariant from §5**: should hold for every user.
- **Amplify CloudWatch logs**: grep for `[soap/webhook]`, `[ensureSoapCustomer]`, `[withdrawals/create] soap create failed` — should be quiet outside of expected pending/succeeded flows.

If anything looks off, default to the soft revert in §6 and ping me with the discrepancy.

---

## Appendix: known operational quirks (carried from v1)

1. **`checkout.hold` is single-shot.** Soap does NOT retry holds. If our `/api/soap/webhook` returns 5xx during a hold, that withdrawal halts at Soap's side. Our handler is built to respond <2s; any handler exception is logged at ERROR level so on-call can catch it.
2. **`return_url` is the SAME for completion AND cancellation.** The user lands at `/portfolio?deposit=<id>` either way. SoapPaymentReturn shows "Verifying deposit" until the row state changes via webhook (or the user dismisses). This is intentional — don't change the copy to claim success.
3. **Phone number is omitted from `POST /customers`** if it doesn't normalize to exactly 10 digits via `normalizePhoneForSoap`. Soap's regex rejected E.164-with-plus in v1. v2 omits malformed phones entirely; KYC can supply phone optionally.
4. **`provider` field on canary users.** If someone is in `soap_canary_user_ids`, they get Soap regardless of the global flag. Soft revert flipping the global to `solana` does NOT remove them from canary. To fully revert one user:
   ```sql
   update feature_flags
     set jsonb_value = '[]'::jsonb
     where key = 'soap_canary_user_ids';
   ```
5. **Glide wallet rebalance is manual.** Aiden tops up the payout wallet (`ENA6...awTe`) from the main wallet via the Glide dashboard when it runs low. Soap can only pay out from the payout wallet — if it runs dry, withdrawals will fail (or get queued — depends on Glide's behavior).
