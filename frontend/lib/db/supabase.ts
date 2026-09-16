import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Self-contained Supabase client for the ported comment routes.
 *
 * Prefers the service-role key; falls back to the publishable (anon) key.
 * Sonotrade runs RLS-off, so the anon key can read/write `comments` +
 * `comment_likes`. Lazily resolved via a Proxy so importing this never throws
 * at build/page-data-collection time when a secret isn't configured.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client: SupabaseClient | null = null
function client(): SupabaseClient {
  if (_client) return _client
  const key = serviceKey || anonKey
  if (!url || !key) {
    throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + a key)')
  }
  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>
    const v = c[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v
  },
})
