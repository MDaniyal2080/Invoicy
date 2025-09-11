import type { ListResponse, Paginated } from '@/lib/utils/response'

export type ClientType = 'INDIVIDUAL' | 'COMPANY'

export interface Client {
  id: string
  name: string
  email: string
  clientType: ClientType
  phone?: string
  companyName?: string
  taxNumber?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { invoices: number }
}

export type CreateClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | '_count'>
export type UpdateClientInput = Partial<CreateClientInput>

export type GetClientsParams = {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
}

export type ClientListResponse = ListResponse<Client>

export type { Paginated }
