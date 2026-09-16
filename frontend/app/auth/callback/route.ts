import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canonicalOrigin } from '@/lib/canonical-origin'

/**
 * PKCE callback for OAuth (Google) and any legacy email-confirmation
 * links still pointing at /auth/callback.
 *
 * The PKCE `code` exchange requires the `code_verifier` cookie set by
 * the browser that *initiated* the auth flow. That's correct for OAuth
 * (which starts and finishes in the same tab) but breaks email
 * confirmation across browsers — see /auth/confirm/route.ts for the
 * cross-browser-safe token-hash flow that replaces it.
 *
 * Error handling:
 *
 *   On failure we redirect to `/?auth_error=<short_code>`. The AuthForm
 *   reads that code via friendlyAuthError(…, "callback") and renders a
 *   user-facing message. We deliberately do NOT put the raw Supabase
 *   `error.message` in the URL — it leaks PKCE internals, hostnames,
 *   and framework names (verbatim "PKCE code verifier not found in
 *   storage… use @supabase/ssr…" was being shown to users in prod).
 *
 * Origin resolution is delegated to `canonicalOrigin(request)` so the
 * post-login redirect lands on the user's actual host regardless of
 * Amplify SSR's internal-Lambda Host header quirk.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = canonicalOrigin(request)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/trade'
  const next = isSafeRelativePath(rawNext) ? rawNext : '/trade'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', {
      code: error.code,
      status: error.status,
      name: error.name,
      message: error.message,
    })
    const url = new URL(`${origin}/`)
    url.searchParams.set('auth_error', mapExchangeErrorToCode(error.message))
    return NextResponse.redirect(url)
  }

  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error') ?? 'missing_code'
  console.error('[auth/callback] no code:', providerError)
  const url = new URL(`${origin}/`)
  url.searchParams.set('auth_error', mapProviderErrorToCode(providerError))
  return NextResponse.redirect(url)
}

function isSafeRelativePath(p: string): boolean {
  if (!p.startsWith('/')) return false
  if (p.startsWith('//')) return false
  return true
}

function mapExchangeErrorToCode(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('pkce') || m.includes('code verifier') || m.includes('code_verifier')) {
    return 'pkce_mismatch'
  }
  if (m.includes('expired')) return 'expired_token'
  if (m.includes('invalid')) return 'invalid_token'
  return 'exchange_failed'
}

function mapProviderErrorToCode(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('access_denied') || m.includes('user denied')) return 'access_denied'
  if (m === 'missing_code') return 'missing_code'
  return 'provider_error'
}
