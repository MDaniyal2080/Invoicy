'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { toast } from 'sonner'

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
      <Card className="border-0 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <CardTitle className="text-2xl font-bold">Password updated</CardTitle>
          <CardDescription>Your password has been reset successfully.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="flex items-center text-sm text-primary hover:underline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
        <CardDescription>Enter and confirm your new password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter a strong password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                className="h-11 pr-10"
                disabled={isLoading}
                aria-describedby="password-help"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                <div
                  className={`h-2 transition-all ${
                    score <= 2 ? 'bg-red-500 w-1/4' : score === 3 ? 'bg-yellow-500 w-2/4' : score === 4 ? 'bg-emerald-500 w-3/4' : 'bg-green-600 w-full'
                  }`}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground" id="password-help">
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
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                className="h-11 pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full h-11" disabled={isLoading || !canSubmit}>
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
      </CardContent>
    </Card>
  )
}
