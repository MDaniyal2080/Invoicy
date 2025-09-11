"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'

function computeTitle(pathname: string, siteName: string): string {
  const clean = pathname || '/'
  const site = siteName || 'Invoicy'
  if (clean.startsWith('/admin')) return `Admin Panel - ${site}`
  if (clean.startsWith('/invoices')) return `Invoices - ${site}`
  if (clean.startsWith('/clients')) return `Clients - ${site}`
  if (clean.startsWith('/payments')) return `Payments - ${site}`
  if (clean.startsWith('/reports')) return `Reports - ${site}`
  if (clean.startsWith('/settings')) return `Settings - ${site}`
  if (clean.startsWith('/dashboard')) return `Dashboard - ${site}`
  if (clean.startsWith('/login')) return `Login - ${site}`
  if (clean.startsWith('/register')) return `Create Account - ${site}`
  if (clean.startsWith('/reset-password')) return `Reset Password - ${site}`
  if (clean.startsWith('/email-verification')) return `Email Verification - ${site}`
  if (clean.startsWith('/verify-email')) return `Verify Email - ${site}`
  if (clean.startsWith('/public/invoices')) return `Invoice - ${site}`
  return site
}

export function TitleUpdater() {
  const pathname = usePathname()
  const siteName = useUIStore(s => s.siteName)
  const setSiteName = useUIStore(s => s.setSiteName)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!siteName || siteName === 'Invoicy') {
          const cfg = await apiClient.getPublicConfig()
          if (mounted && cfg?.siteName) setSiteName(cfg.siteName)
        }
      } catch {}
      if (typeof document !== 'undefined') {
        document.title = computeTitle(pathname || '/', siteName || 'Invoicy')
      }
    })()
    return () => { mounted = false }
  }, [pathname, siteName, setSiteName])

  return null
}
