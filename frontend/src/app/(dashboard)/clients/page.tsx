'use client'

import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Download,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Building2,
  Edit,
  Eye,
  FileText,
  Users,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react'
import { DollarSign, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import apiClient from '@/lib/api-client'
import { useClientStore } from '@/lib/stores/client-store'
import type { ClientType } from '@/types/client'

interface ClientStats {
  totalClients: number
  activeClients: number
  totalRevenue: number
  outstanding: number
}

export default function ClientsPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<string | undefined>(undefined)
  const {
    clients,
    isLoading,
    searchQuery,
    statusFilter,
    viewMode,
    setSearchQuery,
    setStatusFilter,
    setViewMode,
    fetchClients,
    updateClient,
    deleteClient,
    getFilteredClients,
  } = useClientStore()
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    fetchClients()
    fetchClientStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const l = typeof window !== 'undefined' ? localStorage.getItem('language') : null
      setLocale(l && l !== 'system' ? l : undefined)
    } catch {}
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchClients()
    }, 300)
    return () => clearTimeout(timeoutId)
    // Re-fetch when search or status changes
  }, [searchQuery, statusFilter, fetchClients])

  const fetchClientStats = async () => {
    try {
      const response = await apiClient.getClientStats()
      setStats(response)
    } catch (error) {
      console.error('Failed to fetch client stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    try {
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Company',
        'City',
        'State',
        'Country',
        'Status',
        'ClientType',
        'Invoices',
        'CreatedAt',
      ]

      const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`

      // Use filtered/displayed clients for export
      const filtered = getFilteredClients()
      const rows = filtered.map(c => [
        c.id,
        c.name,
        c.email,
        c.phone || '',
        c.companyName || '',
        c.city || '',
        c.state || '',
        c.country || '',
        c.isActive ? 'Active' : 'Inactive',
        c.clientType,
        String(c._count?.invoices ?? 0),
        new Date(c.createdAt).toISOString(),
      ])

      const csv = [headers, ...rows]
        .map(row => row.map(val => escapeCell(String(val))).join(','))
        .join('\n')

      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.href = url
      a.download = `clients-export-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatClientType = (type: ClientType) => (type === 'COMPANY' ? 'Company' : 'Individual')

  const toggleMenu = (id: string, e?: ReactMouseEvent<HTMLButtonElement>) => {
    // Close when toggling the same id
    if (openMenuId === id) {
      setOpenMenuId(null)
      setMenuPosition(null)
      return
    }

    // Compute position using click coordinates
    if (e) {
      const menuWidth = 176 // w-44
      const menuHeight = 96 // approx height for 2 items
      const spacing = 8
      const clickX = e.clientX
      const clickY = e.clientY
      const rawTop = clickY + spacing
      const rawLeft = clickX - menuWidth
      const top = Math.max(spacing, Math.min(window.innerHeight - menuHeight - spacing, rawTop))
      const left = Math.max(spacing, Math.min(window.innerWidth - menuWidth - spacing, rawLeft))
      setMenuPosition({ top, left })
    } else {
      setMenuPosition(null)
    }

    setOpenMenuId(id)
  }

  const closeMenu = () => { setOpenMenuId(null); setMenuPosition(null) }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateClient(id, { isActive: !isActive })
    } finally {
      // No-op; store handles notifications
    }
  }

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Are you sure you want to delete this client? This cannot be undone.')
      if (!ok) return
    }
    try {
      await deleteClient(id)
    } finally {
      // No-op; store handles notifications
    }
  }

  const getClientAvatar = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary shadow-glow"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 animate-fade-in-up px-2 sm:px-0">
        <div className="space-y-2 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Clients
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg leading-relaxed">
            Manage your client relationships with ease
          </p>
        </div>
        <Link href="/clients/new" className="w-full sm:w-auto">
          <Button size="lg" className="hover-lift shadow-medium w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="hidden xs:inline">Add New Client</span>
            <span className="xs:hidden">Add Client</span>
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up px-2 sm:px-0">
        <Card className="hover-lift group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Clients</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.totalClients || 0}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl group-hover:from-blue-500/20 group-hover:to-blue-600/20 transition-all duration-300">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-lift group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Active Clients</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.activeClients || 0}</p>
              </div>
              <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl group-hover:from-green-500/20 group-hover:to-green-600/20 transition-all duration-300 flex-shrink-0">
                <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-lift group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Revenue</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">${stats?.totalRevenue?.toLocaleString() || '0'}</p>
              </div>
              <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl group-hover:from-purple-500/20 group-hover:to-purple-600/20 transition-all duration-300 flex-shrink-0">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-lift group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Outstanding</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.outstanding || 0}</p>
              </div>
              <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-500/10 to-orange-600/10 rounded-xl group-hover:from-orange-500/20 group-hover:to-orange-600/20 transition-all duration-300 flex-shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="glass-card animate-slide-in-right">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="search"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 sm:pl-12 h-10 sm:h-12 text-sm sm:text-base border-2 focus:border-primary/50 transition-all duration-200"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                  className="transition-all duration-200 whitespace-nowrap"
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'success' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                  className="transition-all duration-200 whitespace-nowrap"
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                  className="transition-all duration-200 whitespace-nowrap"
                >
                  Inactive
                </Button>
              </div>
              <div className="hidden sm:block h-6 w-px bg-border"></div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="transition-all duration-200 flex-1 sm:flex-none"
                >
                  Grid View
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="transition-all duration-200 flex-1 sm:flex-none"
                >
                  List View
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport} className="hover-lift whitespace-nowrap">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 animate-fade-in-up px-2 sm:px-0">
          {clients.map((client, index) => (
            <Card key={client.id} className="hover-lift group overflow-hidden" style={{animationDelay: `${index * 0.1}s`}}>
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-start justify-between">
                  <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-4 ring-primary/10 group-hover:ring-primary/20 transition-all duration-300 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-base sm:text-lg font-bold">
                      {getClientAvatar(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <Badge variant={client.isActive ? 'success' : 'muted'}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {formatClientType(client.clientType)}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="mt-3 sm:mt-4 text-lg sm:text-xl group-hover:text-primary transition-colors truncate">{client.name}</CardTitle>
                <CardDescription className="text-sm sm:text-base truncate">Client since {formatDate(client.createdAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center text-muted-foreground hover:text-foreground transition-colors group/item min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 group-hover/item:bg-blue-500/20 transition-colors mr-2 sm:mr-3 flex-shrink-0">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium truncate">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center text-muted-foreground hover:text-foreground transition-colors group/item min-w-0">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10 group-hover/item:bg-green-500/20 transition-colors mr-2 sm:mr-3 flex-shrink-0">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium truncate">{client.phone}</span>
                    </div>
                  )}
                  {(client.addressLine1 || client.city || client.state || client.country) && (
                    <div className="flex items-center text-muted-foreground hover:text-foreground transition-colors group/item min-w-0">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10 group-hover/item:bg-purple-500/20 transition-colors mr-2 sm:mr-3 flex-shrink-0">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium truncate">{[client.addressLine1, client.city, client.state, client.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-gradient">{client._count?.invoices || 0}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Invoices</p>
                </div>
                
                <div className="flex gap-2 sm:gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 hover-lift text-xs sm:text-sm"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">View</span>
                    <span className="xs:hidden">View</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 hover-lift text-xs sm:text-sm"
                    onClick={() => router.push(`/clients/${client.id}/edit`)}
                  >
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Edit</span>
                    <span className="xs:hidden">Edit</span>
                  </Button>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover-lift"
                      onClick={(e) => { e.stopPropagation(); toggleMenu(client.id, e) }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {openMenuId === client.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={closeMenu} />
                        <div
                          className="fixed z-40 w-48 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm text-card-foreground shadow-large animate-scale-in"
                          style={{ top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0 }}
                        >
                          <button
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-primary/5 hover:text-primary transition-all duration-200 rounded-t-xl"
                            onClick={() => { closeMenu(); handleToggleActive(client.id, !!client.isActive) }}
                          >
                            {client.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            {client.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <div className="h-px bg-border/30 mx-2"></div>
                          <button
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200 rounded-b-xl"
                            onClick={() => { closeMenu(); handleDelete(client.id) }}
                          >
                            <Trash2 className="h-4 w-4" /> Delete Client
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="hover-lift animate-fade-in-up overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-8 py-6 text-right text-sm font-bold text-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card/50 backdrop-blur-sm divide-y divide-border/30">
                  {clients.map((client, index) => (
                    <tr key={client.id} className="hover:bg-primary/5 hover:shadow-soft transition-all duration-200 group" style={{animationDelay: `${index * 0.05}s`}}>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar className="h-12 w-12 mr-4 ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all duration-300">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold">
                              {getClientAvatar(client.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{client.name}</p>
                            <p className="text-sm text-muted-foreground">ID: #{client.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{client.email}</p>
                          <p className="text-sm text-muted-foreground">{client.phone || 'No phone number'}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <Badge variant={client.isActive ? 'success' : 'muted'}>
                          {client.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <Badge variant="outline">{formatClientType(client.clientType)}</Badge>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 rounded-lg bg-blue-500/10 mr-3">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gradient">
                              {client._count?.invoices || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(client.createdAt)}
                        </p>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            className="hover-lift"
                            onClick={() => router.push(`/clients/${client.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            className="hover-lift"
                            onClick={() => router.push(`/clients/${client.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <div className="relative">
                            <Button 
                              variant="ghost" 
                              size="icon-sm" 
                              className="hover-lift"
                              onClick={(e) => { e.stopPropagation(); toggleMenu(client.id, e) }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {openMenuId === client.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={closeMenu} />
                                <div
                                  className="fixed z-40 w-48 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm text-card-foreground shadow-large animate-scale-in"
                                  style={{ top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0 }}
                                >
                                  <button
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-primary/5 hover:text-primary transition-all duration-200 rounded-t-xl"
                                    onClick={() => { closeMenu(); handleToggleActive(client.id, !!client.isActive) }}
                                  >
                                    {client.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                    {client.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <div className="h-px bg-border/30 mx-2"></div>
                                  <button
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200 rounded-b-xl"
                                    onClick={() => { closeMenu(); handleDelete(client.id) }}
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete Client
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
