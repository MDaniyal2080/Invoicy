import { create } from 'zustand'
import { useUIStore } from './ui-store'
import { getErrorMessage, getErrorCode } from '@/lib/utils'
import apiClient from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  amount: number
  method: 'credit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash'
  status: 'completed' | 'pending' | 'failed' | 'refunded'
  transactionId?: string
  paymentNumber?: string
  processedAt: string
  createdAt: string
}

interface PaymentStats {
  totalReceived: number
  totalPending: number
  totalFailed: number
  successRate: number
  methodDistribution: Record<string, number>
}

interface PaymentState {
  payments: Payment[]
  stats: PaymentStats
  serverStats: { totalReceived: number; monthlyReceived: number; pendingPayments: number; failedPayments: number }
  isLoading: boolean
  searchQuery: string
  statusFilter: 'all' | Payment['status']
  methodFilter: 'all' | Payment['method']
  // Pagination
  page: number
  limit: number
  total: number
  totalPages: number
  
  // Actions
  fetchPayments: (filter?: { invoiceId?: string; status?: 'all' | Payment['status']; method?: 'all' | Payment['method']; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number }) => Promise<void>
  fetchPaymentStats: () => Promise<void>
  fetchPaymentStatsServer: () => Promise<void>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  refreshPaymentsForInvoice: (invoiceId: string) => Promise<void>
  processPayment: (paymentData: {
    invoiceId: string
    amount: number
    method: Payment['method']
    notes?: string
    cardNumber?: string
    cardExpiry?: string
    cardCvv?: string
    bankAccount?: string
  }) => Promise<void>
  recordPayment: (paymentData: {
    invoiceId: string
    amount: number
    method: Payment['method']
    paymentDate?: string | Date
    transactionId?: string
    notes?: string
  }) => Promise<void>
  refundPayment: (id: string, amount?: number) => Promise<void>
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | Payment['status']) => void
  setMethodFilter: (method: 'all' | Payment['method']) => void
  getFilteredPayments: () => Payment[]
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  stats: {
    totalReceived: 0,
    totalPending: 0,
    totalFailed: 0,
    successRate: 0,
    methodDistribution: {}
  },

  // Targeted refresh for a specific invoice's payments (used by SSE)
  refreshPaymentsForInvoice: async (invoiceId: string) => {
    try {
      await get().fetchPayments({ invoiceId })
    } catch {
      // ignore background refresh errors
    }
  },
  serverStats: { totalReceived: 0, monthlyReceived: 0, pendingPayments: 0, failedPayments: 0 },
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,

  recordPayment: async (paymentData) => {
    set({ isLoading: true })
    try {
      type ApiPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'STRIPE' | 'CHECK' | 'OTHER'
      const toApiMethod = (m: Payment['method'] | undefined): ApiPaymentMethod => {
        const upper = String(m || 'cash').toUpperCase()
        // Map our local union to the API union
        switch (upper) {
          case 'CREDIT_CARD':
          case 'BANK_TRANSFER':
          case 'PAYPAL':
          case 'STRIPE':
          case 'CASH':
            return upper as ApiPaymentMethod
          default:
            return 'CASH'
        }
      }
      const payload = {
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        paymentMethod: toApiMethod(paymentData.method),
        paymentDate: paymentData.paymentDate,
        transactionId: paymentData.transactionId,
        notes: paymentData.notes,
      }
      const result = await apiClient.recordPayment(payload)
      // Refresh list scoped to the invoice
      await get().fetchPayments({ invoiceId: paymentData.invoiceId })
      set({ isLoading: false })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Payment recorded',
          message: `Payment ${result?.paymentNumber || ''} saved successfully.`,
          duration: 3500,
        })
      } catch {}
    } catch (error: unknown) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't record payment",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',
  methodFilter: 'all',

  fetchPayments: async (filter) => {
    // Do not fetch if user is not verified
    const auth = useAuthStore.getState()
    if (!auth?.user?.emailVerified) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const state = get()
      const params: Record<string, string | number | boolean | undefined> = {}
      if (filter?.invoiceId) params.invoiceId = filter.invoiceId
      if (filter?.status && filter.status !== 'all') params.status = String(filter.status).toUpperCase()
      if (filter?.method && filter.method !== 'all') params.method = String(filter.method).toUpperCase()
      if (filter?.dateFrom) params.dateFrom = filter.dateFrom
      if (filter?.dateTo) params.dateTo = filter.dateTo
      if (typeof filter?.search === 'string') params.search = filter.search
      params.page = typeof filter?.page === 'number' ? filter.page : state.page
      params.limit = typeof filter?.limit === 'number' ? filter.limit : state.limit

      const data = await apiClient.getPayments(params)
      const mapPayment = (p: unknown): Payment => {
        const obj = (p && typeof p === 'object' ? (p as Record<string, unknown>) : {})
        const rawMethod = String((obj as Record<string, unknown>)?.paymentMethod || '').toLowerCase()
        const method = rawMethod === 'debit_card' ? 'credit_card' : rawMethod === 'check' ? 'bank_transfer' : rawMethod === 'other' ? 'cash' : rawMethod
        const status = String((obj as Record<string, unknown>)?.status || '').toLowerCase()
        return {
          id: String((obj as Record<string, unknown>).id),
          invoiceId: String((obj as Record<string, unknown>).invoiceId),
          invoiceNumber: String((obj as { invoice?: { invoiceNumber?: unknown } }).invoice?.invoiceNumber || ''),
          clientId: String((obj as { invoice?: { client?: { id?: unknown } } }).invoice?.client?.id || ''),
          clientName: String((obj as { invoice?: { client?: { name?: unknown } } }).invoice?.client?.name || ''),
          amount: Number((obj as Record<string, unknown>)?.amount ?? 0),
          method: (method === 'credit_card' || method === 'bank_transfer' || method === 'paypal' || method === 'stripe' || method === 'cash')
            ? (method as Payment['method'])
            : 'cash',
          status: (status === 'completed' || status === 'pending' || status === 'failed' || status === 'refunded')
            ? (status as Payment['status'])
            : 'completed',
          transactionId: (obj as Record<string, unknown>)?.transactionId as string | undefined,
          paymentNumber: (obj as Record<string, unknown>)?.paymentNumber as string | undefined,
          processedAt: (obj as Record<string, unknown>)?.paymentDate ? new Date((obj as Record<string, unknown>).paymentDate as string | number | Date).toISOString() : new Date().toISOString(),
          createdAt: (obj as Record<string, unknown>)?.createdAt ? new Date((obj as Record<string, unknown>).createdAt as string | number | Date).toISOString() : new Date().toISOString(),
        }
      }
      let payments: Payment[] = []
      if (Array.isArray(data)) {
        payments = data.map(mapPayment)
        set({ payments, isLoading: false, total: data.length, totalPages: 1 })
      } else if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
        const items = (data as { items?: unknown }).items as unknown[]
        payments = items.map(mapPayment)
        set({
          payments,
          isLoading: false,
          page: (data as { page?: number }).page ?? state.page,
          limit: (data as { limit?: number }).limit ?? state.limit,
          total: (data as { total?: number }).total ?? payments.length,
          totalPages: (data as { totalPages?: number }).totalPages ?? 1,
        })
      } else {
        set({ payments: [], isLoading: false, total: 0, totalPages: 1 })
      }
    } catch (error: unknown) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      const code = getErrorCode(error)
      const suppress = code === 'EMAIL_NOT_VERIFIED'
      try {
        if (!suppress) {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Failed to load payments',
            message: typeof message === 'string' ? message : undefined,
          })
        }
      } catch {}
      throw error
    }
  },

  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),

  fetchPaymentStats: async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { payments } = get()
      
      const totalReceived = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0)
      
      const totalPending = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0)
      
      const totalFailed = payments
        .filter(p => p.status === 'failed')
        .reduce((sum, p) => sum + p.amount, 0)
      
      const successRate = payments.length > 0 
        ? (payments.filter(p => p.status === 'completed').length / payments.length) * 100
        : 0
      
      const methodDistribution = payments.reduce((acc, payment) => {
        acc[payment.method] = (acc[payment.method] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      set({
        stats: {
          totalReceived,
          totalPending,
          totalFailed,
          successRate,
          methodDistribution
        }
      })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Failed to load payment stats',
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
    }
  },

  fetchPaymentStatsServer: async () => {
    try {
      // Do not fetch if user is not verified
      const auth = useAuthStore.getState()
      if (!auth?.user?.emailVerified) {
        return
      }
      const stats = await apiClient.getPaymentStatistics()
      set({ serverStats: stats })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      const code = getErrorCode(error)
      const suppress = code === 'EMAIL_NOT_VERIFIED'
      try {
        if (!suppress) {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Failed to load server payment stats',
            message: typeof message === 'string' ? message : undefined,
          })
        }
      } catch {}
    }
  },

  processPayment: async (paymentData) => {
    set({ isLoading: true })
    try {
      type ApiPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'STRIPE' | 'CHECK' | 'OTHER'
      const toApiMethod = (m: Payment['method'] | undefined): ApiPaymentMethod => {
        const upper = String(m || 'cash').toUpperCase()
        switch (upper) {
          case 'CREDIT_CARD':
          case 'BANK_TRANSFER':
          case 'PAYPAL':
          case 'STRIPE':
          case 'CASH':
            return upper as ApiPaymentMethod
          default:
            return 'CASH'
        }
      }
      const payload = {
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        paymentMethod: toApiMethod(paymentData.method),
        notes: paymentData.notes,
      }
      const result = await apiClient.processPayment(payload)
      // Re-fetch payments list for latest state (filter by this invoice if provided)
      await get().fetchPayments({ invoiceId: paymentData.invoiceId })
      set({ isLoading: false })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Payment processed',
          message: String(result?.message || 'Payment was recorded successfully.'),
          duration: 3500,
        })
      } catch {}
    } catch (error: unknown) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't process payment",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  refundPayment: async (id, amount) => {
    set({ isLoading: true })
    try {
      await apiClient.refundPayment(id, amount)
      // Optimistically update local state
      set(state => ({
        payments: state.payments.map(payment =>
          payment.id === id
            ? { ...payment, status: 'refunded' as const }
            : payment
        ),
        isLoading: false
      }))
      // Refresh stats
      get().fetchPaymentStats()
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Payment refunded',
          message: 'The payment has been marked as refunded.',
          duration: 3500,
        })
      } catch {}
    } catch (error: unknown) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't refund payment",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setMethodFilter: (method) => set({ methodFilter: method }),

  getFilteredPayments: () => {
    const { payments, searchQuery, statusFilter, methodFilter } = get()
    
    return payments.filter(payment => {
      const matchesSearch = !searchQuery || 
        payment.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.transactionId?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      const matchesMethod = methodFilter === 'all' || payment.method === methodFilter
      
      return matchesSearch && matchesStatus && matchesMethod
    })
  }
}))
