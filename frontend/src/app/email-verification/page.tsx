'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Mail, RefreshCw, LogOut } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getErrorMessage } from '@/lib/utils'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function EmailVerificationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addNotification } = useUIStore()
  const { user, logout } = useAuthStore()
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    const t = searchParams.get('token')
    if (t) {
      if (typeof window !== 'undefined') {
        window.location.href = `/verify-email/${encodeURIComponent(t)}`
      } else {
        router.replace(`/verify-email/${encodeURIComponent(t)}`)
      }
      return
    }
    if (!user) {
      try {
        const hasCookie = typeof document !== 'undefined' && document.cookie.split('; ').some((c) => c.startsWith('access_token='))
        const storageToken = typeof window !== 'undefined' ? (localStorage.getItem('access_token') || sessionStorage.getItem('access_token')) : null
        if (!hasCookie && !storageToken) {
          router.push('/login')
        }
      } catch {
        router.push('/login')
      }
      return
    }
  }, [user, router, searchParams])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleResendVerification = async () => {
    try {
      setResending(true)
      await apiClient.resendVerification()
      addNotification({
        type: 'success',
        title: 'Verification email sent',
        message: 'Please check your inbox and spam folder for the verification link'
      })
      setCountdown(60) // 60 second cooldown
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Failed to resend',
        message: getErrorMessage(error, 'Please try again later')
      })
    } finally {
      setResending(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleIHaveVerified = async () => {
    try {
      const me = await apiClient.getMe()
      // Update auth store with latest verification status
      useAuthStore.getState().setUser({
        id: me.id,
        email: me.email,
        firstName: me.firstName,
        lastName: me.lastName,
        companyName: me.companyName,
        role: me.role,
        emailVerified: !!me.emailVerified,
      })
      if (me.emailVerified) {
        // Refresh token so middleware sees emailVerified=true in JWT payload
        try {
          const maybeClient = (apiClient as unknown as { client?: { post?: (url: string, body?: unknown) => Promise<{ data?: { access_token?: string } }> } }).client
          if (maybeClient?.post) {
            const resp = await maybeClient.post('/auth/refresh')
            const token = resp?.data?.access_token
            if (token) {
              const remember = typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : undefined
              apiClient.setToken(token, remember)
            }
          }
        } catch {}
        addNotification({
          type: 'success',
          title: 'Email verified!',
          message: 'You can now access all features.',
        })
      } else {
        addNotification({
          type: 'warning',
          title: 'Not verified yet',
          message: 'We still cannot confirm your email. Please try again in a moment.',
        })
      }
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Failed to check status',
        message: getErrorMessage(error, 'Please try again'),
      })
    }
  }

  // Don't early-return null so the token-handling effect can run even when user is null

  return (
    <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Verify your email</h2>
          <p className="text-sm text-slate-600">
            We&apos;ve sent a verification link to <span className="font-semibold text-slate-900">{user?.email || 'your email address'}</span>
          </p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div>Please check your inbox and click the verification link to access your dashboard.</div>
          <div className="mt-1 text-xs text-slate-600">Don&apos;t forget to check your spam folder.</div>
        </div>

        <div className="space-y-3">
          {user?.emailVerified && (
            <Button
              onClick={() => router.push('/dashboard?fromVerify=1')}
              className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white"
            >
              Continue to Dashboard
            </Button>
          )}
          <Button
            onClick={handleResendVerification}
            disabled={resending || countdown > 0}
            className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white"
          >
            {resending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : countdown > 0 ? (
              `Resend in ${countdown}s`
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Resend Verification Email
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            onClick={handleIHaveVerified}
            className="w-full h-11"
          >
            I&apos;ve verified my email
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full h-11"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-600">Having trouble? Contact support for assistance.</p>
        </div>
      </div>
    </FrontPageShell>
  )
}
