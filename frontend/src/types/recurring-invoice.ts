// Recurring invoice types aligned with backend Prisma schema and DTOs

import type { DiscountType } from '@/types/invoice'

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED'

export interface RecurringInvoiceItem {
  id?: string
  description: string
  quantity: number
  rate: number
  unit?: string
  taxable?: boolean
}

export interface RecurringInvoice {
  id: string
  userId: string
  clientId: string
  client?: { id: string; name: string; email?: string }

  taxRate?: number
  discount?: number
  discountType?: DiscountType
  currency?: string
  notes?: string
  terms?: string
  footer?: string
  dueInDays?: number

  frequency: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string | null
  nextRunAt: string
  lastRunAt?: string | null
  maxOccurrences?: number
  occurrencesCount: number
  status: RecurringStatus
  autoSend?: boolean

  createdAt: string
  updatedAt: string

  items?: RecurringInvoiceItem[]
}

export type CreateRecurringInvoiceInput = {
  clientId: string
  items: Array<{
    description: string
    quantity: number
    rate: number
    unit?: string
    taxable?: boolean
  }>

  taxRate?: number
  discount?: number
  discountType?: DiscountType
  currency?: string
  notes?: string
  terms?: string
  footer?: string
  dueInDays?: number

  frequency: RecurrenceFrequency
  interval?: number
  startDate: string | Date
  endDate?: string | Date | null
  maxOccurrences?: number
  autoSend?: boolean
}
