'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Copy,
  Trash2,
  Send,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Printer,
  Link2,
  Crown,
  Check,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import apiClient from '@/lib/api-client'
import { createPortal } from 'react-dom'

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  SENT: 'warning',
  VIEWED: 'warning',
  OVERDUE: 'destructive',
  DRAFT: 'secondary',
  CANCELLED: 'outline',
}

export default function InvoicesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [locale, setLocale] = useState<string | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'recurring' | 'one-time'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [stats, setStats] = useState<{
    totalInvoices: number
    pendingAmount: number
    overdueAmount: number
    monthlyRevenue: number
  } | null>(null)
  const [invoiceLimit, setInvoiceLimit] = useState<number | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('Free')
  const [invoiceUsageCount, setInvoiceUsageCount] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dateFromInput, setDateFromInput] = useState<string>('')
  const [dateToInput, setDateToInput] = useState<string>('')
  const [sortSel, setSortSel] = useState<'created_desc' | 'created_asc' | 'invoiceDate_desc' | 'invoiceDate_asc' | 'dueDate_asc' | 'dueDate_desc' | 'amount_desc' | 'amount_asc' | 'status_asc' | 'status_desc'>('created_desc')
  const [bulkStatus, setBulkStatus] = useState<'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED'>('SENT')

  const {
    isLoading,
    fetchInvoices,
    setSearchQuery,
    setStatusFilter,
    getFilteredInvoices,
    currentPage,
    totalPages,
    total,
    pageSize,
    setPage,
    sendInvoice: sendInvoiceAction,
    deleteInvoice: deleteInvoiceAction,
    duplicateInvoice: duplicateInvoiceAction,
    downloadInvoicePDF: downloadPdfAction,
    setDateRange,
    setSort,
    bulkUpdateStatus,
    bulkMarkPaid,
    bulkDelete,
  } = useInvoiceStore()

  // Row actions dropdown state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!openMenuId) return
      try {
        const root = document.querySelector(`[data-row-actions="${openMenuId}"]`)
        const portal = document.getElementById(`actions-menu-${openMenuId}`)
        if (!root && !portal) { setOpenMenuId(null); return }
        const target = e.target as Node
        if (root && root.contains(target)) return
        if (portal && portal.contains(target)) return
        setOpenMenuId(null)
      } catch {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [openMenuId])

  // Recalculate menu position on scroll/resize while open
  useEffect(() => {
    if (!openMenuId) return
    const recalc = () => {
      const btn = document.querySelector(`[data-row-actions="${openMenuId}"] button[data-options-trigger="true"]`) as HTMLElement | null
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const menuEl = document.getElementById(`actions-menu-${openMenuId}`) as HTMLElement | null
      const menuW = menuEl?.offsetWidth || 224 // w-56 fallback
      const menuH = menuEl?.offsetHeight || 0
      const left = Math.min(window.innerWidth - menuW - 8, Math.max(8, rect.right - menuW))
      // Prefer below; if it would overflow bottom, flip above
      let top = rect.bottom + 8
      if (top + menuH > window.innerHeight - 8) {
        top = Math.max(8, rect.top - (menuH || 300) - 8)
      }
      setMenuPosition({ top, left })
    }
    recalc()
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)
    return () => {
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [openMenuId])

  useEffect(() => {
    const init = async () => {
      try { await apiClient.processDueRecurringInvoices() } catch {}
      try { await fetchInvoices() } catch {}
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const l = typeof window !== 'undefined' ? localStorage.getItem('language') : null
      setLocale(l && l !== 'system' ? l : undefined)
    } catch {}
  }, [])

  // Sync search from URL (?search= or ?q=)
  useEffect(() => {
    try {
      const urlSearch = (searchParams.get('search') || searchParams.get('q') || '').trim()
      if (urlSearch && urlSearch !== searchTerm) {
        setSearchTerm(urlSearch)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Load user settings for billing (invoiceLimit/plan)
  useEffect(() => {
    const loadBilling = async () => {
      try {
        const settings = await apiClient.getUserSettings()
        setInvoiceLimit(typeof settings?.invoiceLimit === 'number' ? settings.invoiceLimit : null)
        setSubscriptionPlan(settings?.subscriptionPlan || 'Free')
      } catch {}
    }
    loadBilling()
  }, [])

  // Load invoice analytics for stats cards
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiClient.getDashboardStats()
        setStats({
          totalInvoices: Number(data?.totalInvoices || 0),
          pendingAmount: Number(data?.pendingAmount || 0),
          overdueAmount: Number(data?.overdueAmount || 0),
          monthlyRevenue: Number(data?.monthlyRevenue || 0),
        })
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Failed to load stats'
        toast.error(msg)
      }
    }
    loadStats()
  }, [])

  // Load invoice usage using analytics (exclude CANCELLED)
  useEffect(() => {
    const loadUsage = async () => {
      try {
        const invStats = await apiClient.getInvoiceStats()
        const dist: Array<{ status?: string; count?: number }> = Array.isArray(invStats?.statusDistribution) ? invStats.statusDistribution : []
        if (dist.length > 0) {
          const used = dist
            .filter(d => String(d.status).toUpperCase() !== 'CANCELLED')
            .reduce((sum, d) => sum + Number(d.count || 0), 0)
          setInvoiceUsageCount(used)
        }
      } catch {}
    }
    loadUsage()
  }, [])

  // Re-load stats after invoices fetch completes to reflect new counts
  useEffect(() => {
    if (isLoading) return
    const loadStats = async () => {
      try {
        const data = await apiClient.getDashboardStats()
        setStats({
          totalInvoices: Number(data?.totalInvoices || 0),
          pendingAmount: Number(data?.pendingAmount || 0),
          overdueAmount: Number(data?.overdueAmount || 0),
          monthlyRevenue: Number(data?.monthlyRevenue || 0),
        })
      } catch {}
    }
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchTerm)
      setStatusFilter(selectedStatus)
      setPage(1)
      fetchInvoices().catch(() => {})
      setSelectedIds([])
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedStatus])

  // Apply date range and sort to store and refetch
  useEffect(() => {
    setDateRange(dateFromInput || null, dateToInput || null)
    setPage(1)
    fetchInvoices().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFromInput, dateToInput])

  useEffect(() => {
    const map = (sel: typeof sortSel): { by: any; dir: any } => {
      switch (sel) {
        case 'created_asc': return { by: 'createdAt', dir: 'asc' }
        case 'invoiceDate_desc': return { by: 'invoiceDate', dir: 'desc' }
        case 'invoiceDate_asc': return { by: 'invoiceDate', dir: 'asc' }
        case 'dueDate_asc': return { by: 'dueDate', dir: 'asc' }
        case 'dueDate_desc': return { by: 'dueDate', dir: 'desc' }
        case 'amount_desc': return { by: 'totalAmount', dir: 'desc' }
        case 'amount_asc': return { by: 'totalAmount', dir: 'asc' }
        case 'status_asc': return { by: 'status', dir: 'asc' }
        case 'status_desc': return { by: 'status', dir: 'desc' }
        case 'created_desc':
        default: return { by: 'createdAt', dir: 'desc' }
      }
    }
    const v = map(sortSel)
    setSort(v.by, v.dir)
    setPage(1)
    fetchInvoices().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortSel])

  // Refetch when page changes
  useEffect(() => {
    fetchInvoices().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // Reset to first page when type filter changes (local filter)
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  // Sync type filter with URL (?type=recurring|one-time)
  const urlType: 'all' | 'recurring' | 'one-time' = (() => {
    const t = (searchParams.get('type') || '').toLowerCase()
    return t === 'recurring' || t === 'one-time' ? (t as 'recurring' | 'one-time') : 'all'
  })()

  // Initialize from URL (and react to manual URL edits)
  useEffect(() => {
    if (urlType !== typeFilter) setTypeFilter(urlType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlType])

  // Write to URL when changing via chips (avoid loops by comparing current URL)
  useEffect(() => {
    if (typeFilter === urlType) return
    const params = new URLSearchParams(searchParams.toString())
    if (typeFilter === 'all') params.delete('type')
    else params.set('type', typeFilter)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  const isInvoiceRecurring = (inv: any) => Boolean(inv?.recurringScheduleId || inv?.recurringId || inv?.generatedFromRecurring)
  const searchType: 'recurring' | 'one-time' | null = (() => {
    const s = searchTerm.trim().toLowerCase()
    if (!s) return null
    if (s.includes('recurring') || s.includes('recur') || s.includes('schedule') || s.includes('scheduled')) return 'recurring'
    if (s.includes('one-time') || s.includes('one time') || s.includes('once') || s.includes('single')) return 'one-time'
    return null
  })()
  const invoicesData = getFilteredInvoices()
    .filter(inv => (typeFilter === 'recurring' ? isInvoiceRecurring(inv) : typeFilter === 'one-time' ? !isInvoiceRecurring(inv) : true))
    .filter(inv => (searchType === 'recurring' ? isInvoiceRecurring(inv) : searchType === 'one-time' ? !isInvoiceRecurring(inv) : true))

  const pageIds = invoicesData.map((i: any) => i.id)
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const someSelectedOnPage = pageIds.some((id) => selectedIds.includes(id)) && !allSelectedOnPage

  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleBulkSend() {
    if (selectedIds.length === 0) return
    try {
      const res = await apiClient.sendInvoicesBulk(selectedIds)
      const s = res?.summary || { sent: 0, skipped: 0, failed: 0, notFound: 0, totalRequested: selectedIds.length }
      toast.success(`Bulk send complete: sent ${s.sent}, skipped ${s.skipped}, failed ${s.failed}${s.notFound ? `, not found ${s.notFound}` : ''}`)
      setSelectedIds([])
      await fetchInvoices()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Bulk send failed'
      toast.error(msg)
    }
  }

  const formatCurrency = (amount: number, currency?: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    } catch {
      return `$${(amount || 0).toFixed(2)}`
    }
  }

  // Billing/limit derived flags (from real DB-backed settings + analytics usage)
  const limit = typeof invoiceLimit === 'number' ? invoiceLimit : null
  const hasLimit = typeof limit === 'number' && limit > 0
  const totalInvoicesCount = typeof invoiceUsageCount === 'number' ? invoiceUsageCount : (stats?.totalInvoices ?? 0)
  const hasReachedLimit = hasLimit ? totalInvoicesCount >= (limit ?? 0) : false
  const canCreateInvoice = !hasLimit || !hasReachedLimit

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gradient">Invoices</h1>
          <p className="text-muted-foreground text-lg">Manage and track all your invoices with ease</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="gradient-primary hover-lift shadow-medium text-white font-semibold px-6 py-3"
            onClick={() => {
              if (canCreateInvoice) {
                router.push('/invoices/new')
              } else {
                toast.warning('You\'ve reached your plan\'s invoice limit. Upgrade to create more invoices.')
                router.push('/settings?tab=billing')
              }
            }}
          >
            <Plus className="h-5 w-5 mr-2" />
            {canCreateInvoice ? 'Create Invoice' : 'Upgrade to Create'}
          </Button>
          {hasLimit && (
            <Badge variant={hasReachedLimit ? 'destructive' : 'warning'} className="font-medium">
              {totalInvoicesCount}/{limit} used
            </Badge>
          )}
        </div>
      </div>

      {/* Upgrade banner when limit reached */}
      {hasReachedLimit && (
        <Card className="glass-card border-destructive/30">
          <CardContent className="p-4 sm:p-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Invoice limit reached on {subscriptionPlan || 'Free'} plan</p>
                <p className="text-sm text-muted-foreground">Upgrade your plan to continue creating invoices without limits.</p>
              </div>
            </div>
            <Button
              className="gradient-primary text-white"
              onClick={() => router.push('/settings?tab=billing')}
            >
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card hover-lift animate-slide-in-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                <p className="text-3xl font-bold text-gradient">{formatCurrency(stats?.pendingAmount || 0)}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-warning/20 to-warning/10 rounded-xl">
                <Clock className="h-7 w-7 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.1s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-gradient">{formatCurrency(stats?.overdueAmount || 0)}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-xl">
                <Calendar className="h-7 w-7 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.2s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Paid This Month</p>
                <p className="text-3xl font-bold text-gradient">{formatCurrency(stats?.monthlyRevenue || 0)}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-success/20 to-success/10 rounded-xl">
                <FileText className="h-7 w-7 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.3s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                <p className="text-3xl font-bold text-gradient">{stats?.totalInvoices ?? 0}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-primary/20 to-secondary/10 rounded-xl">
                <FileText className="h-7 w-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="glass-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 sm:pl-12 h-10 sm:h-12 text-sm sm:text-base border-2 focus:border-primary/50 transition-all duration-200"
              />
            </div>
            {/* Date range + Sort */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Input type="date" value={dateFromInput} onChange={(e) => setDateFromInput(e.target.value)} className="h-10 sm:h-12 border-2" aria-label="From date" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="date" value={dateToInput} onChange={(e) => setDateToInput(e.target.value)} className="h-10 sm:h-12 border-2" aria-label="To date" />
              <select
                value={sortSel}
                onChange={(e) => setSortSel(e.target.value as any)}
                className="h-10 sm:h-12 border-2 rounded-md px-2 bg-background"
                aria-label="Sort"
              >
                <option value="created_desc">Newest</option>
                <option value="created_asc">Oldest</option>
                <option value="invoiceDate_desc">Invoice date (newest)</option>
                <option value="invoiceDate_asc">Invoice date (oldest)</option>
                <option value="dueDate_asc">Due soon</option>
                <option value="dueDate_desc">Due latest</option>
                <option value="amount_desc">Amount (high to low)</option>
                <option value="amount_asc">Amount (low to high)</option>
                <option value="status_asc">Status (A→Z)</option>
                <option value="status_desc">Status (Z→A)</option>
              </select>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button variant="outline" className="border-2 hover:bg-muted/50 hover-lift flex-1 sm:flex-none">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="hidden xs:inline">Filter</span>
                <span className="xs:hidden">Filter</span>
              </Button>
              
              {/* Actions Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-2 hover:bg-muted/50 hover-lift">
                    <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="hidden sm:inline">Actions</span>
                    <span className="sm:hidden">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={selectedIds.length === 0}
                    onClick={handleBulkSend}
                    className="cursor-pointer"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Selected ({selectedIds.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedIds.length === 0}
                    onClick={async () => { try { await bulkMarkPaid(selectedIds); setSelectedIds([]) } catch {} }}
                    className="cursor-pointer"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark Paid ({selectedIds.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status Update</DropdownMenuLabel>
                  <div className="px-2 py-1">
                    <select 
                      value={bulkStatus} 
                      onChange={(e) => setBulkStatus(e.target.value as any)} 
                      className="w-full h-8 border rounded px-2 bg-background text-sm"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                      <option value="VIEWED">Viewed</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIALLY_PAID">Partially Paid</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <DropdownMenuItem
                    disabled={selectedIds.length === 0}
                    onClick={async () => { try { await bulkUpdateStatus(selectedIds, bulkStatus); setSelectedIds([]) } catch {} }}
                    className="cursor-pointer"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Set Status ({selectedIds.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Export & Delete</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const paramsBase: Record<string, string | number | boolean | undefined> = { limit: pageSize }
                        if (searchTerm) paramsBase.search = searchTerm
                        if (selectedStatus && selectedStatus !== 'all') paramsBase.status = selectedStatus.toUpperCase()
                        if (dateFromInput) paramsBase.startDate = dateFromInput
                        if (dateToInput) paramsBase.endDate = dateToInput
                        const map = (sel: typeof sortSel): { by: string; dir: 'asc' | 'desc' } => {
                          switch (sel) {
                            case 'created_asc': return { by: 'createdAt', dir: 'asc' }
                            case 'invoiceDate_desc': return { by: 'invoiceDate', dir: 'desc' }
                            case 'invoiceDate_asc': return { by: 'invoiceDate', dir: 'asc' }
                            case 'dueDate_asc': return { by: 'dueDate', dir: 'asc' }
                            case 'dueDate_desc': return { by: 'dueDate', dir: 'desc' }
                            case 'amount_desc': return { by: 'totalAmount', dir: 'desc' }
                            case 'amount_asc': return { by: 'totalAmount', dir: 'asc' }
                            case 'status_asc': return { by: 'status', dir: 'asc' }
                            case 'status_desc': return { by: 'status', dir: 'desc' }
                            case 'created_desc':
                            default: return { by: 'createdAt', dir: 'desc' }
                          }
                        }
                        const m = map(sortSel)
                        paramsBase.sortBy = m.by
                        paramsBase.sortDir = m.dir
                        const all: any[] = []
                        for (let p = 1; p <= totalPages; p++) {
                          const data = await apiClient.getInvoices({ ...paramsBase, page: p })
                          const items = Array.isArray(data) ? data : (Array.isArray((data as any)?.items) ? (data as any).items : [])
                          all.push(...items)
                        }
                        const filtered = all
                          .filter((inv) => (typeFilter === 'recurring' ? isInvoiceRecurring(inv) : typeFilter === 'one-time' ? !isInvoiceRecurring(inv) : true))
                          .filter((inv) => (searchType === 'recurring' ? isInvoiceRecurring(inv) : searchType === 'one-time' ? !isInvoiceRecurring(inv) : true))
                        const headers = ['Invoice','Client','Email','Invoice Date','Due Date','Status','Amount','Currency','Type']
                        const rows = filtered.map((inv) => [
                          inv.invoiceNumber || inv.id,
                          inv.client?.name || '',
                          inv.client?.email || '',
                          inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : '',
                          inv.dueDate ? new Date(inv.dueDate).toISOString() : '',
                          inv.status,
                          String(inv.totalAmount ?? ''),
                          inv.currency || 'USD',
                          isInvoiceRecurring(inv) ? 'Recurring' : 'One-time',
                        ])
                        const esc = (v: string) => {
                          const s = String(v ?? '')
                          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
                        }
                        const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'invoices.csv'
                        a.click()
                        URL.revokeObjectURL(url)
                        toast.success('CSV exported')
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || 'Failed to export CSV'
                        toast.error(msg)
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedIds.length === 0}
                    onClick={async () => {
                      try {
                        if (selectedIds.length === 0) return
                        if (!window.confirm(`Delete ${selectedIds.length} invoice(s)? Invoices with payments will be skipped.`)) return
                        await bulkDelete(selectedIds)
                        setSelectedIds([])
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || "Bulk delete failed"
                        toast.error(msg)
                      }
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedIds.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6 overflow-x-auto pb-2 sm:pb-0">
            <Badge
              variant={selectedStatus === 'all' ? 'default' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setSelectedStatus('all')}
            >
              All Status
            </Badge>
            <Badge
              variant={selectedStatus === 'PAID' ? 'success' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setSelectedStatus('PAID')}
            >
              Paid
            </Badge>
            <Badge
              variant={selectedStatus === 'SENT' ? 'info' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setSelectedStatus('SENT')}
            >
              Sent
            </Badge>
            <Badge
              variant={selectedStatus === 'OVERDUE' ? 'destructive' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setSelectedStatus('OVERDUE')}
            >
              Overdue
            </Badge>
            <Badge
              variant={selectedStatus === 'DRAFT' ? 'secondary' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setSelectedStatus('DRAFT')}
            >
              Draft
            </Badge>
            {/* Type filter chips */}
            <div className="hidden sm:block mx-2 w-px bg-border/50 h-6 sm:h-8" />
            <Badge
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setTypeFilter('all')}
            >
              All Types
            </Badge>
            <Badge
              variant={typeFilter === 'one-time' ? 'info' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setTypeFilter('one-time')}
            >
              One-time
            </Badge>
            <Badge
              variant={typeFilter === 'recurring' ? 'premium' : 'outline'}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium hover:scale-105 transition-all whitespace-nowrap"
              onClick={() => setTypeFilter('recurring')}
            >
              Recurring
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card className="glass-card">
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px]">
              <table>
                <thead className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 sm:py-5 text-left w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all on page"
                        checked={allSelectedOnPage}
                        ref={(el) => { if (el) el.indeterminate = someSelectedOnPage }}
                        onChange={toggleSelectAllOnPage}
                      />
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Invoice
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Client
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                    Due Date
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-left text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Visibility
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-5 text-right text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoicesData.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-muted/30 hover-lift transition-all duration-200 group">
                      <td className="px-3 sm:px-4 py-3 sm:py-5">
                        <input
                          type="checkbox"
                          aria-label={`Select invoice ${invoice.invoiceNumber || invoice.id}`}
                          checked={selectedIds.includes(invoice.id)}
                          onChange={() => toggleSelectOne(invoice.id)}
                        />
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-semibold text-foreground">{invoice.invoiceNumber || invoice.id}</p>
                          <p className="text-xs text-muted-foreground">{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString(locale) : ''}</p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all flex-shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs sm:text-sm font-semibold">
                              {((invoice.client?.name || '').split(' ').map((n) => n[0]).join('').slice(0,2) || 'CL')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{invoice.client?.name || 'Unknown client'}</p>
                            <p className="text-xs text-muted-foreground truncate">{invoice.client?.email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-bold text-gradient">
                            {formatCurrency(invoice.totalAmount, invoice.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">{invoice.items?.length || 0} items</p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                        <Badge variant={statusColors[invoice.status] || 'default'} className="font-medium text-xs sm:text-sm">
                          {invoice.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                      {(() => {
                        const recurring = isInvoiceRecurring(invoice)
                        return (
                          <Badge variant={recurring ? 'premium' : 'info'} className="font-medium">
                            {recurring ? 'Recurring' : 'One-time'}
                          </Badge>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-muted-foreground font-medium">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString(locale) : ''}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                      {(() => {
                        const shareId = (invoice as any)?.shareId as string | undefined
                        const shareEnabled = (invoice as any)?.shareEnabled
                        const isPublic = Boolean(shareId && shareEnabled !== false)
                        return (
                          <Badge variant={isPublic ? 'info' : 'secondary'} className="font-medium">
                            {isPublic ? 'Public' : 'Private'}
                          </Badge>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <div className="relative inline-block text-left" data-row-actions={invoice.id} onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover-lift shadow-soft"
                          data-options-trigger="true"
                          onClick={(e) => {
                            e.stopPropagation()
                            const btn = e.currentTarget as HTMLElement
                            const rect = btn.getBoundingClientRect()
                            const menuW = 224 // w-56
                            const left = Math.min(window.innerWidth - menuW - 8, Math.max(8, rect.right - menuW))
                            const top = Math.min(window.innerHeight - 8, rect.bottom + 8)
                            setMenuPosition({ top, left })
                            setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)
                          }}
                        >
                          <MoreVertical className="h-4 w-4 mr-2" /> Options
                        </Button>
                        {openMenuId === invoice.id && menuPosition ? createPortal(
                          <div id={`actions-menu-${invoice.id}`} className="fixed w-56 rounded-xl bg-white dark:bg-gray-900 border border-border shadow-2xl p-1 z-[9999] overflow-auto" style={{ top: menuPosition.top, left: menuPosition.left, maxHeight: 'calc(100vh - 16px)' }} onClick={(e) => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={() => { router.push(`/invoices/${invoice.id}`); setOpenMenuId(null) }}>
                              <Eye className="h-4 w-4" /> View
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={() => { router.push(`/invoices/${invoice.id}/edit`); setOpenMenuId(null) }}>
                              <Edit className="h-4 w-4" /> Edit
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading} onClick={async () => {
                              try { await sendInvoiceAction(invoice.id); toast.success('Invoice sent') } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to send invoice') } finally { setOpenMenuId(null) }
                            }}>
                              <Send className="h-4 w-4" /> Send
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading} onClick={async () => {
                              try { const blob = await downloadPdfAction(invoice.id); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`; a.click(); URL.revokeObjectURL(url) } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to download PDF') } finally { setOpenMenuId(null) }
                            }}>
                              <Download className="h-4 w-4" /> Download PDF
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading} onClick={async () => {
                              try { const blob = await downloadPdfAction(invoice.id); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60_000) } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to open print preview') } finally { setOpenMenuId(null) }
                            }}>
                              <Printer className="h-4 w-4" /> Print preview
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading} onClick={async () => {
                              if (hasReachedLimit) { toast.warning("Invoice limit reached for your plan. Upgrade to duplicate invoices."); router.push('/settings?tab=billing'); return }
                              try { await duplicateInvoiceAction(invoice.id); toast.success('Invoice duplicated') } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to duplicate invoice') } finally { setOpenMenuId(null) }
                            }}>
                              <Copy className="h-4 w-4" /> Duplicate
                            </button>
                            {(() => {
                              const shareId = (invoice as any)?.shareId as string | undefined
                              const shareEnabled = (invoice as any)?.shareEnabled
                              if (!shareId || shareEnabled === false) return null
                              return (
                                <>
                                  <div className="h-px my-1 bg-border" />
                                  <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={() => { window.open(`/public/invoices/${shareId}`, '_blank'); setOpenMenuId(null) }}>
                                    <ExternalLink className="h-4 w-4" /> Open public page
                                  </button>
                                  <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={async () => {
                                    try { const origin = typeof window !== 'undefined' ? window.location.origin : ''; const url = `${origin}/public/invoices/${shareId}`; await navigator.clipboard.writeText(url); toast.success('Public link copied') } catch { toast.error('Failed to copy link') } finally { setOpenMenuId(null) }
                                  }}>
                                    <Link2 className="h-4 w-4" /> Copy public link
                                  </button>
                                </>
                              )
                            })()}
                            <div className="h-px my-1 bg-border" />
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-destructive/10 text-destructive flex items-center gap-2 text-sm" disabled={isLoading} onClick={async () => {
                              const ok = window.confirm('Delete this invoice?'); if (!ok) return; try { await deleteInvoiceAction(invoice.id); toast.success('Invoice deleted') } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to delete invoice') } finally { setOpenMenuId(null) }
                            }}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>, document.body) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-6 border-t border-border/50 bg-gradient-to-r from-muted/20 to-transparent">
            <p className="text-sm text-muted-foreground font-medium">
              {(() => {
                const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
                const end = total === 0 ? 0 : Math.min(start + invoicesData.length - 1, total)
                return `Showing ${start} to ${end} of ${total} results`
              })()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={isLoading || currentPage <= 1}
                className="border-2 hover:bg-muted/50 hover-lift transition-all"
                onClick={() => {
                  if (currentPage > 1) setPage(currentPage - 1)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {(() => {
                const pages: number[] = []
                const maxToShow = 5
                let start = Math.max(1, currentPage - 2)
                let end = Math.min(totalPages, start + maxToShow - 1)
                start = Math.max(1, end - maxToShow + 1)
                for (let p = start; p <= end; p++) pages.push(p)
                return pages.map((p) => (
                  <Button
                    key={p}
                    variant={p === currentPage ? 'default' : 'outline'}
                    size="sm"
                    disabled={isLoading}
                    className={p === currentPage ? 'shadow-medium' : 'border-2 hover:bg-muted/50 hover-lift transition-all'}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))
              })()}
              <Button
                variant="outline"
                size="icon"
                disabled={isLoading || currentPage >= totalPages}
                className="border-2 hover:bg-muted/50 hover-lift transition-all"
                onClick={() => {
                  if (currentPage < totalPages) setPage(currentPage + 1)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
