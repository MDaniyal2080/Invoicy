'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { toast } from 'sonner'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const hasMin = form.newPassword.length >= 8
  const hasUpper = /[A-Z]/.test(form.newPassword)
  const hasLower = /[a-z]/.test(form.newPassword)
  const hasNumber = /\d/.test(form.newPassword)
  const hasSpecial = /[^A-Za-z0-9]/.test(form.newPassword)
  const score = [hasMin, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  const strength = score <= 2 ? 'Weak' : score === 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong'
  const canSubmit = !!token && form.newPassword === form.confirmPassword && score >= 4

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Invalid or missing token')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (!canSubmit) {
      toast.error('Please choose a stronger password and ensure both fields match')
      return
    }

    setIsLoading(true)
    try {
      await apiClient.resetPassword(token, form.newPassword)
      setSuccess(true)
      toast.success('Password reset successful')
      setTimeout(() => router.push('/login'), 1500)
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to reset password'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Password updated</h2>
            <p className="text-sm text-slate-600">Your password has been reset successfully.</p>
          </div>

          <FrontPalette />

          <FrontInfoCallout>
            <div className="space-y-1">
              <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
              <div className="font-semibold">Best for: Tech companies, modern startups</div>
            </div>
          </FrontInfoCallout>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>You can now sign in with your new password.</span>
          </div>

          <Link href="/login">
            <Button className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white">Go to Sign in</Button>
          </Link>
        </div>
      </FrontPageShell>
    )
  }

  return (
    <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Set a new password</h2>
          <p className="text-sm text-slate-600">Enter and confirm your new password.</p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-semibold">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter a strong password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                className="h-11 pr-12"
                disabled={isLoading}
                aria-describedby="password-help"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full rounded bg-slate-200 overflow-hidden">
                <div
                  className={`h-2 transition-all ${
                    score <= 2 ? 'bg-red-500 w-1/4' : score === 3 ? 'bg-yellow-500 w-2/4' : score === 4 ? 'bg-emerald-500 w-3/4' : 'bg-green-600 w-full'
                  }`}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600" id="password-help">
                <span className={hasMin ? 'text-emerald-600' : ''}>• At least 8 characters</span>
                <span className={hasUpper ? 'text-emerald-600' : ''}>• Uppercase letter</span>
                <span className={hasLower ? 'text-emerald-600' : ''}>• Lowercase letter</span>
                <span className={hasNumber ? 'text-emerald-600' : ''}>• Number</span>
                <span className={hasSpecial ? 'text-emerald-600' : ''}>• Special character</span>
                <span className="text-right font-medium">{strength}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                className="h-11 pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white"
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>

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
