import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * Custom-JWT auth helpers. Single source of truth for the signing secret and
 * for token verification — no route may read process.env.JWT_SECRET directly.
 *
 * The app issues its own JWT on login (see app/api/auth/login) and stores it in
 * the `auth_token` httpOnly cookie. Server Components can only read the cookie;
 * client API calls send `Authorization: Bearer <token>`. These helpers accept
 * either.
 */

/**
 * Fail closed: a missing or trivially-short secret is a deployment fault, not
 * something to paper over with a default. A hardcoded fallback here would mean
 * anyone reading this repo can forge a token for any user, and — because the
 * fallback differs per file when copy-pasted — that logins mint tokens the
 * trade routes then reject. Throwing at import time surfaces the misconfig on
 * the first request instead.
 *
 * NOTE FOR DEPLOYERS: JWT_SECRET must be present in the SSR runtime env. On
 * Amplify that means it has to match the grep allowlist in amplify.yml.
 */
function resolveSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 chars. Generate one with `openssl rand -base64 48` and set it in the runtime environment.'
    )
  }
  return secret
}

export const AUTH_COOKIE = 'auth_token'

const JWT_ALGORITHM = 'HS256' as const
const JWT_ISSUER = 'sonotrade'

export interface AuthClaims {
  userId: string
  email: string
  username: string
}

/** Verify a raw JWT string. Returns claims or null. */
export function verifyToken(token: string | undefined | null): AuthClaims | null {
  if (!token) return null
  try {
    // Algorithm is pinned so a token can never be accepted under an algorithm
    // we did not intend to issue.
    const decoded = jwt.verify(token, resolveSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    }) as Partial<AuthClaims>
    if (!decoded?.userId) return null
    return {
      userId: String(decoded.userId),
      email: String(decoded.email ?? ''),
      username: String(decoded.username ?? ''),
    }
  } catch {
    return null
  }
}

/** Sign a JWT for a user (used by login/signup/verify-otp). */
export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, resolveSecret(), {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    expiresIn: '7d',
  })
}

/**
 * Resolve the current user's claims in a Server Component / Server Action by
 * reading the auth cookie. Returns null when signed out.
 */
export async function getAuthClaims(): Promise<AuthClaims | null> {
  const store = await cookies()
  return verifyToken(store.get(AUTH_COOKIE)?.value)
}

/** Just the user id, or null. */
export async function getUserId(): Promise<string | null> {
  return (await getAuthClaims())?.userId ?? null
}

/**
 * Resolve claims inside a Route Handler from EITHER the Authorization: Bearer
 * header (client calls) OR the auth cookie.
 */
export function getClaimsFromRequest(request: Request): AuthClaims | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const fromHeader = verifyToken(authHeader.substring(7))
    if (fromHeader) return fromHeader
  }
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match ? verifyToken(decodeURIComponent(match[1])) : null
}

/**
 * Route-handler guard. Returns either the claims or a ready-to-return 401 —
 * so callers do their own `if ('response' in auth) return auth.response`
 * without duplicating verification logic (or the secret) per file.
 */
export type AuthResult = { claims: AuthClaims } | { response: NextResponse }

export function requireAuth(request: Request): AuthResult {
  const claims = getClaimsFromRequest(request)
  if (!claims) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { claims }
}
