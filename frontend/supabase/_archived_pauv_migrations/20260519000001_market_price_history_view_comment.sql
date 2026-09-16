-- ════════════════════════════════════════════════════════════════════
-- Document the SECURITY DEFINER decision on market_price_history.
-- ════════════════════════════════════════════════════════════════════
--
-- Supabase's Security Advisor flags every view that isn't created with
-- `security_invoker = true` (the `security_definer_view` lint), because
-- those views run with the OWNER's privileges and bypass RLS on the
-- underlying tables. That's usually a mistake — but in this case it's
-- deliberate, and the original migration (20260507000004) explains why.
--
-- This migration writes that rationale into a real Postgres COMMENT so
-- the Supabase UI surfaces it alongside the lint. Reviewers (now and
-- later) see the intent without having to dig through migration history,
-- and the lint can be safely dismissed in the advisor with a note
-- pointing at this comment.
--
-- Net change: zero behavioral. Comments are metadata only.

comment on view public.market_price_history is
  'SECURITY DEFINER by design — runs as view owner so RLS on the underlying transactions table is bypassed. The view exposes ONLY non-PII columns (market_id, q_before, q_after, price_before_cents, price_after_cents, action, created_at); user_id, cash_amount_microusdc, fee_microusdc, position_id, and idempotency_key are intentionally excluded so the column list itself is the security boundary. Required so the public NPSI price chart renders the full trade history of every market to anon viewers and to authenticated users other than the trader. See migration 20260507000004 for the original rationale and 20260519000001 for the dismissal context. The `security_definer_view` Supabase advisor lint can be marked intentional for this entity.';
