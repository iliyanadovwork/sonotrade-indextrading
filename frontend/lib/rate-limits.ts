import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  perMinute: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_token", {
    p_bucket: bucket,
    p_max: perMinute,
  });
  if (error) {
    console.error("[rate-limit] consume_token failed", error);
    return true; // fail open
  }
  return data === true;
}

export function callerIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
