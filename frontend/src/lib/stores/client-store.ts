import { create } from 'zustand'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { getErrorMessage, getErrorCode } from '@/lib/utils'
import type { Client, CreateClientInput, UpdateClientInput, GetClientsParams } from '@/types/client'
export type { Client } from '@/types/client'
import { useAuthStore } from '@/lib/stores/auth-store'

interface ClientState {
  clients: Client[]
  currentClient: Client | null
  isLoading: boolean
  searchQuery: string
  statusFilter: 'all' | 'active' | 'inactive'
  viewMode: 'grid' | 'list'
  
  // Actions
  fetchClients: () => Promise<void>
  getClient: (id: string) => Promise<Client>
  createClient: (client: CreateClientInput) => Promise<Client>
  updateClient: (id: string, updates: UpdateClientInput) => Promise<Client>
  deleteClient: (id: string) => Promise<void>
  setCurrentClient: (client: Client | null) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: 'all' | 'active' | 'inactive') => void
  setViewMode: (mode: 'grid' | 'list') => void
  getFilteredClients: () => Client[]
}

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  currentClient: null,
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',
  viewMode: 'grid',

  fetchClients: async () => {
    // Do not fetch if user is not verified
    const auth = useAuthStore.getState()
    if (!auth?.user?.emailVerified) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const { searchQuery, statusFilter } = get()
      const params: GetClientsParams = {}
      if (searchQuery) params.search = searchQuery
      if (statusFilter === 'active') params.isActive = true
      if (statusFilter === 'inactive') params.isActive = false

      const items = await apiClient.getClients(params)
      set({ clients: items, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      const code = getErrorCode(error)
      const suppress = code === 'EMAIL_NOT_VERIFIED'
      try {
        if (!suppress) {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Failed to load clients',
            message: typeof message === 'string' ? message : undefined,
          })
        }
      } catch {}
      throw error
    }
  },

  getClient: async (id) => {
    try {
      const client = await apiClient.getClient(id)
      set({ currentClient: client })
      return client
    } catch (error) {
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Failed to load client',
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  createClient: async (clientData) => {
    set({ isLoading: true })
    try {
      const created = await apiClient.createClient(clientData)
      set(state => ({ clients: [created, ...state.clients], isLoading: false }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Client added',
          message: created?.name ? `${created.name} was created successfully.` : 'Client was created successfully.',
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
          title: "Couldn't create client",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  updateClient: async (id, updates) => {
    set({ isLoading: true })
    try {
      const updated = await apiClient.updateClient(id, updates)
      set(state => ({
        clients: state.clients.map(c => (c.id === id ? updated : c)),
        currentClient: state.currentClient?.id === id ? updated : state.currentClient,
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Client updated',
          message: updated?.name ? `${updated.name} was updated successfully.` : 'Changes saved successfully.',
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
          title: "Couldn't update client",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  deleteClient: async (id) => {
    set({ isLoading: true })
    try {
      await apiClient.deleteClient(id)
      set(state => ({
        clients: state.clients.filter(c => c.id !== id),
        isLoading: false,
      }))
      try {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Client deleted',
          message: 'The client was removed successfully.',
          duration: 3500,
        })
      } catch {}
    } catch (error) {
      set({ isLoading: false })
      const message = getErrorMessage(error)
      try {
        useUIStore.getState().addNotification({
          type: 'error',
          title: "Couldn't delete client",
          message: typeof message === 'string' ? message : undefined,
        })
      } catch {}
      throw error
    }
  },

  setCurrentClient: (client) => set({ currentClient: client }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setViewMode: (mode) => set({ viewMode: mode }),

  getFilteredClients: () => {
    // Server-side filtering is used; return as-is for now
    const { clients } = get()
    return clients
  }
}))
