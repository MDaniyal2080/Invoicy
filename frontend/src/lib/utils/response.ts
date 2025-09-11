export type Paginated<T> = {
  items: T[]
  total: number
  totalPages: number
  page: number
  limit: number
}

export type ListResponse<T> = T[] | Paginated<T>

export function isPaginated<T>(res: ListResponse<T>): res is Paginated<T> {
  return !!res && !Array.isArray(res) && Array.isArray((res as Paginated<T>).items)
}

export function normalizeList<T>(res: ListResponse<T> | undefined | null): T[] {
  if (!res) return []
  return Array.isArray(res) ? res : res.items ?? []
}

export function ensurePaginated<T>(res: ListResponse<T> | undefined | null): Paginated<T> {
  if (!res) {
    return { items: [], total: 0, totalPages: 0, page: 1, limit: 0 }
  }
  if (isPaginated<T>(res)) return res
  const items = res as T[]
  const count = items.length
  return { items, total: count, totalPages: 1, page: 1, limit: count }
}
