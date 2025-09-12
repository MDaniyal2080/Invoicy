'use client'

import { useEffect, useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Users, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  MoreVertical
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import apiClient from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import type { Invoice as ApiInvoice } from '@/types/invoice'
import { useAuthStore } from '@/lib/stores/auth-store'

interface DashboardStats {
  totalRevenue: number
  outstanding: number
  totalInvoices: number
  activeClients: number
  revenueChange: number
  outstandingChange: number
  invoiceChange: number
  clientChange: number
}

interface DashboardInvoice {
  id: string
  invoiceNumber: string
  clientId: string
  client?: { name: string }
  amount: number
  status: string
  dueDate: string
  createdAt: string
}

interface Payment {
  id: string
  invoiceId: string
  invoice?: { client?: { name: string } }
  amount: number
  dueDate: string
}

interface ClientStats {
  name: string
  revenue: number
  invoiceCount: number
}

interface ActivityItem {
  id: string
  title: string
  description?: string
  date: string // ISO
  type: 'invoice' | 'payment' | 'client'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<DashboardInvoice[]>([])
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([])
  const [topClients, setTopClients] = useState<ClientStats[]>([])
  const [outstandingInvoices, setOutstandingInvoices] = useState<DashboardInvoice[]>([])
  const [outstandingTotal, setOutstandingTotal] = useState<number>(0)
  const [revenueSeries, setRevenueSeries] = useState<Array<{ label: string; amount: number }>>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    // Only fetch dashboard data when user is verified
    if (!user?.emailVerified) {
      setLoading(false)
      return
    }
    fetchDashboardData()
  }, [user?.emailVerified])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch dashboard statistics
      const [statsRes, invoicesRes, clientStatsRes] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getInvoices({ limit: 5, sort: 'createdAt', order: 'desc' }),
        apiClient.getClientStats({ limit: 4 })
      ])

      // Map backend analytics fields to the shape expected by this UI
      const stats: any = statsRes || {}
      const mappedStats: DashboardStats = {
        totalRevenue: Number(stats.totalRevenue ?? 0),
        // Backend returns pendingAmount (SENT/VIEWED/OVERDUE); UI expects outstanding
        outstanding: Number(stats.outstanding ?? stats.pendingAmount ?? 0),
        totalInvoices: Number(stats.totalInvoices ?? 0),
        // Backend returns totalClients (active only per backend query); UI expects activeClients
        activeClients: Number(stats.activeClients ?? stats.totalClients ?? 0),
        // Changes are not provided by backend yet; default to 0
        revenueChange: Number(stats.revenueChange ?? 0),
        outstandingChange: Number(stats.outstandingChange ?? 0),
        invoiceChange: Number(stats.invoiceChange ?? 0),
        clientChange: Number(stats.clientChange ?? 0),
      }
      setDashboardData(mappedStats)

      const invoicesRaw: ApiInvoice[] = Array.isArray(invoicesRes)
        ? invoicesRes
        : (invoicesRes?.items ?? [])
      const invoicesList: DashboardInvoice[] = (invoicesRaw || []).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        client: inv.client ? { name: inv.client.name } : undefined,
        amount: typeof inv.totalAmount === 'number' ? inv.totalAmount : (typeof inv.subtotal === 'number' ? inv.subtotal : 0),
        status: inv.status,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
      }))
      setRecentInvoices(invoicesList || [])

      const topRaw = Array.isArray(clientStatsRes)
        ? clientStatsRes
        : (clientStatsRes?.mostActiveClients ?? clientStatsRes?.items ?? clientStatsRes?.data ?? [])
      const clientList: ClientStats[] = (topRaw || []).map((c: any) => ({
        name: c?.name ?? c?.client?.name ?? 'Unknown',
        revenue: Number(c?.totalRevenue ?? c?.revenue ?? 0),
        invoiceCount: Number(c?.invoiceCount ?? c?.count ?? 0),
      }))
      setTopClients(clientList || [])

      // Compute outstanding invoices from the fetched list
      const outstanding = (invoicesList || []).filter(
        (inv) => inv.status === 'PENDING' || inv.status === 'OVERDUE'
      )
      const outstandingSum = outstanding.reduce((sum, inv) => sum + (inv.amount || 0), 0)
      setOutstandingInvoices(outstanding)
      setOutstandingTotal(outstandingSum)

      // Build a simple 6-month revenue series using available invoices
      const months: Array<{ key: string; label: string }> = (() => {
        const arr: Array<{ key: string; label: string }> = []
        const d = new Date()
        for (let i = 5; i >= 0; i--) {
          const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
          const label = dt.toLocaleString('en-US', { month: 'short' })
          arr.push({ key, label })
        }
        return arr
      })()

      const series = months.map(({ key, label }) => {
        const total = (invoicesList || []).reduce((sum, inv) => {
          const invDate = new Date(inv.createdAt)
          const invKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`
          return invKey === key ? sum + (inv.amount || 0) : sum
        }, 0)
        return { label, amount: total }
      })
      setRevenueSeries(series)

      // Basic activity timeline derived from invoice events
      const act: ActivityItem[] = (invoicesList || []).slice(0, 8).map((inv) => ({
        id: inv.id,
        title: inv.status === 'PAID' ? 'Payment received' : 'Invoice created',
        description: `${inv.invoiceNumber || inv.id.slice(0, 8)} · ${inv.client?.name || 'Unknown Client'}`,
        date: inv.createdAt,
        type: inv.status === 'PAID' ? 'payment' : 'invoice',
      }))
      // Sort newest first
      act.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setActivity(act)

      // Mock upcoming payments for now (will be replaced with real payment data)
      const mockPayments = (invoicesList || [])
        .filter((inv: DashboardInvoice) => inv.status === 'SENT' || inv.status === 'VIEWED')
        .slice(0, 3)
        .map((inv: DashboardInvoice) => ({
        id: inv.id,
        invoiceId: inv.id,
        invoice: { client: inv.client },
        amount: inv.amount,
        dueDate: inv.dueDate
      })) || []
      setUpcomingPayments(mockPayments)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const calculateDaysLeft = (dueDate: string) => {
    const due = new Date(dueDate)
    const today = new Date()
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  const stats = [
    {
      title: 'Total Revenue',
      value: formatCurrency(dashboardData?.totalRevenue || 0),
      change: `${dashboardData?.revenueChange || 0 > 0 ? '+' : ''}${dashboardData?.revenueChange || 0}%`,
      trend: (dashboardData?.revenueChange || 0) >= 0 ? 'up' : 'down',
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(dashboardData?.outstanding || 0),
      change: `${dashboardData?.outstandingChange || 0 > 0 ? '+' : ''}${dashboardData?.outstandingChange || 0}%`,
      trend: (dashboardData?.outstandingChange || 0) <= 0 ? 'up' : 'down',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Total Invoices',
      value: dashboardData?.totalInvoices?.toString() || '0',
      change: `${dashboardData?.invoiceChange || 0 > 0 ? '+' : ''}${dashboardData?.invoiceChange || 0}%`,
      trend: (dashboardData?.invoiceChange || 0) >= 0 ? 'up' : 'down',
      icon: FileText,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      title: 'Active Clients',
      value: dashboardData?.activeClients?.toString() || '0',
      change: `${dashboardData?.clientChange || 0 > 0 ? '+' : ''}${dashboardData?.clientChange || 0} new`,
      trend: (dashboardData?.clientChange || 0) >= 0 ? 'up' : 'down',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
          
          
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center text-xs sm:text-sm font-medium ${
                    stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    <span className="hidden sm:inline">{stat.change}</span>
                    <span className="sm:hidden">{stat.change.split('%')[0]}%</span>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </div>
                <div className="mt-3 sm:mt-4">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</h3>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Revenue Chart + Recent Invoices */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Revenue Chart (6 months) */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">Revenue (last 6 months)</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Monthly totals from recent activity</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6">
              <div>
                <CardTitle className="text-base sm:text-lg">Recent Invoices</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Your latest invoice activity</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}</p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{invoice.client?.name || 'Unknown Client'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{formatCurrency(invoice.amount)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{formatDate(invoice.createdAt)}</p>
                      </div>
                      <Badge
                        variant={
                          invoice.status === 'PAID' ? 'success' :
                          (invoice.status === 'SENT' || invoice.status === 'VIEWED') ? 'warning' :
                          invoice.status === 'OVERDUE' ? 'destructive' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {invoice.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                onClick={() => router.push('/invoices')}
                variant="outline" className="w-full mt-4">
                View All Invoices
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Outstanding Invoices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Outstanding Invoices</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{outstandingInvoices.length} due • Total {formatCurrency(outstandingTotal)}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3">
                {outstandingInvoices.slice(0, 4).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{inv.client?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <Badge variant={inv.status === 'OVERDUE' ? 'destructive' : 'warning'} className="text-xs flex-shrink-0">
                      {formatCurrency(inv.amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Payments */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Upcoming Payments</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Payments due soon</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-4">
                {upcomingPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{payment.invoice?.client?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Due in {calculateDaysLeft(payment.dueDate)} days</p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Top Clients</CardTitle>
              <CardDescription className="text-xs sm:text-sm">By revenue this month</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
                {topClients.map((client, index) => (
                  <div key={index} className="flex items-center space-x-2 sm:space-x-3">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                      <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-xs sm:text-sm">
                        {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{client.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{client.invoiceCount} invoices</p>
                    </div>
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white flex-shrink-0">{formatCurrency(client.revenue)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Activity</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Recent events</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 sm:gap-3">
                    <div className={
                      item.type === 'payment'
                        ? 'h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0'
                        : 'h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0'
                    }>
                      {item.type === 'payment' ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <FileText className="h-3 w-3 sm:h-4 sm:w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                      {item.description ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{formatDate(item.date)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
