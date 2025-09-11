// Shared invoice-related types

import type { Payment } from '@/lib/stores/payment-store'

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

export type DiscountType = 'FIXED' | 'PERCENTAGE'

export interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  rate: number
  amount?: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  userId: string
  clientId: string
  client?: { id: string; name: string; email: string }
  invoiceDate: string
  dueDate: string
  status: InvoiceStatus
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  discountType: DiscountType
  totalAmount: number
  paidAmount: number
  balanceDue: number
  currency: string
  notes?: string
  terms?: string
  footer?: string
  createdAt: string
  updatedAt: string
  payments?: Payment[]
  items?: InvoiceItem[]
  // Derived on the backend to indicate if this invoice was generated from a recurring schedule
  generatedFromRecurring?: boolean
}

export type CreateInvoiceInput = {
  clientId: string
  invoiceNumber?: string
  invoiceDate?: string | Date
  dueDate: string | Date
  status?: InvoiceStatus
  items: Array<{ description: string; quantity: number; rate: number }>
  taxRate?: number
  discount?: number
  discountType?: DiscountType
  currency?: string
  notes?: string
  terms?: string
  footer?: string
}
