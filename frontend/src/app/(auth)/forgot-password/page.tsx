'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import axios from 'axios'
import apiClient from '@/lib/api-client'
import { toast } from 'sonner'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const isValidEmail = (e: string) => /.+@.+\..+/.test(e)
  const canSubmit = isValidEmail(email) && !isLoading

  // Countdown effect for resend throttle
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await apiClient.forgotPassword(email)
      setIsSubmitted(true)
      setCooldown(60) // 60s cooldown before resending
      toast.success('Password reset email sent')
    } catch (err: unknown) {
      let message = 'Failed to send reset email.'
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: unknown } | undefined
        if (typeof data?.message === 'string') message = data.message
        else if (err.message) message = err.message
      } else if (err instanceof Error) {
        message = err.message || message
      }
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <FrontPageShell
      title={<SiteBrand />}
      description="Tech-Forward Dark Mode"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{isSubmitted ? 'Check your email' : 'Reset password'}</h2>
          <p className="text-sm text-slate-600">
            {isSubmitted
              ? `We've sent a password reset link to ${email}.`
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Didn&apos;t receive the email? Check your spam folder or try resending.
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={async () => {
                  if (cooldown > 0) return
                  try {
                    setIsLoading(true)
                    await apiClient.forgotPassword(email)
                    toast.success('Reset email resent')
                    setCooldown(60)
                  } catch (err: unknown) {
                    let message = 'Failed to resend reset email.'
                    if (axios.isAxiosError(err)) {
                      const data = err.response?.data as { message?: unknown } | undefined
                      if (typeof data?.message === 'string') message = data.message
                      else if (err.message) message = err.message
                    } else if (err instanceof Error) {
                      message = err.message || message
                    }
                    toast.error(message)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                variant="outline"
                className="w-full h-11"
                disabled={cooldown > 0 || isLoading}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
              </Button>
              <Button
                onClick={() => setIsSubmitted(false)}
                variant="ghost"
                className="w-full h-11"
              >
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
              {!isValidEmail(email) && email.length > 0 && (
                <p className="text-xs text-red-600">Please enter a valid email address.</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white"
              disabled={!canSubmit}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-slate-700 hover:text-slate-900 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </FrontPageShell>
  )
}

