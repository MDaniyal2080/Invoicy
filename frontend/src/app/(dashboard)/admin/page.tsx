'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Activity, Settings, UserPlus, FileText, DollarSign, Search, Filter, Download, Trash2, Mail, Wrench } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'
import { formatCurrency, formatDate, getInitials, getErrorMessage } from '@/lib/utils'

type AdminStats = {
  totalUsers: number
  activeUsers: number
  totalInvoices: number
  totalRevenue: number
  totalClients: number
  monthlyGrowth?: { month: string; count: number }[]
}

type AdminUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  role: string
  subscriptionPlan: string | null
  subscriptionEnd: string | null
  invoiceLimit: number | null
  emailVerified: boolean
  isActive: boolean
  createdAt: string
  lastLogin: string | null
  _count: { invoices: number; clients: number }
}

type ActivityLog = {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  description?: string
  createdAt: string
  user?: { email: string; firstName: string | null; lastName: string | null }
}

type ErrorLog = {
  id: string
  level: string
  message: string
  stack?: string | null
  method?: string | null
  path?: string | null
  statusCode?: number | null
  userId?: string | null
  context?: unknown
  createdAt: string
}

// Local typing for admin error logs query parameters
type ErrorLogsParams = {
  search?: string
  level?: string
  method?: string
  path?: string
  statusCode?: number
  page?: number
  limit?: number
}

export default function AdminPage() {
  const router = useRouter()
  const { addNotification } = useUIStore()

  const [searchTerm, setSearchTerm] = useState('')
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const TABS = ['overview', 'users', 'activity', 'errors', 'system', 'app-config', 'email', 'backup', 'maintenance'] as const
  type Tab = typeof TABS[number]
  const isTab = (t: string | null): t is Tab => !!t && (TABS as readonly string[]).includes(t)
  const selectedTab: Tab = isTab(tabParam) ? tabParam : 'overview'

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLocalLoading] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Error logs state
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [errorPagination, setErrorPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [errorSearch, setErrorSearch] = useState('')
  const [errorDebouncedSearch, setErrorDebouncedSearch] = useState('')
  const [errorLevel, setErrorLevel] = useState<string>('')
  const [errorStatusCode, setErrorStatusCode] = useState<string>('')
  const [errorMethod, setErrorMethod] = useState<string>('')
  const [errorPath, setErrorPath] = useState<string>('')

  // System management local states (UI only; wire to API later)
  const [systemSiteName, setSystemSiteName] = useState('Invoicy')
  const [systemCurrency, setSystemCurrency] = useState('USD')
  const [systemTimezone, setSystemTimezone] = useState('UTC')

  const [allowRegistration, setAllowRegistration] = useState(true)
  const [maxUploadMB, setMaxUploadMB] = useState(10)

  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUser, setSmtpUser] = useState('')
  const [fromEmail, setFromEmail] = useState('no-reply@example.com')
  const [smtpSecure, setSmtpSecure] = useState(false)

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are undergoing maintenance. Please check back soon.')
  // Backup/maintenance status
  const [backupStatus, setBackupStatus] = useState<{ lastBackupAt: string | null; lastBackupId: string | null; lastBackupFile: string | null; maintenanceMode: boolean } | null>(null)
  const [runningBackup, setRunningBackup] = useState(false)

  // Email (System Settings) state for 'email' tab (full-featured)
  const [sysSettings, setSysSettings] = useState<any | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testingVerify, setTestingVerify] = useState(false)
  const [testingSend, setTestingSend] = useState(false)
  const [previewType, setPreviewType] = useState<'invoice' | 'payment-reminder' | 'payment-received' | 'password-reset' | 'verify-email' | 'welcome'>('welcome')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const setGlobalSiteName = useUIStore(s => s.setSiteName)

  // Redirect legacy settings tabs to the new unified admin settings page
  useEffect(() => {
    const legacyTabs: Tab[] = ['system', 'app-config', 'email', 'backup', 'maintenance']
    if (legacyTabs.includes(selectedTab)) {
      router.replace('/admin/settings')
    }
  }, [selectedTab, router])

  useEffect(() => {
    if (selectedTab === 'overview') {
      ;(async () => {
        try {
          setLocalLoading(true)
          const data = await apiClient.getAdminStats()
          setStats(data)
        } catch (e: unknown) {
          const message = getErrorMessage(e)
          addNotification({ type: 'error', title: 'Failed to load admin stats', message: typeof message === 'string' ? message : undefined })
        } finally {
          setLocalLoading(false)
        }
      })()
    }
  }, [selectedTab, addNotification])

  // Load App Config (allowRegistration, maxUploadMB) when App Config tab is selected
  useEffect(() => {
    if (selectedTab !== 'app-config') return
    ;(async () => {
      try {
        setLocalLoading(true)
        const s = await apiClient.getSystemSettings()
        if (typeof s?.allowRegistration !== 'undefined') setAllowRegistration(!!s.allowRegistration)
        if (typeof s?.maxUploadMB !== 'undefined') setMaxUploadMB(Number(s.maxUploadMB) || 10)
      } catch (e: unknown) {
        const message = getErrorMessage(e)
        addNotification({ type: 'error', title: 'Failed to load app configuration', message: typeof message === 'string' ? message : undefined })
      } finally {
        setLocalLoading(false)
      }
    })()
  }, [selectedTab, addNotification])

  // Load System Settings for System tab
  useEffect(() => {
    if (selectedTab !== 'system') return
    ;(async () => {
      try {
        setLocalLoading(true)
        const s = await apiClient.getSystemSettings()
        if (typeof s?.siteName === 'string') setSystemSiteName(s.siteName)
        if (typeof s?.defaultCurrency === 'string') setSystemCurrency(s.defaultCurrency)
        if (typeof s?.timezone === 'string') setSystemTimezone(s.timezone)
      } catch (e: unknown) {
        const message = getErrorMessage(e)
        addNotification({ type: 'error', title: 'Failed to load system settings', message: typeof message === 'string' ? message : undefined })
      } finally {
        setLocalLoading(false)
      }
    })()
  }, [selectedTab, addNotification])

  useEffect(() => {
    if (selectedTab === 'users') {
      ;(async () => {
        try {
          setLocalLoading(true)
          const res = await apiClient.getUsers({ search: debouncedSearch, page: pagination.page, limit: pagination.limit })
          setUsers(res.users)
          setPagination(res.pagination)
        } catch (e: unknown) {
          const message = getErrorMessage(e)
          addNotification({ type: 'error', title: 'Failed to load users', message: typeof message === 'string' ? message : undefined })
        } finally {
          setLocalLoading(false)
        }
      })()
    }
  }, [selectedTab, debouncedSearch, pagination.page, pagination.limit, addNotification])

  // Reset to page 1 when search term changes on Users tab
  useEffect(() => {
    if (selectedTab !== 'users') return
    setPagination((prev) => (prev.page !== 1 ? { ...prev, page: 1 } : prev))
  }, [searchTerm, selectedTab])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Debounce error logs search input
  useEffect(() => {
    const t = setTimeout(() => setErrorDebouncedSearch(errorSearch), 400)
    return () => clearTimeout(t)
  }, [errorSearch])

  useEffect(() => {
    if (selectedTab === 'activity') {
      ;(async () => {
        try {
          setLocalLoading(true)
          const res = await apiClient.getActivityLogs({ page: 1, limit: 50 })
          setActivities(res.logs)
        } catch (e: unknown) {
          const message = getErrorMessage(e)
          addNotification({ type: 'error', title: 'Failed to load activity logs', message: typeof message === 'string' ? message : undefined })
        } finally {
          setLocalLoading(false)
        }
      })()
    }
  }, [selectedTab, addNotification])

  // Fetch error logs
  useEffect(() => {
    if (selectedTab === 'errors') {
      ;(async () => {
        try {
          setLocalLoading(true)
          const params: ErrorLogsParams = {
            page: errorPagination.page,
            limit: errorPagination.limit,
          }
          if (errorDebouncedSearch) params.search = errorDebouncedSearch
          if (errorLevel) params.level = errorLevel
          if (errorMethod) params.method = errorMethod
          if (errorPath) params.path = errorPath
          if (errorStatusCode) params.statusCode = parseInt(errorStatusCode)
          const res = await apiClient.getErrorLogs(params)
          setErrorLogs(res.logs)
          setErrorPagination(res.pagination)
        } catch (e: unknown) {
          const message = getErrorMessage(e)
          addNotification({ type: 'error', title: 'Failed to load error logs', message: typeof message === 'string' ? message : undefined })
        } finally {
          setLocalLoading(false)
        }
      })()
    }
  }, [selectedTab, errorDebouncedSearch, errorLevel, errorMethod, errorPath, errorStatusCode, errorPagination.page, errorPagination.limit, addNotification])

  // Load backup/maintenance status when relevant tabs selected
  useEffect(() => {
    if (selectedTab !== 'backup' && selectedTab !== 'maintenance') return
    ;(async () => {
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
        setMaintenanceEnabled(!!status.maintenanceMode)
      } catch (e: unknown) {
        const message = getErrorMessage(e)
        addNotification({ type: 'warning', title: 'Could not load system status', message: typeof message === 'string' ? message : undefined })
      }
    })()
  }, [selectedTab, addNotification])

  const latestGrowth = useMemo(() => {
    if (!stats?.monthlyGrowth || stats.monthlyGrowth.length === 0) return { count: 0, rate: 0 }
    const arr = stats.monthlyGrowth
    const last = arr[arr.length - 1]?.count || 0
    const prev = arr[arr.length - 2]?.count || 0
    const rate = prev ? (((last - prev) / prev) * 100) : 0
    return { count: last, rate }
  }, [stats])

  async function handleRunBackup() {
    try {
      setRunningBackup(true)
      const res = await apiClient.adminRunBackup()
      addNotification({ type: 'success', title: 'Backup started', message: `Backup ${res.backupId} created` })
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
      } catch {}
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Backup failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setRunningBackup(false)
    }
  }

  async function handleSaveMaintenance() {
    try {
      const res = await apiClient.adminSetMaintenance(maintenanceEnabled)
      addNotification({ type: 'success', title: 'Maintenance updated', message: res.maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled' })
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
      } catch {}
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Failed to update maintenance', message: typeof message === 'string' ? message : undefined })
    }
  }

  async function handleToggleActive(u: AdminUser) {
    try {
      setLocalLoading(true)
      if (u.isActive) await apiClient.suspendUser(u.id)
      else await apiClient.activateUser(u.id)
      addNotification({ type: 'success', title: u.isActive ? 'User suspended' : 'User activated' })
      // refresh
      const res = await apiClient.getUsers({ search: searchTerm, page: pagination.page, limit: pagination.limit })
      setUsers(res.users)
      setPagination(res.pagination)
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Action failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setLocalLoading(false)
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return
    try {
      setLocalLoading(true)
      await apiClient.deleteUser(u.id)
      addNotification({ type: 'success', title: 'User deleted' })
      const res = await apiClient.getUsers({ search: searchTerm, page: pagination.page, limit: pagination.limit })
      setUsers(res.users)
      setPagination(res.pagination)
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Delete failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setLocalLoading(false)
    }
  }

  async function handleResetPassword(u: AdminUser) {
    const newPassword = prompt(`Enter new password for ${u.email} (min 8 chars):`)
    if (!newPassword) return
    if (newPassword.length < 8) {
      addNotification({ type: 'warning', title: 'Password too short', message: 'Minimum 8 characters' })
      return
    }
    try {
      setLocalLoading(true)
      await apiClient.resetUserPassword(u.id, newPassword)
      addNotification({ type: 'success', title: 'Password reset successfully' })
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Reset failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setLocalLoading(false)
    }
  }

  // Error logs handlers
  async function handleDeleteLog(log: ErrorLog) {
    if (!confirm('Delete this log entry?')) return
    try {
      setLocalLoading(true)
      await apiClient.deleteErrorLog(log.id)
      addNotification({ type: 'success', title: 'Error log deleted' })
      // refresh
      const params: ErrorLogsParams = {
        page: errorPagination.page,
        limit: errorPagination.limit,
      }
      if (errorDebouncedSearch) params.search = errorDebouncedSearch
      if (errorLevel) params.level = errorLevel
      if (errorMethod) params.method = errorMethod
      if (errorPath) params.path = errorPath
      if (errorStatusCode) params.statusCode = parseInt(errorStatusCode)
      const res = await apiClient.getErrorLogs(params)
      setErrorLogs(res.logs)
      setErrorPagination(res.pagination)
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Delete failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setLocalLoading(false)
    }
  }

  async function handleClearLogs() {
    if (!confirm('Clear error logs? This cannot be undone.')) return
    try {
      setLocalLoading(true)
      await apiClient.clearErrorLogs()
      addNotification({ type: 'success', title: 'Error logs cleared' })
      setErrorLogs([])
      setErrorPagination((p) => ({ ...p, page: 1, total: 0, totalPages: 0 }))
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Clear failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setLocalLoading(false)
    }
  }

  // ===== Email tab helpers =====
  useEffect(() => {
    if (selectedTab !== 'email') return
    ;(async () => {
      try {
        setLocalLoading(true)
        const s = await apiClient.getSystemSettings()
        setSysSettings(s)
      } catch (e: unknown) {
        const message = getErrorMessage(e)
        addNotification({ type: 'error', title: 'Failed to load email settings', message: typeof message === 'string' ? message : undefined })
      } finally {
        setLocalLoading(false)
      }
    })()
  }, [selectedTab, addNotification])

  function updateSys<K extends keyof any>(key: any, value: any) {
    setSysSettings((prev: any) => (prev ? { ...prev, [key]: value } : prev))
  }

  function buildEmailOverrides(): Record<string, any> {
    const s = sysSettings || {}
    const keys = [
      'EMAIL_PROVIDER',
      'SENDGRID_API_KEY',
      'EMAIL_TRACK_OPENS',
      'EMAIL_TRACK_CLICKS',
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_SECURE',
      'EMAIL_USER',
      'EMAIL_PASSWORD',
      'EMAIL_FROM',
      'EMAIL_CONNECTION_TIMEOUT_MS',
      'EMAIL_GREETING_TIMEOUT_MS',
      'EMAIL_SOCKET_TIMEOUT_MS',
    ] as const
    const o: Record<string, any> = {}
    keys.forEach((k) => { o[k] = s[k as any] })
    return o
  }

  async function handleSaveEmailSettings() {
    if (!sysSettings) return
    try {
      setSavingEmail(true)
      const res = await apiClient.updateSystemSettings(sysSettings)
      setSysSettings(res)
      addNotification({ type: 'success', title: 'Email settings updated' })
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Update failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleVerifySmtpConnection() {
    try {
      setTestingVerify(true)
      const overrides = buildEmailOverrides()
      const res = await apiClient.testSmtp(overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'SMTP connection successful' })
        // Auto-save settings to DB so provider config persists
        if (sysSettings) {
          try {
            const saved = await apiClient.updateSystemSettings(sysSettings)
            setSysSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: unknown) {
            const message = getErrorMessage(e)
            addNotification({ type: 'warning', title: 'Auto-save failed', message: typeof message === 'string' ? message : undefined })
          }
        }
      }
      else addNotification({ type: 'error', title: 'SMTP verification failed', message: res?.error || 'Unknown error' })
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'SMTP verification failed', message: typeof message === 'string' ? message : undefined })
    } finally {
      setTestingVerify(false)
    }
  }

  async function handleSendTestEmailAdmin() {
    if (!testTo.trim()) {
      addNotification({ type: 'error', title: 'Enter recipient email', message: 'Please provide a test recipient email' })
      return
    }
    try {
      setTestingSend(true)
      const overrides = buildEmailOverrides()
      const res = await apiClient.sendTestEmail(testTo.trim(), overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'Test email sent', message: `Message ID: ${res.messageId || 'N/A'}` })
        if (sysSettings) {
          try {
            const saved = await apiClient.updateSystemSettings(sysSettings)
            setSysSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: unknown) {
            const message = getErrorMessage(e)
            addNotification({ type: 'warning', title: 'Auto-save failed', message: typeof message === 'string' ? message : undefined })
          }
        }
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Failed to send test email', message: typeof message === 'string' ? message : undefined })
    } finally {
      setTestingSend(false)
    }
  }

  async function handleSendTestInvoiceEmailAdmin() {
    if (!testTo.trim()) {
      addNotification({ type: 'error', title: 'Enter recipient email', message: 'Please provide a test recipient email' })
      return
    }
    try {
      setTestingSend(true)
      const overrides = buildEmailOverrides()
      const res = await apiClient.sendTestInvoiceEmail(testTo.trim(), overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'Test invoice email sent', message: `Message ID: ${res.messageId || 'N/A'}` })
        if (sysSettings) {
          try {
            const saved = await apiClient.updateSystemSettings(sysSettings)
            setSysSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: unknown) {
            const message = getErrorMessage(e)
            addNotification({ type: 'warning', title: 'Auto-save failed', message: typeof message === 'string' ? message : undefined })
          }
        }
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Failed to send test invoice', message: typeof message === 'string' ? message : undefined })
    } finally {
      setTestingSend(false)
    }
  }

  async function handlePreviewEmailAdmin() {
    try {
      setPreviewLoading(true)
      const res = await apiClient.previewEmailTemplate(previewType)
      setPreview(res)
    } catch (e: unknown) {
      const message = getErrorMessage(e)
      addNotification({ type: 'error', title: 'Failed to load preview', message: typeof message === 'string' ? message : undefined })
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gradient">Admin Panel</h1>
          <p className="text-muted-foreground text-lg">System administration and user management</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/admin/settings')} className="hover-lift shadow-soft">
            <Settings className="h-5 w-5 mr-2" />
            System Settings
          </Button>
          <Button className="gradient-primary hover-lift shadow-medium text-white font-semibold">
            <Download className="h-5 w-5 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Section navigation moved to sidebar via /admin?tab=... links */}

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* System Stats (live) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '0ms' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold text-gradient">{stats?.totalUsers ?? '-'}</p>
                    <div className="flex items-center text-sm">
                      <UserPlus className="h-4 w-4 text-emerald-500 mr-1" />
                      <span className="text-muted-foreground">New last month: {latestGrowth.count}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-3xl font-bold text-gradient">{stats?.activeUsers ?? '-'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl">
                    <Activity className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '200ms' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-3xl font-bold text-gradient">{stats?.totalInvoices?.toLocaleString?.() ?? '-'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl">
                    <FileText className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Platform Revenue</p>
                    <p className="text-3xl font-bold text-gradient">{stats ? formatCurrency(stats.totalRevenue) : '-'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
                    <DollarSign className="h-8 w-8 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* User Growth Chart */}
            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '400ms' }}>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gradient">User Growth Trend</CardTitle>
                <CardDescription className="text-muted-foreground">Monthly user registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.monthlyGrowth || []}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        formatter={(value: number) => [value, 'New Users']}
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
                        dataKey="count" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorUsers)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Platform Revenue Distribution */}
            <Card className="glass-card hover-lift animate-fade-in" style={{ animationDelay: '500ms' }}>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gradient">Revenue Sources</CardTitle>
                <CardDescription className="text-muted-foreground">Platform revenue breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Subscription Fees', value: 65, amount: (stats?.totalRevenue || 0) * 0.65 },
                          { name: 'Transaction Fees', value: 25, amount: (stats?.totalRevenue || 0) * 0.25 },
                          { name: 'Premium Features', value: 10, amount: (stats?.totalRevenue || 0) * 0.10 }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { color: '#10b981' },
                          { color: '#f59e0b' },
                          { color: '#8b5cf6' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          `${value}% (${formatCurrency(props.payload.amount)})`,
                          name
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading && <p className="text-sm text-gray-500">Loading...</p>}
        </div>
      )}

      {selectedTab === 'errors' && (
        <div className="space-y-6">
          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search message or path..."
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                className="pl-10 glass-input"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Select
                value={errorLevel}
                onValueChange={(v) => setErrorLevel(v === 'ALL_LEVELS' ? '' : v)}
              >
                <SelectTrigger id="errorLevel" aria-label="Error Level" className="h-10 w-[140px] glass-input">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_LEVELS">All Levels</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                  <SelectItem value="WARN">WARN</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={errorMethod}
                onValueChange={(v) => setErrorMethod(v === 'ALL_METHODS' ? '' : v)}
              >
                <SelectTrigger id="errorMethod" aria-label="HTTP Method" className="h-10 w-[150px] glass-input">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_METHODS">All Methods</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Status"
                type="number"
                value={errorStatusCode}
                onChange={(e) => setErrorStatusCode(e.target.value)}
                className="w-24 glass-input"
              />
              <Input
                placeholder="Path contains"
                value={errorPath}
                onChange={(e) => setErrorPath(e.target.value)}
                className="w-40 glass-input"
              />
              <Button variant="destructive" className="text-white hover-lift shadow-soft" onClick={handleClearLogs}>
                <Trash2 className="h-5 w-5 mr-2" />
                Clear Logs
              </Button>
            </div>
          </div>

          {/* Error Logs Table */}
          <Card className="glass-card hover-lift">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gradient">Recent Errors</CardTitle>
              <CardDescription className="text-muted-foreground">System-wide unhandled exceptions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Level</th>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message</th>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Path</th>
                      <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                      <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {errorLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-4">
                          <Badge variant={log.level === 'ERROR' ? 'destructive' : 'warning'}>{log.level}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="max-w-xl truncate" title={log.message}>{log.message}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{log.statusCode ?? '-'}</td>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{log.method ?? '-'}</td>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="max-w-xs truncate" title={log.path ?? ''}>{log.path ?? '-'}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(log.createdAt)}</td>
                        <td className="p-4 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleDeleteLog(log)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {errorLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-400">No error logs</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'users' && (
        <div className="space-y-6">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 glass-input"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="hover-lift shadow-soft">
                <Filter className="h-5 w-5 mr-2" />
                Filter
              </Button>
              <Button className="gradient-primary hover-lift shadow-medium text-white font-semibold">
                <UserPlus className="h-5 w-5 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Users Table (live) */}
          <Card className="glass-card hover-lift">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Login</th>
                      <th className="text-right p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoices</th>
                      <th className="text-right p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clients</th>
                      <th className="text-right p-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => {
                      const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                      return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white">
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              user.role === 'SUPER_ADMIN'
                                ? 'warning'
                                : user.role === 'ADMIN'
                                ? 'default'
                                : user.role === 'MANAGER'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.isActive ? 'success' : 'secondary'}>
                            {user.isActive ? 'active' : 'inactive'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                          {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                        </td>
                        <td className="p-4 text-right font-medium">
                          {user._count?.invoices ?? 0}
                        </td>
                        <td className="p-4 text-right font-medium">
                          {user._count?.clients ?? 0}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/users/${user.id}`)}>
                              View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(user)}>
                              {user.isActive ? 'Suspend' : 'Activate'}
                            </Button>
                            <Button variant="destructive"  className="text-white" size="sm" onClick={() => handleDelete(user)}>
                              Delete
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleResetPassword(user)}>
                              Reset Password
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'activity' && (
        <div className="space-y-6">
          {/* Activity Log (live) */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>System-wide activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity) => {
                  const displayUser = [activity.user?.firstName, activity.user?.lastName].filter(Boolean).join(' ') || activity.user?.email || 'System'
                  const iconType = activity.entity
                  return (
                  <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className={`p-2 rounded-lg ${
                      iconType === 'invoice' ? 'bg-indigo-100' :
                      iconType === 'user' ? 'bg-purple-100' :
                      'bg-amber-100'
                    }`}>
                      {iconType === 'invoice' && <FileText className="h-4 w-4 text-indigo-600" />}
                      {iconType === 'user' && <Users className="h-4 w-4 text-purple-600" />}
                      {iconType !== 'invoice' && iconType !== 'user' && <Activity className="h-4 w-4 text-amber-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {displayUser} <span className="font-normal text-gray-500 dark:text-gray-400">{activity.action}</span>
                        </p>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(activity.createdAt)}</span>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{activity.description}</p>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'system' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Core platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Site Name</label>
                  <Input value={systemSiteName} onChange={(e) => setSystemSiteName(e.target.value)} placeholder="Invoicy" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Currency</label>
                  <Input value={systemCurrency} onChange={(e) => setSystemCurrency(e.target.value)} placeholder="USD" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Timezone</label>
                  <Input value={systemTimezone} onChange={(e) => setSystemTimezone(e.target.value)} placeholder="UTC" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={async () => {
                  try {
                    setLocalLoading(true)
                    const saved = await apiClient.updateSystemSettings({ siteName: systemSiteName, defaultCurrency: systemCurrency, timezone: systemTimezone })
                    // Update global branding immediately
                    setGlobalSiteName(saved?.siteName || systemSiteName)
                    addNotification({ type: 'success', title: 'Settings saved' })
                  } catch (e: unknown) {
                    const message = getErrorMessage(e)
                    addNotification({ type: 'error', title: 'Save failed', message: typeof message === 'string' ? message : undefined })
                  } finally {
                    setLocalLoading(false)
                  }
                }} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
                  <Settings className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'app-config' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Application Configuration</CardTitle>
              <CardDescription>Feature toggles and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium">Allow Registration</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enable new user signups</p>
                  </div>
                  <input type="checkbox" checked={allowRegistration} onChange={(e) => setAllowRegistration(e.target.checked)} />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Max Upload Size (MB)</label>
                  <Input type="number" value={maxUploadMB} onChange={(e) => setMaxUploadMB(parseInt(e.target.value || '0'))} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    try {
                      setLocalLoading(true)
                      const saved = await apiClient.updateSystemSettings({ allowRegistration, maxUploadMB })
                      if (typeof saved?.allowRegistration !== 'undefined') setAllowRegistration(!!saved.allowRegistration)
                      if (typeof saved?.maxUploadMB !== 'undefined') setMaxUploadMB(Number(saved.maxUploadMB) || maxUploadMB)
                      addNotification({ type: 'success', title: 'Configuration saved' })
                    } catch (e: unknown) {
                      const message = getErrorMessage(e)
                      addNotification({ type: 'error', title: 'Save failed', message: typeof message === 'string' ? message : undefined })
                    } finally {
                      setLocalLoading(false)
                    }
                  }}
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
                >
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'email' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Email Settings</CardTitle>
                {sysSettings && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border">
                    Provider: <b>{String(sysSettings.EMAIL_PROVIDER || 'SMTP')}</b>
                  </span>
                )}
              </div>
              <CardDescription>
                Configure the global email provider. Client-facing emails will render the friendly From name as
                "[User Company] via Invoicy" and set Reply-To to the user's company email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!sysSettings && (
                <p className="text-sm text-gray-500">Loading email settings...</p>
              )}
              {sysSettings && (
                <>
                  {/* Provider + From */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400">Email Provider</label>
                      <Select value={(sysSettings.EMAIL_PROVIDER || 'SMTP') as any} onValueChange={(val) => updateSys('EMAIL_PROVIDER', val)}>
                        <SelectTrigger id="EMAIL_PROVIDER" className="mt-2 w-full" aria-label="Email Provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SMTP">SMTP</SelectItem>
                          <SelectItem value="SENDGRID">SendGrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400">From Email</label>
                      <Input value={sysSettings.EMAIL_FROM || ''} onChange={(e) => updateSys('EMAIL_FROM', e.target.value)} placeholder="noreply@invoicy.com" />
                      <p className="text-xs text-gray-500 mt-1">Envelope From used by the provider. Visible From name is customized per email. Replies go to the user's company email.</p>
                    </div>
                  </div>

                  {/* SendGrid */}
                  {sysSettings.EMAIL_PROVIDER === 'SENDGRID' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">SendGrid API Key</label>
                        <Input type="password" value={sysSettings.SENDGRID_API_KEY || ''} onChange={(e) => updateSys('SENDGRID_API_KEY', e.target.value)} placeholder="SG.xxxxxx" />
                        <p className="text-xs text-gray-500 mt-1">Use "__SECRET__" to keep your existing key unchanged when saving.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="inline-flex items-center gap-3">
                          <input type="checkbox" className="h-4 w-4" checked={!!sysSettings.EMAIL_TRACK_OPENS} onChange={(e) => updateSys('EMAIL_TRACK_OPENS', e.target.checked)} />
                          <span>Track Opens</span>
                        </label>
                        <label className="inline-flex items-center gap-3">
                          <input type="checkbox" className="h-4 w-4" checked={!!sysSettings.EMAIL_TRACK_CLICKS} onChange={(e) => updateSys('EMAIL_TRACK_CLICKS', e.target.checked)} />
                          <span>Track Clicks</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* SMTP */}
                  {sysSettings.EMAIL_PROVIDER !== 'SENDGRID' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">SMTP Host</label>
                        <Input value={sysSettings.EMAIL_HOST || ''} onChange={(e) => updateSys('EMAIL_HOST', e.target.value)} placeholder="smtp-relay.brevo.com" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">SMTP Port</label>
                        <Input type="number" value={Number(sysSettings.EMAIL_PORT ?? 587)} onChange={(e) => updateSys('EMAIL_PORT', parseInt(e.target.value || '0'))} />
                      </div>
                      <label className="inline-flex items-center gap-3">
                        <input type="checkbox" className="h-4 w-4" checked={!!sysSettings.EMAIL_SECURE} onChange={(e) => updateSys('EMAIL_SECURE', e.target.checked)} />
                        <span>Use TLS/SSL (secure)</span>
                      </label>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Username</label>
                        <Input value={sysSettings.EMAIL_USER || ''} onChange={(e) => updateSys('EMAIL_USER', e.target.value)} placeholder="your@email.com" />
                        <p className="text-xs text-gray-500 mt-1">Brevo: Username is typically your account email.</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Password</label>
                        <Input type="password" value={sysSettings.EMAIL_PASSWORD || ''} onChange={(e) => updateSys('EMAIL_PASSWORD', e.target.value)} placeholder="SMTP password / key" />
                        <p className="text-xs text-gray-500 mt-1">Brevo: Use your SMTP key. Enter "__SECRET__" to keep the current value unchanged.</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Connection Timeout (ms)</label>
                        <Input type="number" value={Number(sysSettings.EMAIL_CONNECTION_TIMEOUT_MS ?? 10000)} onChange={(e) => updateSys('EMAIL_CONNECTION_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Greeting Timeout (ms)</label>
                        <Input type="number" value={Number(sysSettings.EMAIL_GREETING_TIMEOUT_MS ?? 10000)} onChange={(e) => updateSys('EMAIL_GREETING_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Socket Timeout (ms)</label>
                        <Input type="number" value={Number(sysSettings.EMAIL_SOCKET_TIMEOUT_MS ?? 20000)} onChange={(e) => updateSys('EMAIL_SOCKET_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                      </div>
                    </div>
                  )}

                  {/* Actions: Save + Tests */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-end">
                      <Button onClick={handleSaveEmailSettings} disabled={savingEmail} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
                        <Mail className="h-4 w-4 mr-2" /> {savingEmail ? 'Saving…' : 'Save Email Settings'}
                      </Button>
                    </div>
                    <div className="flex flex-col lg:flex-row items-end gap-3">
                      <div className="w-full lg:w-auto">
                        <label className="text-sm text-gray-500 dark:text-gray-400">Test Recipient Email</label>
                        <Input type="email" className="w-full lg:max-w-xs" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                      </div>
                      <div className="flex items-center gap-1 lg:ml-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="whitespace-nowrap"
                          disabled={testingVerify || savingEmail || sysSettings?.EMAIL_PROVIDER === 'SENDGRID'}
                          onClick={handleVerifySmtpConnection}
                          title={sysSettings?.EMAIL_PROVIDER === 'SENDGRID' ? 'SMTP verification is only available when provider is SMTP' : undefined}
                        >
                          {testingVerify ? 'Verifying…' : 'Test SMTP Connection'}
                        </Button>
                        <Button type="button" className="whitespace-nowrap" disabled={testingSend || savingEmail} onClick={handleSendTestEmailAdmin}>
                          {testingSend ? 'Sending…' : 'Send Test Email'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="whitespace-nowrap"
                          onClick={handleSendTestInvoiceEmailAdmin}
                        >
                          {testingSend ? 'Sending…' : 'Send Test Invoice Email'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Email Template Preview */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Email Template Preview</CardTitle>
              <CardDescription>Preview built-in email templates without sending.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Template</label>
                  <Select value={previewType} onValueChange={(val) => setPreviewType(val as any)}>
                    <SelectTrigger id="PREVIEW_TYPE" className="mt-2 w-full" aria-label="Email Template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="invoice">Invoice Sent</SelectItem>
                      <SelectItem value="payment-reminder">Payment Reminder</SelectItem>
                      <SelectItem value="payment-received">Payment Received</SelectItem>
                      <SelectItem value="password-reset">Password Reset</SelectItem>
                      <SelectItem value="verify-email">Verify Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={handlePreviewEmailAdmin} disabled={previewLoading}>
                    {previewLoading ? 'Loading…' : 'Preview'}
                  </Button>
                  {preview && (
                    <Button type="button" variant="outline" onClick={() => setPreview(null)}>Clear</Button>
                  )}
                </div>
              </div>
              {preview && (
                <div className="mt-6">
                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">Subject: <span className="font-medium">{preview.subject}</span></div>
                  <div className="border rounded overflow-hidden h-[600px]">
                    <iframe title="Email Preview" className="w-full h-full" srcDoc={preview.html} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'backup' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Backup Management</CardTitle>
              <CardDescription>Create and restore backups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleRunBackup} disabled={runningBackup} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
                  {runningBackup ? 'Running…' : 'Create Backup'}
                </Button>
                <Button variant="outline" onClick={() => addNotification({ type: 'success', title: 'Latest backup download started' })}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Latest
                </Button>
                <label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                  <input type="file" className="hidden" onChange={() => addNotification({ type: 'success', title: 'Restore file selected' })} />
                  <span>Restore from file</span>
                </label>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Last backup: <span className="font-medium">{backupStatus?.lastBackupAt ? new Date(backupStatus.lastBackupAt).toLocaleString() : '—'}</span></div>
                <div>Backup ID: <span className="font-mono">{backupStatus?.lastBackupId || '—'}</span></div>
                <div>File: <span className="font-mono">{backupStatus?.lastBackupFile || '—'}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'maintenance' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>Temporarily disable user access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="text-sm font-medium">Enable Maintenance Mode</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Show maintenance page to non-admins</p>
                </div>
                <input type="checkbox" checked={maintenanceEnabled} onChange={(e) => setMaintenanceEnabled(e.target.checked)} />
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Announcement</label>
                <textarea className="w-full rounded-md border bg-background p-2" rows={3} value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveMaintenance} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
                  <Wrench className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
