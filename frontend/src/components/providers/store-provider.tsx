'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore, useInvoiceStore, useClientStore, usePaymentStore } from '@/lib/stores'
import apiClient from '@/lib/api-client'

interface StoreProviderProps {
  children: React.ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  const { fetchInvoices } = useInvoiceStore()
  const { fetchClients } = useClientStore()
  const { fetchPayments, fetchPaymentStats } = usePaymentStore()
  const { isAuthenticated, user, setUser } = useAuthStore()
  const pathname = usePathname()

  // Global auth hydration: if a token exists but store isn't authenticated yet, fetch current user
  // Skip on verification-related routes to avoid interfering with the verify flow
  useEffect(() => {
    let mounted = true
    const token = apiClient.getToken()
    const onVerifyRoute = pathname?.startsWith('/verify-email') || pathname?.startsWith('/email-verification')
    if (token && (!isAuthenticated || !user) && !onVerifyRoute) {
      ;(async () => {
        try {
          const me = await apiClient.getMe()
          if (!mounted) return
          setUser({
            id: me.id,
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
            companyName: me.companyName,
            role: me.role,
            emailVerified: !!me.emailVerified,
          })
        } catch {
          // token invalid: let middleware/client guard handle redirects on protected routes
        }
      })()
    }
    return () => { mounted = false }
  }, [isAuthenticated, user, setUser, pathname])

  // Initialize app data once user is fully available (prevents 401 redirect loops)
  useEffect(() => {
    // Only initialize data once the user is verified and we're on a dashboard-related route
    const isDashboardPath = (p: string) => p.startsWith('/dashboard')
    // Double-check token payload (in case persisted store is stale)
    const token = apiClient.getToken()
    type JwtPayloadLike = { emailVerified?: boolean } & Record<string, unknown>
    const decode = (jwt?: string | null): JwtPayloadLike | null => {
      try {
        if (!jwt) return null
        const parts = jwt.split('.')
        if (parts.length < 2) return null
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '==='.slice((base64.length + 3) % 4)
        const json = atob(padded)
        const parsed: unknown = JSON.parse(json)
        return parsed && typeof parsed === 'object' ? (parsed as JwtPayloadLike) : null
      } catch { return null }
    }
    const payload = decode(token)
    const tokenVerified = payload?.emailVerified === true
    if (!isAuthenticated || !user || !user.emailVerified || !tokenVerified) return
    if (!pathname || !isDashboardPath(pathname)) return
    fetchInvoices()
    fetchClients()
    fetchPayments().then(() => {
      fetchPaymentStats()
    })
  }, [isAuthenticated, user, pathname, fetchInvoices, fetchClients, fetchPayments, fetchPaymentStats])

  return <>{children}</>
}
