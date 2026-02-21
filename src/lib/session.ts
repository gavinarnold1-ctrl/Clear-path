/**
 * Session management for Server Components and Route Handlers (Node Runtime).
 * Do NOT import this file from middleware — use src/lib/jwt.ts directly there.
 */
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SessionPayload, signToken, verifyToken } from './jwt'

export type { SessionPayload }

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await signToken(payload)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
