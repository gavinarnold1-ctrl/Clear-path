/**
 * Session management for Server Components and Route Handlers (Node Runtime).
 * Do NOT import this file from middleware — use src/lib/jwt.ts directly there.
 *
 * Uses two HttpOnly cookies:
 * - clear-path-session: access token (1h), used for authentication
 * - clear-path-refresh: refresh token (7d), used to obtain new access tokens
 * Both use SameSite=Strict for CSRF protection.
 */
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  SessionPayload,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from './jwt'

export type { SessionPayload }

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'strict' as const,
  path: '/',
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyAccessToken(token)
}

/**
 * Set both access and refresh cookies.
 * tokenVersion defaults to 0 for new sessions; pass the current DB value for refreshes.
 */
export async function setSession(payload: SessionPayload, tokenVersion = 0): Promise<void> {
  const accessToken = await signAccessToken(payload)
  const refreshToken = await signRefreshToken(payload, tokenVersion)
  const store = await cookies()

  store.set(SESSION_COOKIE, accessToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60, // 1 hour
  })

  store.set(REFRESH_COOKIE, refreshToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

/** Set only the access token cookie (used during middleware auto-refresh). */
export async function setAccessCookie(payload: SessionPayload): Promise<void> {
  const token = await signAccessToken(payload)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    ...COOKIE_BASE,
    maxAge: 60 * 60, // 1 hour
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(REFRESH_COOKIE)
}
