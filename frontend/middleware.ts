import { NextResponse, NextRequest } from 'next/server'

const PROTECTED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/clients',
  '/invoices',
  '/payments',
  '/reports',
  '/settings',
]

const PUBLIC_AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('access_token')?.value

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const isPublicAuth = PUBLIC_AUTH_PATHS.includes(pathname)

  // If not authenticated and accessing a protected route, redirect to login
  if (!token && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // If authenticated and accessing an auth page, redirect to dashboard
  if (token && isPublicAuth) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/clients/:path*',
    '/invoices/:path*',
    '/payments/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ],
}
