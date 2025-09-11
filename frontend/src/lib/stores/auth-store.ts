import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import apiClient from '../api-client'
import { useUIStore } from './ui-store'
import { getErrorMessage } from '@/lib/utils'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName?: string
  avatar?: string
  role: 'ADMIN' | 'USER' | 'SUPER_ADMIN'
  emailVerified: boolean
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  taxNumber?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string, rememberMe?: boolean) => {
        set({ isLoading: true })
        try {
          const response = await apiClient.login(email, password, rememberMe)
          
          const user: User = {
            id: response.user.id,
            email: response.user.email,
            firstName: response.user.firstName,
            lastName: response.user.lastName,
            companyName: response.user.companyName,
            role: response.user.role,
            emailVerified: response.user.emailVerified
          }
          
          set({ user, isAuthenticated: true, isLoading: false })
          try {
            useUIStore.getState().addNotification({
              type: 'success',
              title: `Welcome back${user.firstName ? `, ${user.firstName}` : ''}!`,
              message: 'You are now signed in.',
              duration: 3500,
            })
          } catch {}
        } catch (error) {
          set({ isLoading: false })
          const message = getErrorMessage(error)
          try {
            useUIStore.getState().addNotification({
              type: 'error',
              title: "Couldn't log in",
              message: typeof message === 'string' ? message : undefined,
            })
          } catch {}
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true })
        try {
          const response = await apiClient.register(data)
          
          const user: User = {
            id: response.user.id,
            email: response.user.email,
            firstName: response.user.firstName,
            lastName: response.user.lastName,
            companyName: response.user.companyName,
            role: response.user.role,
            emailVerified: response.user.emailVerified
          }
          
          set({ user, isAuthenticated: true, isLoading: false })
          try {
            useUIStore.getState().addNotification({
              type: 'success',
              title: 'Account created',
              message: 'Welcome aboard! You can start using Invoicy now.',
              duration: 4000,
            })
          } catch {}
        } catch (error) {
          set({ isLoading: false })
          const message = getErrorMessage(error)
          try {
            useUIStore.getState().addNotification({
              type: 'error',
              title: "Couldn't create account",
              message: typeof message === 'string' ? message : undefined,
            })
          } catch {}
          throw error
        }
      },

      logout: async () => {
        try {
          await apiClient.logout()
          set({ user: null, isAuthenticated: false })
          try {
            useUIStore.getState().addNotification({
              type: 'success',
              title: 'Logged out',
              message: 'You have been signed out.',
              duration: 3000,
            })
          } catch {}
        } catch (error) {
          const message = getErrorMessage(error)
          try {
            useUIStore.getState().addNotification({
              type: 'error',
              title: "Couldn't log out",
              message: typeof message === 'string' ? message : undefined,
            })
          } catch {}
          throw error
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true })
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true })
        try {
          await apiClient.changePassword(currentPassword, newPassword)
          set({ isLoading: false })
          try {
            useUIStore.getState().addNotification({
              type: 'success',
              title: 'Password updated',
              message: 'Your password has been changed.',
              duration: 3500,
            })
          } catch {}
        } catch (error) {
          set({ isLoading: false })
          const message = getErrorMessage(error)
          try {
            useUIStore.getState().addNotification({
              type: 'error',
              title: "Couldn't update password",
              message: typeof message === 'string' ? message : undefined,
            })
          } catch {}
          throw error
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
)
