import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase clients. Mirrors frontend/lib/supabase/server.ts.
 *
 * - `supabaseAdmin`: service-role client (bypasses RLS) for waitlist writes.
 *   Lazily resolved via a Proxy so importing this module never throws at
 *   build/import time when SUPABASE_SERVICE_ROLE_KEY isn't set yet. When the
 *   service-role key is absent it falls back to the public (anon) client so
 *   reads still work — this project runs RLS-off and gates in app code.
 * - `supabase`: public/anon client for reads (artists, prices).
 *
 * NEVER import these into a "use client" module — the service role key must
 * never reach the browser.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _admin: SupabaseClient | null = null
let _public: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    )
  }
  _admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

export function getSupabasePublic(): SupabaseClient {
  if (_public) return _public
  if (!supabaseUrl || !anonKey) {
    // No anon key configured — fall back to service role if available.
    return getSupabaseAdmin()
  }
  _public = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _public
}

/** Resolve the privileged client, falling back to public when no service key. */
function resolvePrivileged(): SupabaseClient {
  return serviceRoleKey ? getSupabaseAdmin() : getSupabasePublic()
}

/** Service-role (privileged) client. Lazily resolved via Proxy. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = resolvePrivileged() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value
  },
})

/** Public/anon client for reads. Lazily resolved via Proxy. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabasePublic() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value
  },
})
