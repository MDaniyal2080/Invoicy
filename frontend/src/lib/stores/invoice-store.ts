import { create } from 'zustand'
import apiClient from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { Invoice, CreateInvoiceInput } from '@/types/invoice'
export type { InvoiceStatus, DiscountType, InvoiceItem, Invoice, CreateInvoiceInput } from '@/types/invoice'
export type { Invoice as InvoiceType } from '@/types/invoice'
import { useUIStore } from '@/lib/stores/ui-store'
import { getErrorMessage, getErrorCode } from '@/lib/utils'

interface InvoiceState {
  invoices: Invoice[]
  currentInvoice: Invoice | null
  isLoading: boolean
  searchQuery: string
  statusFilter: string
  dateFrom: string | null
  dateTo: string | null
  sortBy: 'createdAt' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'status'
  sortDir: 'asc' | 'desc'
  currentPage: number
  pageSize: number
  total: number
  totalPages: number
  
  // Actions
  fetchInvoices: () => Promise<void>
  getInvoice: (id: string) => Promise<Invoice | null>
  refreshInvoice: (id: string) => Promise<void>
  createInvoice: (data: CreateInvoiceInput) => Promise<Invoice>
  updateInvoice: (id: string, updates: Partial<CreateInvoiceInput>) => Promise<Invoice>
  deleteInvoice: (id: string) => Promise<void>
  sendInvoice: (id: string) => Promise<Invoice>
  downloadInvoicePDF: (id: string, opts?: { template?: string; color?: string; font?: string; layout?: string; footer?: string }) => Promise<Blob>
  markInvoiceAsPaid: (id: string) => Promise<Invoice>
  duplicateInvoice: (id: string) => Promise<Invoice>
  cancelInvoice: (id: string) => Promise<Invoice>
  setCurrentInvoice: (invoice: Invoice | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: string) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSort: (by: InvoiceState['sortBy'], dir: InvoiceState['sortDir']) => void
  bulkUpdateStatus: (ids: string[], status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED') => Promise<void>
  bulkMarkPaid: (ids: string[]) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  getFilteredInvoices: () => Invoice[]
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  currentInvoice: null,
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',
  dateFrom: null,
  dateTo: null,
  sortBy: 'createdAt',
  sortDir: 'desc',
  currentPage: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,

  fetchInvoices: async () => {
    // Do not fetch if user is not verified
    const auth = useAuthStore.getState()
    if (!auth?.user?.emailVerified) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const { searchQuery, statusFilter, dateFrom, dateTo, sortBy, sortDir, currentPage, pageSize } = get()
      const params: Record<string, string | number | boolean | undefined> = { page: currentPage, limit: pageSize }
      if (searchQuery) params.search = searchQuery
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter.toUpperCase()
      if (dateFrom) params.startDate = dateFrom
      if (dateTo) params.endDate = dateTo
      if (sortBy) params.sortBy = sortBy
      if (sortDir) params.sortDir = sortDir
      const data = await apiClient.getInvoices(params)
      const isPaginated = (val: unknown): val is { items: Invoice[]; total: number; totalPages: number; page: number; limit: number } => {
        if (!val || typeof val !== 'object') return false
        const obj = val as Partial<{ items: unknown; total: unknown }>
        return Array.isArray(obj.items as unknown[]) && typeof obj.total === 'number'
      }
      if (Array.isArray(data)) {
        const items: Invoice[] = data
        set({
          invoices: items,
          isLoading: false,
          total: items.length,
          totalPages: 1,
          currentPage,
          pageSize,
        })
      } else if (isPaginated(data)) {
        const items: Invoice[] = data.items
        set({
          invoices: items,
          isLoading: false,
          total: data.total,
          totalPages: data.totalPages,
          currentPage: data.page,
          pageSize: data.limit,
        })
      } else {
        // Fallback for unexpected shapes
        const items: Invoice[] = []
        set({
          invoices: items,
          isLoading: false,
          total: 0,
          totalPages: 1,
          currentPage,
          pageSize,
        })
      }
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      // Suppress noisy notifications when email is not verified
      const code = getErrorCode(error)
      const suppress = code === 'EMAIL_NOT_VERIFIED'
      try {
        if (!suppress) {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Failed to load invoices',
            message: typeof message === 'string' ? message : undefined,
          })
        }
      } catch {}
      throw error
    }
  },

  // Targeted refresh used by SSE: fetch one invoice and upsert into list/current
  refreshInvoice: async (id) => {
    try {
      const data = await apiClient.getInvoice(id)
      set(state => {
        const exists = state.invoices.some(inv => inv.id === id)
        const invoices = exists
          ? state.invoices.map(inv => (inv.id === id ? data : inv))
          : [data, ...state.invoices].slice(0, state.pageSize)
        const total = exists ? state.total : state.total + 1
        return {
          invoices,
          currentInvoice: state.currentInvoice?.id === id ? data : state.currentInvoice,
          total,
        }
      })
    } catch {
      // ignore background refresh errors
    }
  },

  getInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const data = await apiClient.getInvoice(id)
      set({ currentInvoice: data, isLoading: false })
      return data
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Failed to load invoice',
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  createInvoice: async (invoiceData) => {
    set({ isLoading: true })
    try {
      const payload: CreateInvoiceInput = {
        ...invoiceData,
        invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : undefined,
        dueDate: new Date(invoiceData.dueDate),
      }
      const created = await apiClient.createInvoice(payload)
      set(state => {
        const newList = [created, ...state.invoices]
        const trimmed = newList.slice(0, state.pageSize)
        return {
          invoices: trimmed,
          total: state.total + 1,
          isLoading: false,
        }
      })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice created',
          message: created?.invoiceNumber ? `Invoice ${created.invoiceNumber} was created successfully.` : 'Invoice was created successfully.',
          duration: 4000,
        })
      } catch {}
      return created
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't create invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  updateInvoice: async (id, updates) => {
    set({ isLoading: true })
    try {
      const payload: Partial<CreateInvoiceInput> = { ...updates }
      if (typeof payload.invoiceDate !== 'undefined') payload.invoiceDate = new Date(payload.invoiceDate as string | number | Date)
      if (typeof payload.dueDate !== 'undefined') payload.dueDate = new Date(payload.dueDate as string | number | Date)
      const updated = await apiClient.updateInvoice(id, payload)
      set(state => ({
        invoices: state.invoices.map(invoice =>
          invoice.id === id ? updated : invoice
        ),
        currentInvoice: state.currentInvoice?.id === id ? updated : state.currentInvoice,
        isLoading: false
      }))
      try {
        const invNum = updated.invoiceNumber
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice updated',
          message: invNum ? `Invoice ${invNum} was updated successfully.` : 'Changes saved successfully.',
          duration: 3500,
        })
      } catch {}
      return updated
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't update invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  deleteInvoice: async (id) => {
    set({ isLoading: true })
    try {
      await apiClient.deleteInvoice(id)
      set(state => ({
        invoices: state.invoices.filter(inv => inv.id !== id),
        currentInvoice: state.currentInvoice?.id === id ? null : state.currentInvoice,
        total: Math.max(0, state.total - 1),
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice deleted',
          message: 'The invoice was removed successfully.',
          duration: 3500,
        })
      } catch {}
      return
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't delete invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  sendInvoice: async (id) => {
    set({ isLoading: true })
    try {
      await apiClient.sendInvoice(id)
      const updated = await apiClient.getInvoice(id)
      set(state => ({
        invoices: state.invoices.map(inv => (inv.id === id ? updated : inv)),
        currentInvoice: state.currentInvoice?.id === id ? updated : state.currentInvoice,
        isLoading: false
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice sent',
          message: 'The invoice has been emailed to the client.',
          duration: 4000,
        })
      } catch {}
      return updated
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't send invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  downloadInvoicePDF: async (id, opts?: { template?: string; color?: string; font?: string; layout?: string; footer?: string }) => {
    try {
      const blob = await apiClient.downloadInvoicePDF(id, opts)
      return blob
    } catch (error) {
      throw error
    }
  },

  markInvoiceAsPaid: async (id) => {
    set({ isLoading: true })
    try {
      const result = await apiClient.markInvoiceAsPaid(id)
      set(state => ({
        invoices: state.invoices.map(inv => (inv.id === id ? result : inv)),
        currentInvoice: state.currentInvoice?.id === id ? result : state.currentInvoice,
        isLoading: false
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Marked as paid',
          message: 'Invoice was marked as paid.',
          duration: 3500,
        })
      } catch {}
      return result
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't mark as paid",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  duplicateInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const dup = await apiClient.duplicateInvoice(id)
      set(state => {
        const newList = [dup, ...state.invoices]
        const trimmed = newList.slice(0, state.pageSize)
        return {
          invoices: trimmed,
          total: state.total + 1,
          isLoading: false,
        }
      })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice duplicated',
          message: 'A copy of the invoice was created.',
          duration: 3500,
        })
      } catch {}
      return dup
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't duplicate invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  cancelInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const result = await apiClient.cancelInvoice(id)
      set(state => ({
        invoices: state.invoices.map(inv => (inv.id === id ? result : inv)),
        currentInvoice: state.currentInvoice?.id === id ? result : state.currentInvoice,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice canceled',
          message: 'The invoice was canceled.',
          duration: 3500,
        })
      } catch {}
      return result
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't cancel invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  setSort: (by, dir) => set({ sortBy: by, sortDir: dir }),
  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),

  getFilteredInvoices: () => {
    const { invoices } = get()
    return invoices
  }
  ,

  bulkUpdateStatus: async (ids, status) => {
    try {
      const res = await apiClient.updateInvoicesStatusBulk(ids, status)
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Bulk status updated',
          message: `Updated: ${res?.summary?.updated ?? 0}`,
          duration: 3500,
        })
      } catch {}
      await get().fetchInvoices()
    } catch (error) {
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({ type: 'error', title: 'Bulk status failed', message: typeof message === 'string' ? message : undefined })
      } catch {}
      throw error
    }
  },

  bulkMarkPaid: async (ids) => {
    try {
      const res = await apiClient.markInvoicesPaidBulk(ids)
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Marked paid',
          message: `Updated: ${res?.summary?.updated ?? 0}`,
          duration: 3500,
        })
      } catch {}
      await get().fetchInvoices()
    } catch (error) {
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({ type: 'error', title: "Couldn't mark paid", message: typeof message === 'string' ? message : undefined })
      } catch {}
      throw error
    }
  },

  bulkDelete: async (ids) => {
    try {
      const res = await apiClient.deleteInvoicesBulk(ids)
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Deleted invoices',
          message: `Deleted: ${res?.summary?.deleted ?? 0}${res?.summary?.skipped ? `, Skipped: ${res.summary.skipped}` : ''}`,
          duration: 3500,
        })
      } catch {}
      await get().fetchInvoices()
    } catch (error) {
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({ type: 'error', title: "Couldn't delete invoices", message: typeof message === 'string' ? message : undefined })
      } catch {}
      throw error
    }
  },
}))

