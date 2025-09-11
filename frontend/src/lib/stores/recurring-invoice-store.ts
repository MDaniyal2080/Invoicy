import { create } from 'zustand'
import apiClient from '@/lib/api-client'
import type { RecurringInvoice, CreateRecurringInvoiceInput, RecurringStatus } from '@/types/recurring-invoice'
export type { RecurrenceFrequency, RecurringStatus, RecurringInvoice, CreateRecurringInvoiceInput } from '@/types/recurring-invoice'
import { useUIStore } from '@/lib/stores/ui-store'
import type { Invoice } from '@/types/invoice'
import { getErrorMessage } from '@/lib/utils'

interface RecurringInvoiceState {
  recurringInvoices: RecurringInvoice[]
  currentRecurringInvoice: RecurringInvoice | null
  isLoading: boolean
  searchQuery: string
  statusFilter: 'all' | RecurringStatus
  currentPage: number
  pageSize: number
  total: number
  totalPages: number

  // Actions
  fetchRecurringInvoices: () => Promise<void>
  getRecurringInvoice: (id: string) => Promise<RecurringInvoice | null>
  createRecurringInvoice: (data: CreateRecurringInvoiceInput) => Promise<RecurringInvoice>
  updateRecurringInvoice: (id: string, updates: Partial<CreateRecurringInvoiceInput>) => Promise<RecurringInvoice>
  deleteRecurringInvoice: (id: string) => Promise<void>
  pauseRecurringInvoice: (id: string) => Promise<RecurringInvoice>
  resumeRecurringInvoice: (id: string) => Promise<RecurringInvoice>
  cancelRecurringInvoice: (id: string) => Promise<RecurringInvoice>
  runNowRecurringInvoice: (id: string) => Promise<Invoice>
  processDueRecurringInvoices: () => Promise<unknown>

  setCurrentRecurringInvoice: (invoice: RecurringInvoice | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | RecurringStatus) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  getFilteredRecurringInvoices: () => RecurringInvoice[]
}

export const useRecurringInvoiceStore = create<RecurringInvoiceState>((set, get) => ({
  recurringInvoices: [],
  currentRecurringInvoice: null,
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',
  currentPage: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,

  fetchRecurringInvoices: async () => {
    set({ isLoading: true })
    try {
      const { searchQuery, statusFilter, currentPage, pageSize } = get()
      const params: Record<string, string | number | boolean | undefined> = { page: currentPage, limit: pageSize }
      if (searchQuery) params.search = searchQuery
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const data = await apiClient.getRecurringInvoices(params)
      const isPaginated = (val: unknown): val is { items: RecurringInvoice[]; total: number; totalPages: number; page: number; limit: number } => {
        return !!val 
          && typeof val === 'object' 
          && Array.isArray((val as { items?: unknown }).items as unknown[]) 
          && typeof (val as { total?: unknown }).total === 'number'
      }
      if (Array.isArray(data)) {
        const items: RecurringInvoice[] = data
        set({
          recurringInvoices: items,
          isLoading: false,
          total: items.length,
          totalPages: 1,
          currentPage,
          pageSize,
        })
      } else if (isPaginated(data)) {
        const items: RecurringInvoice[] = data.items
        set({
          recurringInvoices: items,
          isLoading: false,
          total: data.total,
          totalPages: data.totalPages,
          currentPage: data.page,
          pageSize: data.limit,
        })
      } else {
        set({
          recurringInvoices: [],
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
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Failed to load recurring invoices',
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  getRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const data = await apiClient.getRecurringInvoice(id)
      set({ currentRecurringInvoice: data, isLoading: false })
      return data
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Failed to load recurring invoice',
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  createRecurringInvoice: async (input) => {
    set({ isLoading: true })
    try {
      const payload = {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        endDate: input.endDate != null ? new Date(input.endDate) : undefined,
      }
      const created = await apiClient.createRecurringInvoice(payload)
      set(state => {
        const newList = [created, ...state.recurringInvoices]
        const trimmed = newList.slice(0, state.pageSize)
        return {
          recurringInvoices: trimmed,
          total: state.total + 1,
          isLoading: false,
        }
      })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice created',
          message: 'Recurring invoice schedule created successfully.',
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
          title: "Couldn't create recurring invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  updateRecurringInvoice: async (id, updates) => {
    set({ isLoading: true })
    try {
      const payload: Partial<CreateRecurringInvoiceInput> = { ...updates }
      if (typeof updates.startDate !== 'undefined') {
        payload.startDate = new Date(updates.startDate as string | number | Date)
      }
      if (typeof updates.endDate !== 'undefined') {
        payload.endDate = updates.endDate === null ? null : new Date(updates.endDate as string | number | Date)
      }
      const updated = await apiClient.updateRecurringInvoice(id, payload)
      set(state => ({
        recurringInvoices: state.recurringInvoices.map(inv => (inv.id === id ? updated : inv)),
        currentRecurringInvoice: state.currentRecurringInvoice?.id === id ? updated : state.currentRecurringInvoice,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice updated',
          message: 'Changes saved successfully.',
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
          title: "Couldn't update recurring invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  deleteRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      await apiClient.deleteRecurringInvoice(id)
      set(state => ({
        recurringInvoices: state.recurringInvoices.filter(inv => inv.id !== id),
        currentRecurringInvoice: state.currentRecurringInvoice?.id === id ? null : state.currentRecurringInvoice,
        total: Math.max(0, state.total - 1),
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice deleted',
          message: 'The recurring invoice schedule was removed.',
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
          title: "Couldn't delete recurring invoice",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  pauseRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const updated = await apiClient.pauseRecurringInvoice(id)
      set(state => ({
        recurringInvoices: state.recurringInvoices.map(inv => (inv.id === id ? updated : inv)),
        currentRecurringInvoice: state.currentRecurringInvoice?.id === id ? updated : state.currentRecurringInvoice,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice paused',
        })
      } catch {}
      return updated
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  resumeRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const updated = await apiClient.resumeRecurringInvoice(id)
      set(state => ({
        recurringInvoices: state.recurringInvoices.map(inv => (inv.id === id ? updated : inv)),
        currentRecurringInvoice: state.currentRecurringInvoice?.id === id ? updated : state.currentRecurringInvoice,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice resumed',
        })
      } catch {}
      return updated
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  cancelRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const updated = await apiClient.cancelRecurringInvoice(id)
      set(state => ({
        recurringInvoices: state.recurringInvoices.map(inv => (inv.id === id ? updated : inv)),
        currentRecurringInvoice: state.currentRecurringInvoice?.id === id ? updated : state.currentRecurringInvoice,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Recurring invoice canceled',
        })
      } catch {}
      return updated
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  runNowRecurringInvoice: async (id) => {
    set({ isLoading: true })
    try {
      const createdInvoice = await apiClient.runNowRecurringInvoice(id)
      set({ isLoading: false })
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Invoice generated',
          message: 'A new invoice was generated from this schedule.',
        })
      } catch {}
      return createdInvoice
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  processDueRecurringInvoices: async () => {
    try {
      return await apiClient.processDueRecurringInvoices()
    } catch (error) {
      throw error
    }
  },

  setCurrentRecurringInvoice: (invoice) => set({ currentRecurringInvoice: invoice }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),

  getFilteredRecurringInvoices: () => {
    const { recurringInvoices } = get()
    return recurringInvoices
  },
}))
