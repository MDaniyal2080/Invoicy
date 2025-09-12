'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

export default function AdminGeneralSettingsPage() {
  const { addNotification, setLoading } = useUIStore()
  const [settings, setSettings] = useState<Record<string, any> | null>(null)
  const [loading, setLocalLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLocalLoading(true)
        setLoading(true)
        const data = await apiClient.getSystemSettings()
        if (mounted) setSettings(data)
      } catch (e: any) {
        addNotification({ type: 'error', title: 'Failed to load system settings', message: e?.message })
      } finally {
        setLocalLoading(false)
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [addNotification, setLoading])

  function update<K extends string>(key: K, value: any) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    try {
      setSaving(true)
      setLoading(true)
      const res = await apiClient.updateSystemSettings(settings)
      setSettings(res)
      addNotification({ type: 'success', title: 'Settings updated' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Update failed', message: e?.message })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">General Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Application base URL, defaults and preferences</p>
        </div>
        <Button onClick={handleSubmit} disabled={!settings || saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading settings...</p>}

      {settings && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Application */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Application</CardTitle>
              <CardDescription>Base URL used in email links and redirects.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="APP_URL">App Base URL</Label>
                  <Input
                    id="APP_URL"
                    value={(settings as any).APP_URL || ''}
                    onChange={(e) => update('APP_URL', e.target.value)}
                    placeholder="https://app.yourdomain.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Include protocol (https://). Do not include a trailing path.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Defaults */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
              <CardDescription>Default currency, tax rate, and payment terms used across the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="defaultCurrency">Default Currency</Label>
                  <Select
                    value={settings.defaultCurrency || 'USD'}
                    onValueChange={(val) => update('defaultCurrency', val)}
                  >
                    <SelectTrigger id="defaultCurrency" className="mt-2 w-full" aria-label="Default Currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['USD','EUR','GBP','INR','JPY','CNY','AUD','CAD'].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
                  <Input id="defaultTaxRate" type="number" step="0.01" value={Number(settings.defaultTaxRate ?? 0)} onChange={(e) => update('defaultTaxRate', parseFloat(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="defaultPaymentTerms">Payment Terms (days)</Label>
                  <Input id="defaultPaymentTerms" type="number" step="1" value={Number(settings.defaultPaymentTerms ?? 30)} onChange={(e) => update('defaultPaymentTerms', parseInt(e.target.value || '0'))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Email notifications and backups.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <input id="emailNotifications" type="checkbox" className="h-4 w-4" checked={!!settings.emailNotifications} onChange={(e) => update('emailNotifications', e.target.checked)} />
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                </div>
                <div className="flex items-center gap-3">
                  <input id="autoBackup" type="checkbox" className="h-4 w-4" checked={!!settings.autoBackup} onChange={(e) => update('autoBackup', e.target.checked)} />
                  <Label htmlFor="autoBackup">Automatic Backups</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
