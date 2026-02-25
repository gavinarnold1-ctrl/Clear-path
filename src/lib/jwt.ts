/**
 * Edge-safe JWT utilities (no Node.js built-ins).
 * Used by both middleware (Edge Runtime) and server code (Node Runtime).
 *
 * Access tokens: 1h expiry, contain user identity.
 * Refresh tokens: 7d expiry, contain user identity + tokenVersion for rotation.
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'clear-path-session'
export const REFRESH_COOKIE = 'clear-path-refresh'

export interface SessionPayload {
  userId: string
  email: string
  name: string | null
}

export interface RefreshPayload extends SessionPayload {
  tokenVersion: number
}

function secret() {
  const raw = process.env.SESSION_SECRET
  if (!raw) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  return new TextEncoder().encode(raw)
}

/** Sign an access token (1h expiry). */
export async function signAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret())
}

/** Sign a refresh token (7d expiry, includes tokenVersion for rotation). */
export async function signRefreshToken(payload: SessionPayload, tokenVersion: number): Promise<string> {
  return new SignJWT({ ...payload, tokenVersion, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

/** @deprecated Use signAccessToken instead. Kept for backward compatibility during migration. */
export const signToken = signAccessToken

function isSessionPayload(p: unknown): p is SessionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Record<string, unknown>).userId === 'string' &&
    typeof (p as Record<string, unknown>).email === 'string'
  )
}

function isRefreshPayload(p: unknown): p is RefreshPayload {
  if (!isSessionPayload(p)) return false
  return typeof (p as unknown as Record<string, unknown>).tokenVersion === 'number'
}

/** Verify an access token. Returns session payload or null. */
export async function verifyAccessToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!isSessionPayload(payload)) return null
    return { userId: payload.userId, email: payload.email, name: payload.name }
  } catch {
    return null
  }
}

/** Verify a refresh token. Returns payload including tokenVersion, or null. */
export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!isRefreshPayload(payload)) return null
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      tokenVersion: payload.tokenVersion,
    }
  } catch {
    return null
  }
}

/** @deprecated Use verifyAccessToken instead. */
export const verifyToken = verifyAccessToken
