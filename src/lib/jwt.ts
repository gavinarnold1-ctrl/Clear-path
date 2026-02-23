/**
 * Edge-safe JWT utilities (no Node.js built-ins).
 * Used by both middleware (Edge Runtime) and server code (Node Runtime).
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'clear-path-session'

export interface SessionPayload {
  userId: string
  email: string
  name: string | null
}

function secret() {
  const raw = process.env.SESSION_SECRET
  if (!raw) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  return new TextEncoder().encode(raw)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

function isSessionPayload(p: unknown): p is SessionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Record<string, unknown>).userId === 'string' &&
    typeof (p as Record<string, unknown>).email === 'string'
  )
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!isSessionPayload(payload)) return null
    return { userId: payload.userId, email: payload.email, name: payload.name }
  } catch {
    return null
  }
}
