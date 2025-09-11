'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Users,
  Clock,
  BarChart3,
  Filter,
  Printer,
  Share2
} from 'lucide-react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import apiClient from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getErrorMessage } from '@/lib/utils'

// Helper formatter
const fmtCurrency = (n: number) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0) } catch { return `$${(n || 0).toFixed(2)}` }
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [selectedReport, setSelectedReport] = useState('overview')

  // Real data states
  const [dashboard, setDashboard] = useState<null | {
    totalRevenue: number
    totalInvoices: number
    totalClients: number
    monthlyRevenue: number
    pendingAmount: number
    overdueAmount: number
    overdueInvoices: number
    topClients?: Array<{ id: string; name: string; email?: string; totalRevenue: number; invoiceCount: number }>
  }>(null)
  const [invoiceAnalytics, setInvoiceAnalytics] = useState<null | {
    statusDistribution: Array<{ status: string; count: number }>
    monthlyInvoices: Array<{ month: string; count: number }>
    averagePaymentTime: number
  }>(null)
  const [revenueAnalytics, setRevenueAnalytics] = useState<null | {
    period: string
    revenueData: Array<{ date: string; total: number; paid: number; pending: number; count: number }>
    totalRevenue: number
    growthRate: string
    invoiceCount: number
  }>(null)
  const [, setLoading] = useState(false)
  const [, setError] = useState<string | null>(null)

  // Load static-independent data on mount, and revenue when period changes
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [dash, inv, rev] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getInvoiceStats(),
          apiClient.getRevenueStats({ period: selectedPeriod }),
        ])
        if (!mounted) return
        setDashboard(dash)
        setInvoiceAnalytics(inv)
        setRevenueAnalytics(rev)
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to load analytics'))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [selectedPeriod])

  // Derivations
  const paidVsPending = useMemo(() => {
    const dist = invoiceAnalytics?.statusDistribution || []
    const map = dist.reduce<Record<string, number>>((acc, d) => { acc[d.status.toUpperCase()] = d.count; return acc }, {})
    const paid = map['PAID'] || 0
    const pending = (map['SENT'] || 0) + (map['VIEWED'] || 0)
    const overdue = map['OVERDUE'] || 0
    const cancelled = map['CANCELLED'] || 0
    const total = paid + pending + overdue + cancelled
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0
    return [
      { status: 'Paid', value: pct(paid) },
      { status: 'Pending', value: pct(pending) },
      { status: 'Overdue', value: pct(overdue) },
      { status: 'Cancelled', value: pct(cancelled) },
    ]
  }, [invoiceAnalytics])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Comprehensive business insights and performance metrics</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setSelectedPeriod(p => p === 'month' ? 'year' : 'month')}>
            <Calendar className="h-4 w-4 mr-2" />
            {selectedPeriod === 'month' ? 'This month' : (selectedPeriod === 'year' ? 'This year' : 'Last 7 days')}
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Badge
          variant={selectedReport === 'overview' ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2"
          onClick={() => setSelectedReport('overview')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Overview
        </Badge>
        <Badge
          variant={selectedReport === 'revenue' ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2"
          onClick={() => setSelectedReport('revenue')}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Revenue
        </Badge>
        <Badge
          variant={selectedReport === 'invoices' ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2"
          onClick={() => setSelectedReport('invoices')}
        >
          <FileText className="h-4 w-4 mr-2" />
          Invoices
        </Badge>
        <Badge
          variant={selectedReport === 'clients' ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2"
          onClick={() => setSelectedReport('clients')}
        >
          <Users className="h-4 w-4 mr-2" />
          Clients
        </Badge>
        <Badge
          variant={selectedReport === 'payments' ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2"
          onClick={() => setSelectedReport('payments')}
        >
          <Clock className="h-4 w-4 mr-2" />
          Payments
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmtCurrency(Number(dashboard?.totalRevenue || 0))}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
                <span className="text-sm font-medium text-emerald-600">{Number(revenueAnalytics?.growthRate || 0)}%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">growth</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{Number(dashboard?.totalInvoices || 0)}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
                <span className="text-sm font-medium text-emerald-600">{Number(revenueAnalytics?.invoiceCount || 0)}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">this period</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Clients</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{Number(dashboard?.totalClients || 0)}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">top clients by revenue shown below</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Payment Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{Number(invoiceAnalytics?.averagePaymentTime || 0)} days</p>
              <div className="flex items-center mt-2">
                <TrendingDown className="h-4 w-4 text-emerald-600 mr-1" />
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">based on paid invoices</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue performance</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueAnalytics?.revenueData || []}>
                  <defs>
                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      fmtCurrency(value), 
                      name === 'paid' ? 'Paid Revenue' : 'Pending Revenue'
                    ]}
                    labelFormatter={(label) => {
                      const date = new Date(label)
                      return date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="paid" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorPaid)"
                    name="Paid Revenue"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pending" 
                    stroke="#f59e0b" 
                    fillOpacity={1} 
                    fill="url(#colorPending)"
                    name="Pending Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCurrency(Math.max(0, ...(revenueAnalytics?.revenueData?.map(d => d.paid) || [0])))}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Peak Month</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtCurrency(((revenueAnalytics?.revenueData?.reduce((s, d) => s + d.paid, 0) || 0) / Math.max(1, revenueAnalytics?.revenueData?.length || 0)))}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Average</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{Number(revenueAnalytics?.growthRate || 0)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Growth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice Status</CardTitle>
                <CardDescription>Distribution by status</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={paidVsPending.map(item => ({
                      name: item.status,
                      value: item.value,
                      count: Math.round((item.value / 100) * (dashboard?.totalInvoices || 0))
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paidVsPending.map((entry, index) => {
                      const colors = {
                        'Paid': '#10b981',
                        'Pending': '#f59e0b', 
                        'Overdue': '#ef4444',
                        'Cancelled': '#6b7280'
                      }
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={colors[entry.status as keyof typeof colors] || '#6b7280'} 
                        />
                      )
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: { payload?: { count?: number } }) => [
                      `${value}% (${props?.payload?.count ?? 0} invoices)`,
                      name
                    ]}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {paidVsPending.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status === 'Paid' ? 'bg-emerald-500' :
                      item.status === 'Pending' ? 'bg-amber-500' :
                      item.status === 'Overdue' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item.status}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Top Performing Clients */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top Performing Clients</CardTitle>
              <CardDescription>By revenue contribution</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                  <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Client</th>
                  <th className="text-right py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                  <th className="text-right py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoices</th>
                  <th className="text-right py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(dashboard?.topClients || []).map((client, index, arr) => {
                  const total = arr.reduce((s, c) => s + (c.totalRevenue || 0), 0)
                  const share = total > 0 ? ((client.totalRevenue || 0) / total) * 100 : 0
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3">
                        <Badge variant="outline" className="font-mono">#{index + 1}</Badge>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                      </td>
                      <td className="py-3 text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(client.totalRevenue || 0)}</p>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end text-emerald-600">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          <span className="font-medium">{client.invoiceCount}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div 
                              className="h-2 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                              style={{ width: `${share.toFixed(1)}%` }}
                            />
                          </div>
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
