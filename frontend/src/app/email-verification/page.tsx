'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, RefreshCw, LogOut } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getErrorMessage } from '@/lib/utils'

export default function EmailVerificationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addNotification } = useUIStore()
  const { user, logout } = useAuthStore()
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    // If the link included a token as a query, send to dynamic verify route first
    const t = searchParams.get('token')
    if (t) {
      if (typeof window !== 'undefined') {
        window.location.href = `/verify-email/${encodeURIComponent(t)}`
      } else {
        router.replace(`/verify-email/${encodeURIComponent(t)}`)
      }
      return
    }
    // If no user and no token in query, redirect to login
    if (!user) {
      router.push('/login')
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-indigo-100 rounded-full">
              <Mail className="h-12 w-12 text-indigo-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent a verification link to <strong>{user?.email || 'your email address'}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Please check your inbox and click the verification link to access your dashboard.
            </p>
            <p className="text-xs text-gray-500">
              Don&apos;t forget to check your spam folder if you don&apos;t see the email.
            </p>
          </div>

          <div className="space-y-3">
            {user?.emailVerified && (
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-600 hover:to-indigo-600"
              >
                Continue to Dashboard
              </Button>
            )}
            <Button
              onClick={handleResendVerification}
              disabled={resending || countdown > 0}
              className="w-full bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
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
              className="w-full"
            >
              I&apos;ve verified my email
            </Button>
            
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Having trouble? Contact support for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
