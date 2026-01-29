'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import apiClient from '@/lib/api-client'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function VerifyEmailByTokenPage() {
  const router = useRouter()
  const { token: tokenParam } = useParams<{ token: string }>() as { token: string }
  const token = tokenParam || ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const addNotification = useUIStore((s) => s.addNotification)
  const ranRef = useRef(false)

  useEffect(() => {
    const run = async () => {
      console.log('[verify-email/[token]] token from params:', token)
      if (!token) {
        setStatus('error')
        setMessage('Missing verification token')
        return
      }
      if (ranRef.current) {
        console.log('[verify-email/[token]] skipped duplicate run')
        return
      }
      ranRef.current = true
      setStatus('loading')
      try {
        console.log('[verify-email/[token]] calling apiClient.verifyEmail')
        const res = await apiClient.verifyEmail(token)
        console.log('[verify-email/[token]] backend response', res)
        setStatus('success')
        setMessage(res?.message || 'Email verified successfully')

        // If user is logged in in this browser, refresh JWT so middleware sees emailVerified=true
        const existingToken = apiClient.getToken()
        if (existingToken) {
          try {
            console.log('[verify-email/[token]] refreshing token after verification')
            const resp = await (apiClient as any).client?.post?.('/auth/refresh')
            const newToken = resp?.data?.access_token
            if (newToken) {
              const remember = typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : undefined
              // @ts-ignore - setToken signature accepts rememberMe optional
              apiClient.setToken(newToken, remember)
            } else {
              console.warn('[verify-email/[token]] refresh response had no access_token')
            }
            // Update auth store user state
            try {
              const me = await apiClient.getMe()
              useAuthStore.getState().setUser({
                id: me.id,
                email: me.email,
                firstName: me.firstName,
                lastName: me.lastName,
                companyName: me.companyName,
                role: me.role,
                emailVerified: !!me.emailVerified,
              })
            } catch (e) {
              console.warn('[verify-email/[token]] getMe failed after refresh', e)
            }
            addNotification({ type: 'success', title: 'Email verified', message: 'You can now access your dashboard.' })
            // Go straight to dashboard with a hard navigation so middleware reads the new cookie
            if (typeof window !== 'undefined') {
              window.location.href = '/dashboard?fromVerify=1'
            } else {
              router.replace('/dashboard?fromVerify=1')
            }
            return
          } catch (e) {
            console.warn('[verify-email/[token]] refresh after verify failed (likely not logged in)', e)
            // If refresh failed while logged in, fall through to login as a safe default
            router.replace('/login')
            return
          }
        } else {
          // Attempt to recover cookie-only sessions (middleware saw a cookie but storage is empty)
          try {
            const cookieStr = typeof document !== 'undefined' ? document.cookie || '' : ''
            const raw = cookieStr.split('; ').find((c) => c.startsWith('access_token='))
            const cookieToken = raw ? decodeURIComponent(raw.split('=')[1] || '') : ''
            if (cookieToken) {
              console.log('[verify-email/[token]] found cookie token, syncing and refreshing')
              const remember = typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : undefined
              // @ts-ignore
              apiClient.setToken(cookieToken, remember)
              try {
                const resp2 = await (apiClient as any).client?.post?.('/auth/refresh')
                const newToken2 = resp2?.data?.access_token
                if (newToken2) {
                  // @ts-ignore
                  apiClient.setToken(newToken2, remember)
                }
                try {
                  const me2 = await apiClient.getMe()
                  useAuthStore.getState().setUser({
                    id: me2.id,
                    email: me2.email,
                    firstName: me2.firstName,
                    lastName: me2.lastName,
                    companyName: me2.companyName,
                    role: me2.role,
                    emailVerified: !!me2.emailVerified,
                  })
                } catch (e) {
                  console.warn('[verify-email/[token]] getMe after cookie refresh failed', e)
                }
                addNotification({ type: 'success', title: 'Email verified', message: 'You can now access your dashboard.' })
                if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard?fromVerify=1'
                } else {
                  router.replace('/dashboard?fromVerify=1')
                }
                return
              } catch (e) {
                console.warn('[verify-email/[token]] refresh after cookie sync failed', e)
              }
            }
          } catch (e) {
            console.warn('[verify-email/[token]] cookie inspection failed', e)
          }
          // Not logged in in this browser: verification done, send user to sign-in page
          // Clear any stale token cookie to prevent middleware from forcing /email-verification
          try { apiClient.clearToken() } catch {}
          addNotification({ type: 'success', title: 'Email verified', message: 'Please sign in to continue.' })
          router.replace('/login')
          return
        }
      } catch (err: any) {
        console.error('[verify-email/[token]] verification failed', err)
        // Fallback: if the token was already consumed by a previous call (e.g., duplicate run),
        // check current session state and attempt to refresh if user is already verified in DB
        try {
          const cookieStr = typeof document !== 'undefined' ? document.cookie || '' : ''
          const hasCookie = cookieStr.split('; ').some((c) => c.startsWith('access_token='))
          const storageToken = apiClient.getToken()
          if (hasCookie || storageToken) {
            try {
              const me = await apiClient.getMe()
              if (me?.emailVerified) {
                try {
                  const resp = await (apiClient as any).client?.post?.('/auth/refresh')
                  const newToken = resp?.data?.access_token
                  if (newToken) {
                    const remember = typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : undefined
                    // @ts-ignore
                    apiClient.setToken(newToken, remember)
                  }
                  addNotification({ type: 'success', title: 'Email verified', message: 'You can now access your dashboard.' })
                  if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard?fromVerify=1'
                  } else {
                    router.replace('/dashboard?fromVerify=1')
                  }
                  return
                } catch (e) {
                  // ignore refresh error and fall through
                }
              }
            } catch {
              // not logged in or cannot fetch me, fall through
            }
          }
        } catch {}

        setStatus('error')
        setMessage(err?.response?.data?.message || 'Invalid or expired verification link')
      }
    }
    run()
  }, [token, router, addNotification])

  return (
    <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Verify Email</h2>
          <p className="text-sm text-slate-600">{message || 'Verifying your email, please wait...'}</p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-center gap-3">
          {status === 'loading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
          ) : status === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
          <span>
            {status === 'success'
              ? 'Email verified successfully. You can now sign in.'
              : status === 'error'
                ? 'We could not verify your email. The link may be invalid or expired.'
                : 'Working on it…'}
          </span>
        </div>

        <Link href="/login">
          <Button className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white">Go to Sign in</Button>
        </Link>
      </div>
    </FrontPageShell>
  )
}
