import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifyToken } from '@/lib/jwt'

// Routes that require a valid session
const PROTECTED = ['/dashboard', '/transactions', '/budgets', '/accounts']
// Routes that logged-in users should not see
const AUTH_ROUTES = ['/login', '/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifyToken(token) : null

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
