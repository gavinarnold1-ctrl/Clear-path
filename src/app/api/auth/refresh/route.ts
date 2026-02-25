import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from '@/lib/jwt'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'strict' as const,
  path: '/',
}

/**
 * POST /api/auth/refresh
 * Validates the refresh token, checks tokenVersion against the database,
 * rotates the refresh token (increment version), and issues new access + refresh tokens.
 */
export async function POST() {
  const store = await cookies()
  const refreshToken = store.get(REFRESH_COOKIE)?.value

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) {
    // Invalid or expired refresh token — clear cookies
    store.delete(SESSION_COOKIE)
    store.delete(REFRESH_COOKIE)
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
  }

  // Verify tokenVersion against the database (rotation check)
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, refreshTokenVersion: true },
  })

  if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
    // Token version mismatch — token was already used or revoked
    store.delete(SESSION_COOKIE)
    store.delete(REFRESH_COOKIE)
    return NextResponse.json({ error: 'Refresh token revoked' }, { status: 401 })
  }

  // Rotate: increment version in DB so old refresh token is now invalid
  const updated = await db.user.update({
    where: { id: user.id },
    data: { refreshTokenVersion: { increment: 1 } },
    select: { refreshTokenVersion: true },
  })

  const sessionPayload = { userId: user.id, email: user.email, name: user.name }
  const newAccessToken = await signAccessToken(sessionPayload)
  const newRefreshToken = await signRefreshToken(sessionPayload, updated.refreshTokenVersion)

  store.set(SESSION_COOKIE, newAccessToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60, // 1 hour
  })

  store.set(REFRESH_COOKIE, newRefreshToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return NextResponse.json({ success: true })
}
