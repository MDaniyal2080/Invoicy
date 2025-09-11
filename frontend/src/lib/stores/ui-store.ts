import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  notifications: Notification[]
  isLoading: boolean
  loadingCount: number
  realtimeEnabled: boolean
  siteName: string
  
  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  setLoading: (loading: boolean) => void
  startLoading: () => void
  stopLoading: () => void
  setRealtimeEnabled: (enabled: boolean) => void
  setSiteName: (name: string) => void
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  timestamp: number
  duration?: number
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  theme: 'system',
  notifications: [],
  isLoading: false,
  loadingCount: 0,
  realtimeEnabled: (() => {
    try {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem('realtimeEnabled')
        if (v === 'false') return false
      }
    } catch {}
    return true
  })(),
  siteName: 'Invoicy',

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
  
  addNotification: (notification) => {
    const id = Date.now().toString()
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now()
    }
    
    set(state => ({
      notifications: [newNotification, ...state.notifications]
    }))
    
    // Auto remove after duration
    if (notification.duration !== 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, notification.duration || 5000)
    }
  },
  
  removeNotification: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  clearNotifications: () => set({ notifications: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  // Increment/decrement a concurrent loading counter used by global loader
  startLoading: () => set(state => ({ loadingCount: state.loadingCount + 1 })),
  stopLoading: () => set(state => ({ loadingCount: Math.max(0, state.loadingCount - 1) })),
  setRealtimeEnabled: (enabled) => {
    try { if (typeof window !== 'undefined') localStorage.setItem('realtimeEnabled', String(enabled)) } catch {}
    set({ realtimeEnabled: enabled })
  },
  setSiteName: (name) => set({ siteName: name || 'Invoicy' })
}))
