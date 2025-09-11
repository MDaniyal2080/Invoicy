'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/lib/stores/auth-store'
import apiClient from '@/lib/api-client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { usePaymentStore } from '@/lib/stores/payment-store'
import { useClientStore } from '@/lib/stores/client-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { getErrorCode } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isAuthenticated, setUser, user } = useAuthStore()
  const realtimeEnabled = useUIStore(s => s.realtimeEnabled)

  useEffect(() => {
    const init = async () => {
      // Ensure we run only on client
      // Fallback: if this page was reached via /dashboard?token=..., route to verify-email directly
      try {
        if (typeof window !== 'undefined') {
          const qsToken = new URLSearchParams(window.location.search).get('token')
          if (qsToken) {
            router.replace(`/verify-email/${encodeURIComponent(qsToken)}`)
            setHydrated(true)
            return
          }
        }
      } catch {}

      const token = apiClient.getToken()
      if (!token) {
        router.replace('/login')
        // Avoid getting stuck on loader while navigation happens
        setHydrated(true)
        return
      }
      try {
        // If store isn't fully populated, fetch current user
        if (!isAuthenticated || !user) {
          const me = await apiClient.getMe()
          setUser({
            id: me.id,
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
            companyName: me.companyName,
            role: me.role,
            emailVerified: !!me.emailVerified,
          })
        }
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status
        const code = getErrorCode(e)
        if (status === 403 && code === 'EMAIL_NOT_VERIFIED') {
          router.replace('/email-verification')
        } else {
          router.replace('/login')
        }
        return
      } finally {
        setHydrated(true)
      }
    }
    init()
  }, [isAuthenticated, user, router, setUser])

  // Role-based route enforcement (client-side guard)
  useEffect(() => {
    if (!hydrated || !user) return
    // If the current URL carries a token query (e.g., /dashboard?token=...),
    // do NOT redirect to /email-verification here; the init() effect is already
    // sending the user to /verify-email/<token>.
    const qsToken = searchParams?.get('token')
    if (qsToken) {
      return
    }
    // Decode token to double-check verified flag and support fresh post-verify tokens
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
    const fromVerify = searchParams?.get('fromVerify') === '1'
    // If user is not verified, force them to verification holding page unless token or override says otherwise
    if (!user.emailVerified && !tokenVerified && !fromVerify && !pathname.startsWith('/email-verification') && !pathname.startsWith('/verify-email')) {
      router.replace('/email-verification')
      return
    }
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

    // Prevent non-admins from accessing /admin
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace('/dashboard')
      return
    }

    // Optionally route admins to /admin when they hit the user dashboard
    if (pathname === '/dashboard' && isAdmin) {
      const keep = searchParams?.get('fromVerify') === '1' ? '?fromVerify=1' : ''
      router.replace(`/admin${keep}`)
      return
    }
  }, [hydrated, user, pathname, router, searchParams])

  // Real-time updates via SSE (Server-Sent Events) with backoff + gating
  useEffect(() => {
    if (!hydrated) return
    if (!user || !user.emailVerified) return
    const token = apiClient.getToken()
    if (!token) return
    if (!realtimeEnabled) return

    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')
    const url = `${base}/notifications/stream?token=${encodeURIComponent(token)}`

    let es: EventSource | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const schedule = (fn: () => void) => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(fn, 250)
    }

    const connect = () => {
      // Prevent multiple connections
      if (es) return
      try {
        es = new EventSource(url)

        es.onopen = () => {
          attempts = 0
        }

        es.onmessage = (ev) => {
          try {
            const evt = JSON.parse(ev.data || '{}') as { type?: string; payload?: Record<string, unknown>; ts?: string }
            const type = String(evt?.type || '')
            const payload = (evt && evt.payload) ? evt.payload : {}
            const inv = () => useInvoiceStore.getState()
            const pay = () => usePaymentStore.getState()
            const cli = () => useClientStore.getState()

            const onInvoicesPage = typeof window !== 'undefined' ? window.location.pathname.startsWith('/invoices') : false
            const onPaymentsPage = typeof window !== 'undefined' ? window.location.pathname.startsWith('/payments') : false
            const onClientsPage = typeof window !== 'undefined' ? window.location.pathname.startsWith('/clients') : false

            if (type.startsWith('invoice.')) {
              switch (type) {
                case 'invoice.sent':
                  toast.success('Invoice sent')
                  break
                case 'invoice.created':
                  toast.success('Invoice created')
                  break
                case 'invoice.updated':
                  toast.info('Invoice updated')
                  break
                case 'invoice.cancelled':
                  toast.success('Invoice cancelled')
                  break
                case 'invoice.status_changed':
                  toast.success(`Invoice status: ${String((payload as Record<string, unknown>)?.status ?? '')}`)
                  break
                case 'invoice.duplicated':
                  toast.success('Invoice duplicated')
                  break
                case 'invoice.deleted':
                  toast.success('Invoice deleted')
                  // If not on invoices page, skip heavy list refresh
                  if (onInvoicesPage) {
                    schedule(() => { try { inv().fetchInvoices().catch(() => {}) } catch {} })
                  }
                  break
                case 'invoice.viewed':
                  toast('Invoice viewed')
                  break
                case 'invoice.share_updated':
                  toast('Invoice link updated')
                  break
                case 'invoice.overdue':
                  toast.warning('Invoice overdue')
                  break
              }
              const id = (payload as Record<string, unknown>)?.id as string | undefined
              if (id) {
                schedule(() => { try { inv().refreshInvoice(id).catch(() => {}) } catch {} })
              } else if (onInvoicesPage) {
                schedule(() => { try { inv().fetchInvoices().catch(() => {}) } catch {} })
              }
            } else if (type.startsWith('payment.')) {
              switch (type) {
                case 'payment.recorded':
                  toast.success('Payment recorded')
                  break
                case 'payment.processed':
                  toast.success('Payment processed')
                  break
                case 'payment.refunded':
                  toast.success('Payment refunded')
                  break
              }
              const invoiceId = (payload as Record<string, unknown>)?.invoiceId as string | undefined
              if (invoiceId) {
                schedule(() => {
                  try {
                    if (onPaymentsPage) {
                      pay().refreshPaymentsForInvoice(invoiceId).catch(() => {})
                      pay().fetchPaymentStatsServer().catch(() => {})
                    }
                  } catch {}
                })
              } else if (onPaymentsPage) {
                schedule(() => {
                  try {
                    pay().fetchPayments().catch(() => {})
                    pay().fetchPaymentStatsServer().catch(() => {})
                  } catch {}
                })
              }
            } else if (type.startsWith('client.')) {
              switch (type) {
                case 'client.created':
                  toast.success('Client added')
                  break
                case 'client.updated':
                  toast.success('Client updated')
                  break
                case 'client.deleted':
                  toast.success('Client deleted')
                  break
              }
              if (onClientsPage) {
                schedule(() => { try { cli().fetchClients().catch(() => {}) } catch {} })
              }
            }
          } catch {}
        }

        es.onerror = () => {
          if (es) { es.close(); es = null }
          // Reconnect with exponential backoff + jitter
          attempts += 1
          const base = Math.min(30000, 1000 * Math.pow(2, attempts))
          const jitter = Math.floor(Math.random() * 500)
          const delay = base + jitter
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(() => {
            connect()
          }, delay)
        }
      } catch {
        // If constructor throws, schedule reconnect
        attempts += 1
        const base = Math.min(30000, 1000 * Math.pow(2, attempts))
        const jitter = Math.floor(Math.random() * 500)
        const delay = base + jitter
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => {
          connect()
        }, delay)
      }
    }

    connect()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (es) es.close()
    }
  }, [hydrated, user, realtimeEnabled])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3 rounded-lg bg-white/90 dark:bg-gray-900/90 px-4 py-3 shadow-lg ring-1 ring-black/5">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  // If user is unverified, don't render dashboard chrome or children to avoid any API calls.
  if (user && !user.emailVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3 rounded-lg bg-white/90 dark:bg-gray-900/90 px-4 py-3 shadow-lg ring-1 ring-black/5">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Redirecting to email verification…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
