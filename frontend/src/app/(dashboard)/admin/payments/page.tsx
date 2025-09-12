'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

export default function AdminPaymentConfigPage() {
  const { addNotification, setLoading } = useUIStore()
  const [settings, setSettings] = useState<any | null>(null)
  const [loading, setLocalLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLocalLoading(true)
        setLoading(true)
        const s = await apiClient.getSystemSettings()
        if (mounted) setSettings(s)
      } catch (e: any) {
        addNotification({ type: 'error', title: 'Failed to load Stripe settings', message: e?.message })
      } finally {
        setLocalLoading(false)
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [addNotification, setLoading])

  function update(key: string, value: any) {
    setSettings((prev: any) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!settings) return
    try {
      setSaving(true)
      setLoading(true)
      const res = await apiClient.updateSystemSettings(settings)
      setSettings(res)
      addNotification({ type: 'success', title: 'Stripe settings updated' })
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment Configuration</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure Stripe keys and plan pricing</p>
        </div>
        <Button onClick={handleSave} disabled={!settings || saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading settings...</p>}

      {settings && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Payments (Stripe)</CardTitle>
            <CardDescription>Platform subscription billing and payouts via Connect.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="STRIPE_PUBLISHABLE_KEY">Publishable Key</Label>
                <Input id="STRIPE_PUBLISHABLE_KEY" value={settings.STRIPE_PUBLISHABLE_KEY || ''} onChange={(e) => update('STRIPE_PUBLISHABLE_KEY', e.target.value)} placeholder="pk_test_..." />
              </div>
              <div>
                <Label htmlFor="STRIPE_SECRET_KEY">Secret Key</Label>
                <Input id="STRIPE_SECRET_KEY" type="password" value={settings.STRIPE_SECRET_KEY || ''} onChange={(e) => update('STRIPE_SECRET_KEY', e.target.value)} placeholder="sk_test_... (use __SECRET__ to keep current)" />
              </div>
              <div>
                <Label htmlFor="STRIPE_WEBHOOK_SECRET">Webhook Secret</Label>
                <Input id="STRIPE_WEBHOOK_SECRET" type="password" value={settings.STRIPE_WEBHOOK_SECRET || ''} onChange={(e) => update('STRIPE_WEBHOOK_SECRET', e.target.value)} placeholder="whsec_... (use __SECRET__ to keep current)" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="STRIPE_PRICE_BASIC">Price ID (Basic)</Label>
                  <Input id="STRIPE_PRICE_BASIC" value={settings.STRIPE_PRICE_BASIC || ''} onChange={(e) => update('STRIPE_PRICE_BASIC', e.target.value)} placeholder="price_..." />
                </div>
                <div>
                  <Label htmlFor="STRIPE_PRICE_PREMIUM">Price ID (Premium)</Label>
                  <Input id="STRIPE_PRICE_PREMIUM" value={settings.STRIPE_PRICE_PREMIUM || ''} onChange={(e) => update('STRIPE_PRICE_PREMIUM', e.target.value)} placeholder="price_..." />
                </div>
              </div>
              <div>
                <Label htmlFor="STRIPE_PLATFORM_FEE_BPS">Platform Fee (basis points)</Label>
                <Input id="STRIPE_PLATFORM_FEE_BPS" type="number" step="1" value={Number(settings.STRIPE_PLATFORM_FEE_BPS ?? 0)} onChange={(e) => update('STRIPE_PLATFORM_FEE_BPS', parseInt(e.target.value || '0'))} />
                <p className="text-xs text-gray-500 mt-1">Example: 250 = 2.5% fee.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
