/**
 * Rate-limiting helper for API route handlers.
 * Wraps a Next.js route handler and applies rate limiting before execution.
 * Returns 429 Too Many Requests with Retry-After header when limit is exceeded.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from './rate-limit'
import { verifyAccessToken, verifyRefreshToken, SESSION_COOKIE, REFRESH_COOKIE } from './jwt'

type RouteGroup = keyof typeof RATE_LIMITS

/** Determine which rate limit group a request belongs to. */
function getRouteGroup(pathname: string): RouteGroup {
  if (pathname === '/api/auth/demo') return 'login'
  if (pathname === '/api/auth/refresh') return 'login'
  if (pathname.startsWith('/api/plaid/')) return 'plaid'
  if (pathname.startsWith('/api/transactions/import')) return 'import'
  return 'general'
}

/** Extract a rate limit key from the request. Auth routes use IP; others use userId. */
async function getRateLimitKey(
  req: NextRequest,
  group: RouteGroup
): Promise<string> {
  // Auth routes (login, register) use IP since the user isn't authenticated yet
  if (group === 'login' || group === 'register') {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    return `${group}:${ip}`
  }

  // Authenticated routes use userId
  const accessToken = req.cookies.get(SESSION_COOKIE)?.value
  if (accessToken) {
    const session = await verifyAccessToken(accessToken)
    if (session) return `${group}:${session.userId}`
  }

  // Try refresh token as fallback
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value
  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken)
    if (payload) return `${group}:${payload.userId}`
  }

  // Fallback to IP for unauthenticated requests
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `${group}:${ip}`
}

/**
 * Apply rate limiting to a request. Returns a 429 response if limited, or null if allowed.
 */
export async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const group = getRouteGroup(req.nextUrl.pathname)
  const config = RATE_LIMITS[group]
  const key = await getRateLimitKey(req, group)
  const result = checkRateLimit(key, config.maxRequests, config.windowMs)

  if (!result.allowed) {
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
    if (result.retryAfterSeconds !== null) {
      response.headers.set('Retry-After', String(result.retryAfterSeconds))
    }
    return response
  }

  return null
}
