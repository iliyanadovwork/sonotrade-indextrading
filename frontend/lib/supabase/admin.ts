import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAnonKey } from "./env";

/**
 * Service-role Supabase client for server-side write paths that bypass RLS.
 *
 * Use sparingly. The canonical write path is the engine adapter; this client
 * is for narrow carve-outs (idempotency cache, rate-limit token bucket) where
 * an Edge Function would be over-engineered.
 *
 * Pattern:
 *   - Authenticate / validate the request at the API route boundary.
 *   - Use this client to call a SECURITY DEFINER RPC or a narrow admin write.
 *   - Never expose the service-role key to the browser.
 */
/**
 * Anon-key Supabase client for server-side public reads (profile lists, search).
 * Synchronous — no cookie / session overhead. Safe for routes where RLS anon
 * access is intentional and data is not user-specific.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return createClient(url, requireSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
