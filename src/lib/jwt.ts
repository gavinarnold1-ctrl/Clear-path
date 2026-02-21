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
  const raw = process.env.SESSION_SECRET ?? 'dev-secret-change-in-prod-must-be-32-chars!!'
  return new TextEncoder().encode(raw)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
