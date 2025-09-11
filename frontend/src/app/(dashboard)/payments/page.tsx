'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  
} from 'lucide-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usePaymentStore } from '@/lib/stores/payment-store'

const methodIconMap: Record<string, typeof CreditCard> = {
  'credit_card': CreditCard,
  'bank_transfer': DollarSign,
  'paypal': CreditCard,
  'stripe': CreditCard,
  'cash': DollarSign,
}

type StatusOpt = 'all' | 'completed' | 'pending' | 'failed' | 'refunded'
const STATUS_OPTIONS = ['all','completed','pending','failed','refunded'] as const
const isStatus = (v: string): v is StatusOpt => (STATUS_OPTIONS as readonly string[]).includes(v)

type MethodOpt = 'all' | 'credit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash'
const METHOD_OPTIONS = ['all','credit_card','bank_transfer','paypal','stripe','cash'] as const
const isMethod = (v: string): v is MethodOpt => (METHOD_OPTIONS as readonly string[]).includes(v)

type PaymentQueryParams = Record<string, string | number | boolean | undefined>

export default function PaymentsPage() {
  const {
    fetchPayments,
    fetchPaymentStats,
    setSearchQuery,
    setStatusFilter,
    getFilteredPayments,
    statusFilter,
    serverStats,
    page,
    limit,
    total,
    totalPages,
    setPage,
    setLimit,
    refundPayment,
  } = usePaymentStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'thisMonth'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [statusSel, setStatusSel] = useState<'all' | 'completed' | 'pending' | 'failed' | 'refunded'>('all')
  const [methodSel, setMethodSel] = useState<'all' | 'credit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash'>('all')

  useEffect(() => {
    const init = async () => {
      try { await fetchPayments({ page: 1 }) } catch {}
      try { await fetchPaymentStats() } catch {}
      try { await usePaymentStore.getState().fetchPaymentStatsServer() } catch {}
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      setSearchQuery(searchTerm)
      const params: PaymentQueryParams = { page: 1, limit, method: methodSel }
      if (statusSel !== 'all') params.status = statusSel
      if (dateFilter === 'thisMonth') {
        const start = new Date(); start.setDate(1)
        const yyyy = start.getFullYear(); const mm = String(start.getMonth()+1).padStart(2,'0'); const dd = String(start.getDate()).padStart(2,'0')
        params.dateFrom = `${yyyy}-${mm}-${dd}`
      } else {
        if (dateFrom) params.dateFrom = dateFrom
        if (dateTo) params.dateTo = dateTo
      }
      if (searchTerm) params.search = searchTerm
      try { await fetchPayments(params) } catch {}
      fetchPaymentStats().catch(() => {})
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  const filteredBase = getFilteredPayments()
  const filtered = useMemo(() => {
    // After server-side filtering and pagination, we only apply client-side search here
    return filteredBase
  }, [filteredBase])

  const visibleStats = useMemo(() => {
    const totalReceived = filtered
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)

    const totalPending = filtered
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0)

    const totalFailed = filtered
      .filter(p => p.status === 'failed')
      .reduce((sum, p) => sum + p.amount, 0)

    const successRate = filtered.length > 0
      ? (filtered.filter(p => p.status === 'completed').length / filtered.length) * 100
      : 0

    const methodDistribution = filtered.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { totalReceived, totalPending, totalFailed, successRate, methodDistribution }
  }, [filtered])

  const methodDistribution = useMemo(() => {
    const entries = Object.entries(visibleStats.methodDistribution || {})
    const total = entries.reduce((s, [, c]) => s + c, 0) || 1
    return entries.map(([key, count]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      icon: methodIconMap[key] || CreditCard,
      count,
      percentage: Math.round((count / total) * 100),
    }))
  }, [visibleStats.methodDistribution])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gradient">Payments</h1>
          <p className="text-muted-foreground text-lg">Track and manage all payment transactions</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant={dateFilter === 'thisMonth' ? 'info' : 'outline'}
            className="border-2 hover:bg-muted/50 hover-lift"
            onClick={async () => {
              const next = dateFilter === 'thisMonth' ? 'all' : 'thisMonth'
              setDateFilter(next)
              const params: PaymentQueryParams = { status: statusSel, method: methodSel, page: 1, limit }
              if (next === 'thisMonth') {
                const start = new Date()
                start.setDate(1)
                const yyyy = start.getFullYear()
                const mm = String(start.getMonth() + 1).padStart(2, '0')
                const dd = String(start.getDate()).padStart(2, '0')
                params.dateFrom = `${yyyy}-${mm}-${dd}`
              } else {
                params.dateFrom = dateFrom || undefined
                params.dateTo = dateTo || undefined
              }
              try { await fetchPayments(params) } catch {}
              setStatusFilter(statusSel)
              usePaymentStore.getState().setMethodFilter(methodSel)
            }}
            title={dateFilter === 'thisMonth' ? 'Showing this month • Click to show all' : 'Click to filter this month'}
          >
            <Calendar className="h-5 w-5 mr-2" />
            {dateFilter === 'thisMonth' ? 'This Month (On)' : 'This Month'}
          </Button>
          <Button
            variant={showFilters ? 'info' : 'outline'}
            className="border-2 hover:bg-muted/50 hover-lift"
            onClick={() => setShowFilters(v => !v)}
            title="Toggle Filters"
          >
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </Button>
          <Button
            className="gradient-primary hover-lift shadow-medium text-white font-semibold px-6 py-3"
            onClick={() => {
              try {
                const header = ['Transaction ID','Invoice','Client','Amount','Method','Status','Processed At']
                const rows = filtered.map(p => [
                  p.transactionId || p.paymentNumber || p.id,
                  p.invoiceNumber || p.invoiceId,
                  p.clientName,
                  p.amount.toFixed(2),
                  p.method,
                  p.status,
                  new Date(p.processedAt).toISOString(),
                ])
                const csv = [header, ...rows]
                  .map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','))
                  .join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `payments_export_${dateFilter === 'thisMonth' ? 'this_month' : 'all'}.csv`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'}`)
              } catch {
                toast.error('Failed to export report')
              }
            }}
          >
            <Download className="h-5 w-5 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card hover-lift animate-slide-in-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Received</p>
                <p className="text-3xl font-bold text-gradient">${(visibleStats.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">Server total: ${serverStats.totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • This month: ${serverStats.monthlyReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="flex items-center text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-semibold">12.5%</span>
                  <span className="text-muted-foreground ml-1">from last month</span>
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-success/20 to-success/10 rounded-xl">
                <DollarSign className="h-7 w-7 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.1s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-gradient">${(visibleStats.totalPending || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 text-warning mr-1" />
                  <span className="text-warning font-semibold">{filtered.filter(p => p.status === 'pending').length} {filtered.filter(p => p.status === 'pending').length === 1 ? 'payment' : 'payments'}</span>
                  <span className="text-muted-foreground ml-1">awaiting</span>
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-warning/20 to-warning/10 rounded-xl">
                <Clock className="h-7 w-7 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.2s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold text-gradient">${(visibleStats.totalFailed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="flex items-center text-sm">
                  <XCircle className="h-4 w-4 text-destructive mr-1" />
                  <span className="text-destructive font-semibold">{filtered.filter(p => p.status === 'failed').length} {filtered.filter(p => p.status === 'failed').length === 1 ? 'payment' : 'payments'}</span>
                  <span className="text-muted-foreground ml-1">failed</span>
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-xl">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift animate-slide-in-up" style={{animationDelay: '0.3s'}}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold text-gradient">{(visibleStats.successRate || 0).toFixed(1)}%</p>
                <div className="flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-semibold">+2.1%</span>
                  <span className="text-muted-foreground ml-1">improvement</span>
                </div>
              </div>
              <div className="p-3 bg-gradient-to-br from-primary/20 to-secondary/10 rounded-xl">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Distribution */}
        <Card className="glass-card hover-lift">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gradient">Payment Methods</CardTitle>
            <CardDescription className="text-muted-foreground">Distribution by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {methodDistribution.map((method) => {
                const Icon = method.icon
                return (
                  <div key={method.name} className="flex items-center justify-between group">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-gradient-to-br from-primary/20 to-secondary/10 rounded-xl group-hover:shadow-soft transition-all">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{method.count} transactions</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold text-gradient">{method.percentage}%</p>
                      <div className="w-20 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-3 bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card className="glass-card hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold text-gradient">Recent Transactions</CardTitle>
                  <CardDescription className="text-muted-foreground">Latest payment activity</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="hover:bg-muted/50 transition-all">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Search and Filter */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search transactions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 text-base border-2 focus:border-primary/50 transition-all duration-200"
                    />
                  </div>
                  <Button variant={showFilters ? 'info' : 'outline'} className="border-2 hover:bg-muted/50 hover-lift" onClick={() => setShowFilters(v => !v)}>
                    <Filter className="h-5 w-5 mr-2" />
                    Filter
                  </Button>
                </div>

                {showFilters && (
                  <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">From</p>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">To</p>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={statusSel}
                          onChange={(e) => setStatusSel(isStatus(e.target.value) ? e.target.value : 'all')}
                        >
                          <option value="all">All</option>
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Method</p>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={methodSel}
                          onChange={(e) => setMethodSel(isMethod(e.target.value) ? e.target.value : 'all')}
                        >
                          <option value="all">All</option>
                          <option value="credit_card">Credit Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="paypal">PayPal</option>
                          <option value="stripe">Stripe</option>
                          <option value="cash">Cash</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={async () => {
                          setStatusFilter(statusSel)
                          usePaymentStore.getState().setMethodFilter(methodSel)
                          setPage(1)
                          const params: PaymentQueryParams = { status: statusSel, method: methodSel, page: 1, limit }
                          if (dateFilter !== 'thisMonth') {
                            if (dateFrom) params.dateFrom = dateFrom
                            if (dateTo) params.dateTo = dateTo
                          } else {
                            const start = new Date()
                            start.setDate(1)
                            const yyyy = start.getFullYear()
                            const mm = String(start.getMonth() + 1).padStart(2, '0')
                            const dd = String(start.getDate()).padStart(2, '0')
                            params.dateFrom = `${yyyy}-${mm}-${dd}`
                          }
                          try { await fetchPayments(params) } catch {}
                          setShowFilters(false)
                        }}
                      >
                        Apply Filters
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setDateFrom(''); setDateTo(''); setStatusSel('all'); setMethodSel('all'); setDateFilter('all')
                          setStatusFilter('all'); usePaymentStore.getState().setMethodFilter('all');
                          setPage(1)
                          try { await fetchPayments({ page: 1, limit }) } catch {}
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                {/* Status Filters */}
                <div className="flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map((st) => (
                    <Badge
                      key={st}
                      variant={statusFilter === st ? 'default' : 'outline'}
                      className="cursor-pointer px-4 py-2 text-sm font-medium hover:scale-105 transition-all"
                      onClick={async () => {
                        setStatusFilter(st)
                        setPage(1)
                        const params: PaymentQueryParams = { page: 1, limit, method: methodSel }
                        if (st !== 'all') params.status = st
                        if (dateFilter === 'thisMonth') {
                          const start = new Date()
                          start.setDate(1)
                          const yyyy = start.getFullYear()
                          const mm = String(start.getMonth() + 1).padStart(2, '0')
                          const dd = String(start.getDate()).padStart(2, '0')
                          params.dateFrom = `${yyyy}-${mm}-${dd}`
                        } else {
                          if (dateFrom) params.dateFrom = dateFrom
                          if (dateTo) params.dateTo = dateTo
                        }
                        try { await fetchPayments(params) } catch {}
                      }}
                    >
                      {st}
                    </Badge>
                  ))}
                </div>

                {/* Transactions List */}
                <div className="space-y-4">
                  {filtered.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-muted/30 to-transparent hover:from-muted/50 hover:to-muted/20 hover-lift transition-all duration-200 group border border-border/50">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm font-semibold">
                            {(payment.clientName || 'CL').split(' ').map(n => n[0]).join('').slice(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{payment.clientName}</p>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <span className="font-medium">{payment.transactionId || payment.paymentNumber || payment.id}</span>
                            <span>•</span>
                            <span>{payment.invoiceNumber || payment.invoiceId}</span>
                            <span>•</span>
                            <span>{new Date(payment.processedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right space-y-1">
                          <p className="font-bold text-gradient">${payment.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground font-medium">{payment.method.replace(/_/g,' ')}</p>
                        </div>
                        <Badge
                          variant={
                            payment.status === 'completed' ? 'success' :
                            payment.status === 'pending' ? 'warning' :
                            'destructive'
                          }
                          className="font-medium"
                        >
                          {payment.status}
                        </Badge>
                        {payment.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const input = window.prompt('Refund amount (leave blank for full amount):', payment.amount.toFixed(2))
                                const amt = input && input.trim() !== '' ? Number(input) : undefined
                                if (typeof amt === 'number' && (isNaN(amt) || amt <= 0)) { toast.error('Enter a valid amount'); return }
                                await refundPayment(payment.id, amt)
                                // refresh current page with active filters
                                const params: PaymentQueryParams = { page, limit, method: methodSel }
                                if (statusSel !== 'all') params.status = statusSel
                                if (dateFilter === 'thisMonth') {
                                  const start = new Date()
                                  start.setDate(1)
                                  const yyyy = start.getFullYear()
                                  const mm = String(start.getMonth() + 1).padStart(2, '0')
                                  const dd = String(start.getDate()).padStart(2, '0')
                                  params.dateFrom = `${yyyy}-${mm}-${dd}`
                                } else {
                                  if (dateFrom) params.dateFrom = dateFrom
                                  if (dateTo) params.dateTo = dateTo
                                }
                                if (searchTerm) params.search = searchTerm
                                await fetchPayments(params)
                              } catch {}
                            }}
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-muted-foreground">
                    Showing {filtered.length > 0 ? (page - 1) * limit + 1 : 0}–{(page - 1) * limit + filtered.length} of {total}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={limit}
                      onChange={async (e) => {
                        const newLimit = Number(e.target.value)
                        setLimit(newLimit)
                        setPage(1)
                        const params: PaymentQueryParams = { status: statusSel, method: methodSel, page: 1, limit: newLimit }
                        if (dateFilter === 'thisMonth') {
                          const start = new Date()
                          start.setDate(1)
                          const yyyy = start.getFullYear()
                          const mm = String(start.getMonth() + 1).padStart(2, '0')
                          const dd = String(start.getDate()).padStart(2, '0')
                          params.dateFrom = `${yyyy}-${mm}-${dd}`
                        } else {
                          if (dateFrom) params.dateFrom = dateFrom
                          if (dateTo) params.dateTo = dateTo
                        }
                        try { await fetchPayments(params) } catch {}
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={async () => {
                        const prev = Math.max(1, page - 1)
                        setPage(prev)
                        const params: PaymentQueryParams = { status: statusSel, method: methodSel, page: prev, limit }
                        if (dateFilter === 'thisMonth') {
                          const start = new Date()
                          start.setDate(1)
                          const yyyy = start.getFullYear()
                          const mm = String(start.getMonth() + 1).padStart(2, '0')
                          const dd = String(start.getDate()).padStart(2, '0')
                          params.dateFrom = `${yyyy}-${mm}-${dd}`
                        } else {
                          if (dateFrom) params.dateFrom = dateFrom
                          if (dateTo) params.dateTo = dateTo
                        }
                        try { await fetchPayments(params) } catch {}
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={async () => {
                        const next = Math.min(totalPages, page + 1)
                        setPage(next)
                        const params: PaymentQueryParams = { status: statusSel, method: methodSel, page: next, limit }
                        if (dateFilter === 'thisMonth') {
                          const start = new Date()
                          start.setDate(1)
                          const yyyy = start.getFullYear()
                          const mm = String(start.getMonth() + 1).padStart(2, '0')
                          const dd = String(start.getDate()).padStart(2, '0')
                          params.dateFrom = `${yyyy}-${mm}-${dd}`
                        } else {
                          if (dateFrom) params.dateFrom = dateFrom
                          if (dateTo) params.dateTo = dateTo
                        }
                        try { await fetchPayments(params) } catch {}
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
