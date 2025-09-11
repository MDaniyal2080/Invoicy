import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl
  const url = new URL(request.url)

  // 0) Always normalize and then allow verify routes to proceed without any other checks
  if (pathname === '/verify-email') {
    const qToken = url.searchParams.get('token')
    if (qToken) {
      const dest = new URL(`/verify-email/${encodeURIComponent(qToken)}`, request.url)
      return NextResponse.redirect(dest)
    }
    return NextResponse.next()
  }
  if (pathname.startsWith('/verify-email/')) {
    return NextResponse.next()
  }
  if (pathname === '/email-verification') {
    const qToken = url.searchParams.get('token')
    if (qToken) {
      const dest = new URL(`/verify-email/${encodeURIComponent(qToken)}`, request.url)
      return NextResponse.redirect(dest)
    }
    // Allow the holding page
    return NextResponse.next()
  }

  // 1) Global compatibility: if any route (except reset-password and verify routes) has ?token=..., treat it as an email verify token
  {
    const qToken = url.searchParams.get('token')
    if (
      qToken &&
      !pathname.startsWith('/verify-email') &&
      pathname !== '/reset-password'
    ) {
      const dest = new URL(`/verify-email/${encodeURIComponent(qToken)}`, request.url)
      return NextResponse.redirect(dest)
    }
  }

  // Compatibility redirect for old email links like /dashboard?token=...
  if (pathname === '/dashboard') {
    const qToken = url.searchParams.get('token')
    if (qToken) {
      const dest = new URL(`/verify-email/${encodeURIComponent(qToken)}`, request.url)
      return NextResponse.redirect(dest)
    }
  }

  // Compatibility redirect for old email links that incorrectly include /dashboard prefix
  if (pathname.startsWith('/dashboard/verify-email')) {
    // Try to extract token from path segment /dashboard/verify-email/<token>
    const m = pathname.match(/^\/dashboard\/verify-email\/?([^/?#]+)?/)
    const pathToken = m && m[1] ? m[1] : undefined
    const queryToken = url.searchParams.get('token') || undefined
    const finalToken = pathToken || queryToken
    const dest = new URL('/verify-email', request.url)
    if (finalToken) dest.searchParams.set('token', finalToken)
    return NextResponse.redirect(dest)
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/register', 
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/email-verification',
    '/invoice',
    '/payment',
    '/_next',
    '/api/public'
  ]

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If accessing a public route, allow it
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Helper: decode base64url without verifying signature (safe for non-sensitive routing decisions)
  type JwtPayloadLike = { emailVerified?: boolean } & Record<string, unknown>
  const decodeJwtPayload = (jwt?: string): JwtPayloadLike | null => {
    try {
      if (!jwt) return null
      const parts = jwt.split('.')
      if (parts.length < 2) return null
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '==='.slice((base64.length + 3) % 4)
      const json = atob(padded)
      const parsed: unknown = JSON.parse(json)
      if (parsed && typeof parsed === 'object') return parsed as JwtPayloadLike
      return null
    } catch {
      return null
    }
  }

  // If token exists but user is not verified, block access to all non-public pages
  if (token) {
    const payload = decodeJwtPayload(token)
    const emailVerified = payload?.emailVerified === true
    const fromVerify = url.searchParams.get('fromVerify') === '1'
    if (!emailVerified && !fromVerify && !pathname.startsWith('/email-verification') && !pathname.startsWith('/verify-email')) {
      const url = new URL('/email-verification', request.url)
      return NextResponse.redirect(url)
    }
  }

  // If no token and trying to access protected route, redirect to login
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated but trying to access auth pages, redirect to verification check
  if (token && (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password'))) {
    return NextResponse.redirect(new URL('/email-verification', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/public (public API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/public|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
