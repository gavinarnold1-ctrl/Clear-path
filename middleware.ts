import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
} from '@/lib/jwt'

// Routes that require a valid session
const PROTECTED = ['/dashboard', '/insights', '/monthly-review', '/transactions', '/budgets', '/accounts', '/categories', '/spending', '/debts', '/settings', '/onboarding', '/reimport']
// Routes that logged-in users should not see
const AUTH_ROUTES = ['/login', '/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
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

      // Protected route with refreshed session — continue
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
  // Skip static assets and Next internals
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
