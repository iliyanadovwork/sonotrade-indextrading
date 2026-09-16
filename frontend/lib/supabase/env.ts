// Single source of truth for the Supabase publishable (a.k.a. anon) key.
//
// History: OLD reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`; NEW originally
// switched to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's newer
// preferred name). They hold the same JWT — only the env-var name
// differs. Reading either lets a single deploy env serve both apps.

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export function requireSupabaseAnonKey(): string {
  const key = SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set"
    );
  }
  return key;
}
