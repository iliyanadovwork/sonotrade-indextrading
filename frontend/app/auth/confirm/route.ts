import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { canonicalOrigin } from '@/lib/canonical-origin'

/**
 * Email-confirmation callback using Supabase's **token-hash flow**.
 *
 * Why this exists alongside /auth/callback:
 *
 *   /auth/callback uses the PKCE `code` exchange, which requires the
 *   `code_verifier` cookie that was set in the browser that *initiated*
 *   signup. If the user opens the confirmation email in a different
 *   browser (Gmail web → Safari, Outlook → Chrome, phone → laptop),
 *   the verifier cookie isn't there and exchangeCodeForSession fails
 *   with the infamous "PKCE code verifier not found in storage" error.
 *
 *   The token-hash flow uses `verifyOtp({ token_hash, type })` which
 *   doesn't need a verifier — the token_hash itself is the proof.
 *   This makes email confirmation device- and browser-agnostic, which
 *   is what users actually expect.
 *
 * Activation:
 *
 *   This route only handles requests whose URL contains `token_hash`
 *   AND `type` (see Supabase email template snippets in the
 *   /auth/confirm migration note in AGENTS.md). The Supabase dashboard
 *   email templates must be edited to point links here rather than
 *   to /auth/callback. Until that dashboard change is made, this route
 *   is dormant and the old PKCE callback continues to serve.
 *
 * Security notes:
 *
 *   - `next` is validated to be a same-origin relative path; we never
 *     redirect to an attacker-controlled absolute URL.
 *   - On failure we log the raw error server-side and surface only an
 *     opaque short code via ?auth_error= so technical details (PKCE,
 *     framework names, hostnames) never reach the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = canonicalOrigin(request)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const rawNext = searchParams.get('next') ?? '/'
  const next = isSafeRelativePath(rawNext) ? rawNext : '/'

  if (!token_hash || !type) {
    const url = new URL(`${origin}/`)
    url.searchParams.set('auth_error', 'missing_token')
    return NextResponse.redirect(url)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (!error) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  console.error('[auth/confirm] verifyOtp failed:', {
    type,
    code: error.code,
    status: error.status,
    name: error.name,
  })
  const url = new URL(`${origin}/`)
  url.searchParams.set('auth_error', mapVerifyOtpErrorToCode(error.message))
  return NextResponse.redirect(url)
}

/**
 * Accept only same-origin, root-relative paths. Rejects `//evil.com`,
 * `http(s)://*`, and `javascript:` to prevent open-redirect abuse via
 * the `next` query param.
 */
function isSafeRelativePath(p: string): boolean {
  if (!p.startsWith('/')) return false
  if (p.startsWith('//')) return false
  return true
}

/**
 * Map a raw Supabase error message to a short opaque code that
 * friendlyAuthError() on the client knows how to render. We never put
 * the raw message in the URL — it leaks framework / DB / user-status
 * details and bloats the URL bar.
 */
function mapVerifyOtpErrorToCode(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('has expired')) return 'expired_token'
  if (m.includes('invalid') || m.includes('not found')) return 'invalid_token'
  return 'verify_failed'
}
