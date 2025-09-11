'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import axios from 'axios'
import apiClient from '@/lib/api-client'
import { toast } from 'sonner'

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

  if (isSubmitted) {
    return (
      <Card className="glass-card hover-lift animate-fade-in">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <Mail className="h-10 w-10 text-emerald-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-gradient">Check your email</CardTitle>
          <CardDescription className="text-muted-foreground text-lg">
            We&apos;ve sent a password reset link to <span className="font-semibold text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            Didn&apos;t receive the email? Check your spam folder or try resending.
          </p>
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
              className="w-full h-12 hover-lift shadow-soft"
              disabled={cooldown > 0 || isLoading}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
            </Button>
            <Button
              onClick={() => setIsSubmitted(false)}
              variant="ghost"
              className="w-full h-12"
            >
              Use a different email
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Link
            href="/login"
            className="flex items-center text-sm text-primary hover:underline mx-auto font-semibold"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="glass-card hover-lift animate-fade-in">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-2">
          <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
            <Mail className="h-5 w-5 text-white" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold text-gradient">Reset password</CardTitle>
        <CardDescription className="text-muted-foreground text-lg">
          Enter your email address and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="h-12 glass-input"
            />
            {!isValidEmail(email) && email.length > 0 && (
              <p className="text-xs text-red-500">Please enter a valid email address.</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-12 gradient-primary hover-lift shadow-medium text-white font-semibold"
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
      </CardContent>
      <CardFooter>
        <Link
          href="/login"
          className="flex items-center text-sm text-primary hover:underline mx-auto font-semibold"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}

