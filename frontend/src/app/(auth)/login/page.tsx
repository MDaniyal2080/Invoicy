'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      await login(formData.email, formData.password, formData.rememberMe)
      const { user } = useAuthStore.getState()
      toast.success('Login successful!')
      if (!user?.emailVerified) {
        router.push('/email-verification')
        return
      }
      const role = user?.role
      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  return (
    <FrontPageShell
      title={<SiteBrand />}
      description="Tech-Forward Dark Mode"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Welcome back</h2>
          <p className="text-sm text-slate-600">Enter your credentials to access your account.</p>
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
            <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              className="h-11"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-slate-700 hover:text-slate-900 underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
                className="h-11 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="remember"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              disabled={isLoading}
            />
            <Label htmlFor="remember" className="text-sm font-medium cursor-pointer select-none">
              Remember me for 30 days
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-slate-600">Don't have an account? </span>
          <Link href="/register" className="text-slate-900 font-semibold underline-offset-4 hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </FrontPageShell>
  )
}

