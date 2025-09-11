import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import axios from 'axios'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Centralized error message extractor for Axios and generic errors
export function getErrorMessage(error: unknown, fallback: string = 'Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') {
      const rec = data as Record<string, unknown>
      const msg = rec.message
      if (typeof msg === 'string') return msg
      if (Array.isArray(msg)) {
        const parts = (msg as unknown[]).filter((p): p is string => typeof p === 'string')
        if (parts.length > 0) return parts.join(', ')
      }
      const errStr = rec.error
      if (typeof errStr === 'string') return errStr
    }
    return typeof error.message === 'string' ? error.message : fallback
  }
  if (error && typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    const maybe = (error as { message?: unknown }).message
    if (typeof maybe === 'string') return maybe
  }
  if (typeof error === 'string') return error
  return fallback
}

// Extract application-specific error code from Axios or generic errors
export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as unknown
    if (data && typeof data === 'object' && 'code' in (data as Record<string, unknown>)) {
      const code = (data as Record<string, unknown>).code
      return typeof code === 'string' ? code : undefined
    }
    return undefined
  }
  if (error && typeof error === 'object' && 'code' in (error as Record<string, unknown>)) {
    const code = (error as Record<string, unknown>).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateInvoiceNumber(prefix: string = 'INV'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}
