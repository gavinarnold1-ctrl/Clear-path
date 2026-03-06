import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
} from '@/lib/jwt'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// Routes that require a valid session
const PROTECTED = ['/dashboard', '/insights', '/monthly-review', '/spending-analytics', '/forecast', '/transactions', '/budgets', '/accounts', '/categories', '/spending', '/debts', '/properties', '/settings', '/onboarding', '/reimport']
// Routes that logged-in users should not see
const AUTH_ROUTES = ['/login', '/register']

/** Determine rate limit group for an API route. */
function getApiRateLimitGroup(pathname: string) {
  if (pathname === '/api/auth/demo' || pathname === '/api/auth/refresh') return 'login' as const
  if (pathname.startsWith('/api/plaid/')) return 'plaid' as const
  if (pathname.startsWith('/api/transactions/import')) return 'import' as const
  return 'general' as const
}

/** Extract IP from request for rate limiting. */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── API Rate Limiting ─────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const group = getApiRateLimitGroup(pathname)
    const config = RATE_LIMITS[group]

    // For auth endpoints, use IP. For others, try userId from token, fallback to IP.
    let key: string
    if (group === 'login') {
      key = `${group}:${getClientIp(req)}`
    } else {
      const accessToken = req.cookies.get(SESSION_COOKIE)?.value
      const session = accessToken ? await verifyAccessToken(accessToken) : null
      key = session ? `${group}:${session.userId}` : `${group}:${getClientIp(req)}`
    }

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

    return NextResponse.next()
  }

  // ── Page Route Auth ───────────────────────────────────────────────────────
  // Rate limit the server action endpoints (login/register form submissions)
  // Server actions use POST to page routes, so check registration/login pages
  if (req.method === 'POST' && pathname === '/register') {
    const ip = getClientIp(req)
    const result = checkRateLimit(`register:${ip}`, RATE_LIMITS.register.maxRequests, RATE_LIMITS.register.windowMs)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }
  if (req.method === 'POST' && pathname === '/login') {
    const ip = getClientIp(req)
    const result = checkRateLimit(`login:${ip}`, RATE_LIMITS.login.maxRequests, RATE_LIMITS.login.windowMs)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  const accessToken = req.cookies.get(SESSION_COOKIE)?.value
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value

  let session = accessToken ? await verifyAccessToken(accessToken) : null

  // If access token expired but refresh token is valid, auto-refresh the access token.
  // This is a "soft" refresh using the signed JWT payload — no DB call needed in Edge.
  // The dedicated /api/auth/refresh endpoint handles full rotation with DB version check.
  if (!session && refreshToken) {
    const refreshPayload = await verifyRefreshToken(refreshToken)
    if (refreshPayload) {
      session = {
        userId: refreshPayload.userId,
        email: refreshPayload.email,
        name: refreshPayload.name,
      }

      // Issue a new access token and set it on the response
      const newAccessToken = await signAccessToken(session)
      const response = NextResponse.next()
      response.cookies.set(SESSION_COOKIE, newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      })

      const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
      const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))

      if (isAuthRoute && session) {
        const redirect = NextResponse.redirect(new URL('/dashboard', req.url))
        redirect.cookies.set(SESSION_COOKIE, newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60,
          path: '/',
        })
        return redirect
      }

      if (isProtected) return response
      return response
    }
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes including API (but skip static assets and Next internals)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
