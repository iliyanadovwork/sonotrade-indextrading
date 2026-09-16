/**
 * Minimal error reporting.
 *
 * There is no Sentry here and adding one needs an account and a DSN, so this
 * is the version that works today with nothing bought: every server error is
 * emitted as a single-line JSON object (greppable and parseable in whatever log
 * stream the platform gives you), and — if ERROR_WEBHOOK_URL is set — POSTed to
 * a webhook so a failure reaches a human without anyone tailing logs.
 *
 * Set ERROR_WEBHOOK_URL to a Slack or Discord incoming webhook to turn
 * alerting on. Unset, this degrades to structured logging and costs nothing.
 *
 * Deliberately dependency-free and non-throwing: an observability failure must
 * never become the outage. Every call is fire-and-forget.
 */

const WEBHOOK = process.env.ERROR_WEBHOOK_URL

/** Don't let one broken deploy spam a channel with thousands of messages. */
const MAX_ALERTS_PER_WINDOW = 20
const WINDOW_MS = 60_000
let windowStart = 0
let sentInWindow = 0

function withinAlertBudget(): boolean {
  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    windowStart = now
    sentInWindow = 0
  }
  if (sentInWindow >= MAX_ALERTS_PER_WINDOW) return false
  sentInWindow += 1
  return true
}

export interface ReportedError {
  route: string
  code: string
  requestId: string
  err: unknown
}

/**
 * Coerce anything thrown into an Error worth logging.
 *
 * Supabase/PostgREST rejections are plain objects, not Error instances, so the
 * obvious `new Error(String(err))` renders them as the literal string
 * "[object Object]" — which is how a failing insert reaches the log with its
 * message, code, details and hint all discarded. Pull those fields out
 * explicitly, and fall back to JSON for any other non-Error shape.
 *
 * Server-side only: `internalError` still returns just `{ error, request_id }`
 * to the client, so nothing widened here reaches a browser.
 */
function toLoggableError(err: unknown): Error {
  if (err instanceof Error) return err

  if (err !== null && typeof err === 'object') {
    const shape = err as Record<string, unknown>
    const parts = [
      typeof shape.message === 'string' ? shape.message : null,
      shape.code ? `code=${String(shape.code)}` : null,
      shape.details ? `details=${String(shape.details)}` : null,
      shape.hint ? `hint=${String(shape.hint)}` : null,
    ].filter(Boolean)

    if (parts.length > 0) return new Error(parts.join(' | '))

    try {
      return new Error(JSON.stringify(err))
    } catch {
      // Circular or otherwise unserialisable — fall through to String().
    }
  }

  return new Error(String(err))
}

export function reportError({ route, code, requestId, err }: ReportedError): void {
  const error = toLoggableError(err)

  // One line, valid JSON, so a log search can filter by route or code rather
  // than by eyeballing free text.
  console.error(
    JSON.stringify({
      level: 'error',
      route,
      code,
      request_id: requestId,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 4).join(' | '),
      at: new Date().toISOString(),
    }),
  )

  if (!WEBHOOK || !withinAlertBudget()) return

  // No await: a slow webhook must not add latency to an already-failing
  // request, and a failed webhook must not mask the original error.
  void fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🔴 *${route}* — ${code}\n\`${error.message}\`\nrequest_id: ${requestId}`,
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    /* alerting is best-effort by design */
  })
}
