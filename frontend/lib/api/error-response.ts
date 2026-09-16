import { NextResponse } from 'next/server'
import { reportError } from '@/lib/observability'

/**
 * Standard 5xx response shape for API routes.
 *
 * Why this exists: routes used to do
 *   `NextResponse.json({ error, detail: e.message }, { status: 500 })`
 * which leaks raw `Error.message` to the client. That message can
 * include database hostnames, postgres usernames, internal stack
 * frames, etc. — useful for an attacker doing reconnaissance, and of
 * zero use to the legitimate browser client.
 *
 * This helper:
 *   1. Mints a `request_id` (UUID).
 *   2. Logs the full error server-side, tagged with `request_id` and a
 *      route label, so support can correlate user reports to log lines.
 *   3. Returns only `{ error, request_id }` to the client.
 *
 * Use for any 500-class branch in an API route. Do NOT use for
 * user-facing 4xx errors that intentionally carry a `message` field
 * (e.g. `underwater_rejected` with a "try again in a few seconds"
 * hint) — those are deliberate, non-leaking, and useful to clients.
 */
export interface InternalErrorOpts {
  /** Stable route label for log correlation, e.g. "forecasts.close". */
  routeName: string
  /** The caught error. Anything — coerced to string for logging. */
  err: unknown
  /** Public error code returned to the client. Defaults to "internal_error". */
  code?: string
  /** HTTP status. Defaults to 500. */
  status?: number
}

export function internalError(opts: InternalErrorOpts): NextResponse {
  const code = opts.code ?? 'internal_error'
  const status = opts.status ?? 500
  const requestId = crypto.randomUUID()
  // Every 500 now goes through reportError: structured JSON to the log stream,
  // and an alert to ERROR_WEBHOOK_URL when one is configured. Routing it here
  // rather than at each of the 50+ console.error call sites means the branch
  // that actually returns a 500 to a user is the branch that pages someone.
  reportError({ route: opts.routeName, code, requestId, err: opts.err })
  return NextResponse.json({ error: code, request_id: requestId }, { status })
}
