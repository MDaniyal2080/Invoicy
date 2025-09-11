"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Shield, User, Mail, Calendar, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type UserDetails = {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    companyName: string | null
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
    subscriptionPlan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
    subscriptionEnd: string | null
    invoiceLimit: number | null
    emailVerified: boolean
    isActive: boolean
    createdAt: string
    lastLogin: string | null
    _count: { invoices: number; clients: number }
  }
  stats: {
    totalRevenue: number
    paidInvoices: number
    pendingInvoices: number
    totalInvoices: number
    totalClients: number
  }
}

type UpdateForm = {
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  subscriptionPlan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
  subscriptionEnd: string | ''
  invoiceLimit: number
  emailVerified: boolean
  isActive: boolean
}

export default function AdminUserDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { addNotification, setLoading } = useUIStore()

  const userId = (params as any)?.id as string

  const [details, setDetails] = useState<UserDetails | null>(null)
  const [form, setForm] = useState<UpdateForm | null>(null)
  const [loading, setLocalLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let mounted = true
    ;(async () => {
      try {
        setLocalLoading(true)
        setLoading(true)
        const data = await apiClient.getUserDetails(userId)
        if (!mounted) return
        setDetails(data)
        setForm({
          role: data.user.role,
          subscriptionPlan: data.user.subscriptionPlan,
          subscriptionEnd: data.user.subscriptionEnd ? data.user.subscriptionEnd.substring(0, 10) : '',
          invoiceLimit: data.user.invoiceLimit ?? 0,
          emailVerified: data.user.emailVerified,
          isActive: data.user.isActive,
        })
      } catch (e: any) {
        addNotification({ type: 'error', title: 'Failed to load user details', message: e?.message })
      } finally {
        setLocalLoading(false)
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [userId, addNotification, setLoading])

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!form || !userId) return
    try {
      setSaving(true)
      setLoading(true)
      const payload: any = {
        role: form.role,
        subscriptionPlan: form.subscriptionPlan,
        subscriptionEnd: form.subscriptionEnd ? form.subscriptionEnd : undefined,
        invoiceLimit: form.invoiceLimit,
        emailVerified: form.emailVerified,
        isActive: form.isActive,
      }
      await apiClient.updateUser(userId, payload)
      const fresh = await apiClient.getUserDetails(userId)
      setDetails(fresh)
      setForm({
        role: fresh.user.role,
        subscriptionPlan: fresh.user.subscriptionPlan,
        subscriptionEnd: fresh.user.subscriptionEnd ? fresh.user.subscriptionEnd.substring(0, 10) : '',
        invoiceLimit: fresh.user.invoiceLimit ?? 0,
        emailVerified: fresh.user.emailVerified,
        isActive: fresh.user.isActive,
      })
      addNotification({ type: 'success', title: 'User updated' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Update failed', message: e?.message })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleToggleActive() {
    if (!details) return
    try {
      setLocalLoading(true)
      if (details.user.isActive) await apiClient.suspendUser(details.user.id)
      else await apiClient.activateUser(details.user.id)
      const fresh = await apiClient.getUserDetails(details.user.id)
      setDetails(fresh)
      setForm((prev) => prev ? { ...prev, isActive: fresh.user.isActive } : prev)
      addNotification({ type: 'success', title: fresh.user.isActive ? 'User activated' : 'User suspended' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Action failed', message: e?.message })
    } finally {
      setLocalLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!details) return
    const newPassword = prompt(`Enter new password for ${details.user.email} (min 8 chars):`)
    if (!newPassword) return
    if (newPassword.length < 8) {
      addNotification({ type: 'warning', title: 'Password too short', message: 'Minimum 8 characters' })
      return
    }
    try {
      setLocalLoading(true)
      await apiClient.resetUserPassword(details.user.id, newPassword)
      addNotification({ type: 'success', title: 'Password reset successfully' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Reset failed', message: e?.message })
    } finally {
      setLocalLoading(false)
    }
  }

  const displayName = useMemo(() => {
    if (!details) return ''
    return [details.user.firstName, details.user.lastName].filter(Boolean).join(' ') || details.user.email
  }, [details])

  function update<K extends keyof UpdateForm>(key: K, value: UpdateForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white">
                {details ? getInitials(displayName) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Mail className="h-4 w-4" /> {details?.user.email}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!form || saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={handleToggleActive} disabled={!details || loading}>
            {details?.user.isActive ? (<><X className="h-4 w-4 mr-2"/>Suspend</>) : (<><Check className="h-4 w-4 mr-2"/>Activate</>)}
          </Button>
          <Button variant="ghost" onClick={handleResetPassword} disabled={!details || loading}>Reset Password</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading user...</p>}

      {details && form && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Editable form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>User Settings</CardTitle>
                <CardDescription>Edit role, subscription and verification.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(val) => update('role', val as UpdateForm['role'])}
                    >
                      <SelectTrigger id="role" className="mt-2 w-full" aria-label="Role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {['USER','ADMIN','SUPER_ADMIN'].map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subscriptionPlan">Subscription Plan</Label>
                    <Select
                      value={form.subscriptionPlan}
                      onValueChange={(val) => update('subscriptionPlan', val as UpdateForm['subscriptionPlan'])}
                    >
                      <SelectTrigger id="subscriptionPlan" className="mt-2 w-full" aria-label="Subscription Plan">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {['FREE','BASIC','PREMIUM','ENTERPRISE'].map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subscriptionEnd">Subscription End</Label>
                    <Input id="subscriptionEnd" type="date" value={form.subscriptionEnd} onChange={(e) => update('subscriptionEnd', e.target.value)} />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no expiry.</p>
                  </div>
                  <div>
                    <Label htmlFor="invoiceLimit">Invoice Limit</Label>
                    <Input id="invoiceLimit" type="number" value={Number(form.invoiceLimit)} onChange={(e) => update('invoiceLimit', parseInt(e.target.value || '0'))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="emailVerified" type="checkbox" className="h-4 w-4" checked={!!form.emailVerified} onChange={(e) => update('emailVerified', e.target.checked)} />
                    <Label htmlFor="emailVerified">Email Verified</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="isActive" type="checkbox" className="h-4 w-4" checked={!!form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Usage</CardTitle>
                <CardDescription>Key user metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Invoices</p>
                    <p className="text-lg font-semibold">{details.stats.totalInvoices}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Clients</p>
                    <p className="text-lg font-semibold">{details.stats.totalClients}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Paid invoices</p>
                    <p className="text-lg font-semibold">{details.stats.paidInvoices}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pending invoices</p>
                    <p className="text-lg font-semibold">{details.stats.pendingInvoices}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Total revenue</p>
                    <p className="text-lg font-semibold">{formatCurrency(details.stats.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Account status and role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <Badge variant={details.user.role === 'SUPER_ADMIN' ? 'warning' : details.user.role === 'ADMIN' ? 'default' : 'outline'}>
                      {details.user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <Badge variant={details.user.isActive ? 'success' : 'secondary'}>
                      {details.user.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar className="h-4 w-4" /> Joined {formatDate(details.user.createdAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
