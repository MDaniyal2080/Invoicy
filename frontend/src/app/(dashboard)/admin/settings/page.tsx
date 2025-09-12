"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings as SettingsIcon, ArrowLeft, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

type SystemSettings = {
  companyName: string
  companyEmail: string
  companyPhone: string
  companyAddress: string
  defaultCurrency: string
  defaultTaxRate: number
  defaultPaymentTerms: number
  emailNotifications: boolean
  autoBackup: boolean
  maintenanceMode: boolean
  APP_URL: string
  // Email (SMTP)
  EMAIL_HOST: string
  EMAIL_PORT: number
  EMAIL_SECURE: boolean
  EMAIL_USER: string
  EMAIL_PASSWORD: string
  EMAIL_FROM: string
  EMAIL_PROVIDER: 'SMTP' | 'SENDGRID' | 'BREVO'
  SENDGRID_API_KEY: string
  BREVO_API_KEY: string
  EMAIL_TRACK_OPENS: boolean
  EMAIL_TRACK_CLICKS: boolean
  EMAIL_CONNECTION_TIMEOUT_MS: number
  EMAIL_GREETING_TIMEOUT_MS: number
  EMAIL_SOCKET_TIMEOUT_MS: number
  // Stripe (Payments)
  STRIPE_PUBLISHABLE_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_BASIC: string
  STRIPE_PRICE_PREMIUM: string
  STRIPE_PLATFORM_FEE_BPS: number
}

export default function AdminSystemSettingsPage() {
  const router = useRouter()
  const { addNotification, setLoading } = useUIStore()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLocalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testingVerify, setTestingVerify] = useState(false)
  const [testingSend, setTestingSend] = useState(false)
  const [previewType, setPreviewType] = useState<'invoice' | 'payment-reminder' | 'payment-received' | 'password-reset' | 'verify-email' | 'welcome'>('welcome')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // Backup / Maintenance state
  const [backupStatus, setBackupStatus] = useState<{ lastBackupAt: string | null; lastBackupId: string | null; lastBackupFile: string | null; maintenanceMode: boolean } | null>(null)
  const [runningBackup, setRunningBackup] = useState(false)

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

  // Load backup status
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = await apiClient.adminGetBackupStatus()
        if (mounted) setBackupStatus(status)
      } catch (e: any) {
        addNotification({ type: 'warning', title: 'Could not load backup status', message: e?.message })
      }
    })()
    return () => { mounted = false }
  }, [addNotification])

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
      addNotification({ type: 'error', title: 'Update failed', message: errorMessage(e) })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  function update<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function buildOverrides(): Record<string, any> {
    if (!settings) return {}
    const keys: (keyof SystemSettings)[] = [
      'EMAIL_PROVIDER',
      'SENDGRID_API_KEY',
      'BREVO_API_KEY',
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
    ]
    const o: Record<string, any> = {}
    keys.forEach((k) => {
      o[k] = (settings as any)[k]
    })
    return o
  }

  // Extract readable error message from Axios/Nest responses
  function errorMessage(e: any): string {
    const m = (e?.response?.data?.message ?? e?.message ?? 'Unknown error') as any
    return Array.isArray(m) ? m.join(', ') : String(m)
  }

  async function handleRunBackup() {
    try {
      setRunningBackup(true)
      const res = await apiClient.adminRunBackup()
      addNotification({ type: 'success', title: 'Backup started', message: `Backup ${res.backupId} created` })
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
      } catch {}
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Backup failed', message: errorMessage(e) })
    } finally {
      setRunningBackup(false)
    }
  }

  async function handleMaintenanceChange(enabled: boolean) {
    // Optimistically update local settings checkbox
    setSettings((prev) => (prev ? { ...prev, maintenanceMode: enabled } : prev))
    try {
      const res = await apiClient.adminSetMaintenance(enabled)
      addNotification({ type: 'success', title: 'Maintenance updated', message: res.maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled' })
      // Sync backup status and maintenance flag from server
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
      } catch {}
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Failed to update maintenance', message: errorMessage(e) })
      // Revert on failure
      setSettings((prev) => (prev ? { ...prev, maintenanceMode: !enabled } : prev))
    }
  }

  async function handleSendTestInvoiceEmail() {
    try {
      if (!testTo.trim()) {
        addNotification({ type: 'error', title: 'Enter recipient email', message: 'Please provide a test recipient email' })
        return
      }
      setTestingSend(true)
      const overrides = buildOverrides()
      const res = await apiClient.sendTestInvoiceEmail(testTo.trim(), overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'Test invoice email sent', message: `Message ID: ${res.messageId || 'N/A'}` })
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings)
            setSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: any) {
            addNotification({ type: 'warning', title: 'Auto-save failed', message: e?.message })
          }
        }
      }
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Failed to send test invoice email', message: errorMessage(e) })
    } finally {
      setTestingSend(false)
    }
  }

  async function handleVerifySmtp() {
    try {
      setTestingVerify(true)
      const overrides = buildOverrides()
      const res = await apiClient.testSmtp(overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'SMTP connection successful' })
        // Auto-save settings on success
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings)
            setSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: any) {
            addNotification({ type: 'warning', title: 'Auto-save failed', message: e?.message })
          }
        }
      } else {
        addNotification({ type: 'error', title: 'SMTP verification failed', message: res?.error || 'Unknown error' })
      }
    } catch (e: any) {
      addNotification({ type: 'error', title: 'SMTP verification failed', message: errorMessage(e) })
    } finally {
      setTestingVerify(false)
    }
  }

  async function handleSendTestEmail() {
    try {
      if (!testTo.trim()) {
        addNotification({ type: 'error', title: 'Enter recipient email', message: 'Please provide a test recipient email' })
        return
      }
      setTestingSend(true)
      const overrides = buildOverrides()
      const res = await apiClient.sendTestEmail(testTo.trim(), overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'Test email sent', message: `Message ID: ${res.messageId || 'N/A'}` })
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings)
            setSettings(saved)
            addNotification({ type: 'success', title: 'Email settings saved' })
          } catch (e: any) {
            addNotification({ type: 'warning', title: 'Auto-save failed', message: e?.message })
          }
        }
      }
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Failed to send test email', message: errorMessage(e) })
    } finally {
      setTestingSend(false)
    }
  }

  async function handlePreviewEmail() {
    try {
      setPreviewLoading(true)
      const res = await apiClient.previewEmailTemplate(previewType)
      setPreview(res)
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Failed to load preview', message: errorMessage(e) })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Derived flag: when SMTP Host is Brevo/Sendinblue, UI shows API key field and locks username to 'apikey'
  const isBrevoHost = /brevo|sendinblue|smtp-relay\./i.test(String(settings?.EMAIL_HOST || ''))

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="h-7 w-7 text-indigo-600" /> System Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage global platform defaults and preferences</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={!settings || saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Loading settings...</p>
      )}

      {settings && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Company</CardTitle>
              <CardDescription>Basic company information displayed in invoices and communications.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" value={settings.companyName || ''} onChange={(e) => update('companyName', e.target.value)} placeholder="Invoicy" />
                </div>
                <div>
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input id="companyEmail" type="email" value={settings.companyEmail || ''} onChange={(e) => update('companyEmail', e.target.value)} placeholder="admin@invoicy.com" />
                </div>
                <div>
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input id="companyPhone" value={settings.companyPhone || ''} onChange={(e) => update('companyPhone', e.target.value)} placeholder="+1 555-123-4567" />
                </div>
                <div>
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Input id="companyAddress" value={settings.companyAddress || ''} onChange={(e) => update('companyAddress', e.target.value)} placeholder="123 Main St, City, Country" />
                </div>
              </div>
            </CardContent>
          </Card>
          
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
                    onChange={(e) => update('APP_URL', e.target.value as any)}
                    placeholder="https://app.yourdomain.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Include protocol (https://). Do not include a trailing path.</p>
                </div>
              </div>
            </CardContent>
          </Card>

      {/* Payments (Stripe) */}
      {settings && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payments (Stripe)</CardTitle>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border">
                Mode: <b>{(settings.STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_live_') ? 'Live' : 'Test'}</b>
              </span>
            </div>
            <CardDescription>
              Configure Stripe for platform subscription billing and user payouts via Connect.
              Enter your publishable and secret keys, webhook secret, and subscription price IDs.
            </CardDescription>
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
                <p className="text-xs text-gray-500 mt-1">Configure your Stripe webhook to POST to <code className="font-mono">/api/webhooks/stripe</code>.</p>
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
                <p className="text-xs text-gray-500 mt-1">Example: 250 = 2.5% fee on invoice payments collected via Connect.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <CardDescription>Email notifications, backups and maintenance mode.</CardDescription>
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
                <div className="flex items-center gap-3">
                  <input id="maintenanceMode" type="checkbox" className="h-4 w-4" checked={!!settings.maintenanceMode} onChange={(e) => handleMaintenanceChange(e.target.checked)} />
                  <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backups */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Backups</CardTitle>
              <CardDescription>Trigger a manual backup and view the most recent backup metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <div>Last backup: <span className="font-medium">{backupStatus?.lastBackupAt ? new Date(backupStatus.lastBackupAt).toLocaleString() : '—'}</span></div>
                  <div>Backup ID: <span className="font-mono">{backupStatus?.lastBackupId || '—'}</span></div>
                  <div>File: <span className="font-mono">{backupStatus?.lastBackupFile || '—'}</span></div>
                  <div>Maintenance: <span className="font-medium">{backupStatus?.maintenanceMode ? 'Enabled' : 'Disabled'}</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" onClick={handleRunBackup} disabled={runningBackup}>
                    {runningBackup ? 'Running…' : 'Run Backup Now'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email (SMTP) */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Email (SMTP)</CardTitle>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border">
                  Provider: <b>{String(settings.EMAIL_PROVIDER || 'SMTP')}</b>
                </span>
              </div>
              <CardDescription>
                Configure the outgoing email server used system-wide for verification, invoices, reminders, and other notifications.
                All emails are sent via this global provider. Client-facing emails will use the sender name
                <span className="font-medium"> "[User Company] via Invoicy"</span> and set <span className="font-medium">Reply-To</span> to the user's
                company email so that replies go directly to them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="EMAIL_PROVIDER">Email Provider</Label>
                  <Select value={(settings.EMAIL_PROVIDER || 'SMTP') as any} onValueChange={(val) => update('EMAIL_PROVIDER', val as any)}>
                    <SelectTrigger id="EMAIL_PROVIDER" className="mt-2 w-full" aria-label="Email Provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMTP">SMTP</SelectItem>
                      <SelectItem value="SENDGRID">SendGrid</SelectItem>
                      <SelectItem value="BREVO">Brevo (API)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="EMAIL_FROM">From Email</Label>
                  <Input id="EMAIL_FROM" type="email" value={settings.EMAIL_FROM || ''} onChange={(e) => update('EMAIL_FROM', e.target.value)} placeholder="noreply@invoicy.com" />
                  <p className="text-xs text-gray-500 mt-1">Envelope From address used by the provider. The visible From name is customized per email (e.g., "Acme Co via Invoicy"), and replies go to the user’s company email.</p>
                </div>
              </div>

              {/* SendGrid Options */}
              {settings.EMAIL_PROVIDER === 'SENDGRID' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <Label htmlFor="SENDGRID_API_KEY">SendGrid API Key</Label>
                    <Input id="SENDGRID_API_KEY" type="password" value={settings.SENDGRID_API_KEY || ''} onChange={(e) => update('SENDGRID_API_KEY', e.target.value)} placeholder="SG.xxxxxx" />
                    <p className="text-xs text-gray-500 mt-1">Use the masked value "__SECRET__" to keep the existing key unchanged.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                      <input id="EMAIL_TRACK_OPENS" type="checkbox" className="h-4 w-4" checked={!!settings.EMAIL_TRACK_OPENS} onChange={(e) => update('EMAIL_TRACK_OPENS', e.target.checked)} />
                      <Label htmlFor="EMAIL_TRACK_OPENS">Track Opens</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input id="EMAIL_TRACK_CLICKS" type="checkbox" className="h-4 w-4" checked={!!settings.EMAIL_TRACK_CLICKS} onChange={(e) => update('EMAIL_TRACK_CLICKS', e.target.checked)} />
                      <Label htmlFor="EMAIL_TRACK_CLICKS">Track Clicks</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Brevo API Options */}
              {settings.EMAIL_PROVIDER === 'BREVO' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <Label htmlFor="BREVO_API_KEY">Brevo API Key</Label>
                    <Input id="BREVO_API_KEY" type="password" value={settings.BREVO_API_KEY || ''} onChange={(e) => update('BREVO_API_KEY', e.target.value)} placeholder="xkeysib_..." />
                    <p className="text-xs text-gray-500 mt-1">Emails will be sent via Brevo REST API over HTTPS (port 443). Enter "__SECRET__" to keep the current key unchanged.</p>
                  </div>
                </div>
              )}

              {/* SMTP Options */}
              {settings.EMAIL_PROVIDER === 'SMTP' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <Label htmlFor="EMAIL_HOST">SMTP Host</Label>
                    <Input id="EMAIL_HOST" value={settings.EMAIL_HOST || ''} onChange={(e) => update('EMAIL_HOST', e.target.value)} placeholder="smtp-relay.brevo.com" />
                  </div>
                  <div>
                    <Label htmlFor="EMAIL_PORT">SMTP Port</Label>
                    <Input id="EMAIL_PORT" type="number" step="1" value={Number(settings.EMAIL_PORT ?? 587)} onChange={(e) => update('EMAIL_PORT', parseInt(e.target.value || '0'))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="EMAIL_SECURE" type="checkbox" className="h-4 w-4" checked={!!settings.EMAIL_SECURE} onChange={(e) => update('EMAIL_SECURE', e.target.checked)} />
                    <Label htmlFor="EMAIL_SECURE">Use TLS/SSL (secure)</Label>
                  </div>
                  {isBrevoHost ? (
                    <>
                      <div>
                        <Label htmlFor="EMAIL_USER">Username</Label>
                        <Input id="EMAIL_USER" value={settings.EMAIL_USER || ''} onChange={(e) => update('EMAIL_USER', e.target.value)} placeholder="apikey or your@email" />
                        <p className="text-xs text-gray-500 mt-1">Brevo SMTP usually accepts username <code className="font-mono">apikey</code> or your account email.</p>
                      </div>
                      <div>
                        <Label htmlFor="BREVO_API_KEY">Brevo API Key</Label>
                        <Input id="BREVO_API_KEY" type="password" value={settings.BREVO_API_KEY || ''} onChange={(e) => update('BREVO_API_KEY', e.target.value)} placeholder="xkeysib_..." />
                        <p className="text-xs text-gray-500 mt-1">Used as the SMTP password. Enter "__SECRET__" to keep the current value unchanged.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="EMAIL_USER">Username</Label>
                        <Input id="EMAIL_USER" value={settings.EMAIL_USER || ''} onChange={(e) => update('EMAIL_USER', e.target.value)} placeholder="your@email.com" />
                      </div>
                      <div>
                        <Label htmlFor="EMAIL_PASSWORD">Password</Label>
                        <Input id="EMAIL_PASSWORD" type="password" value={settings.EMAIL_PASSWORD || ''} onChange={(e) => update('EMAIL_PASSWORD', e.target.value)} placeholder="SMTP password" />
                        <p className="text-xs text-gray-500 mt-1">Enter "__SECRET__" to keep the existing value unchanged.</p>
                      </div>
                    </>
                  )}
                  <div>
                    <Label htmlFor="EMAIL_CONNECTION_TIMEOUT_MS">Connection Timeout (ms)</Label>
                    <Input id="EMAIL_CONNECTION_TIMEOUT_MS" type="number" step="1" value={Number(settings.EMAIL_CONNECTION_TIMEOUT_MS ?? 10000)} onChange={(e) => update('EMAIL_CONNECTION_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                  </div>
                  <div>
                    <Label htmlFor="EMAIL_GREETING_TIMEOUT_MS">Greeting Timeout (ms)</Label>
                    <Input id="EMAIL_GREETING_TIMEOUT_MS" type="number" step="1" value={Number(settings.EMAIL_GREETING_TIMEOUT_MS ?? 10000)} onChange={(e) => update('EMAIL_GREETING_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                  </div>
                  <div>
                    <Label htmlFor="EMAIL_SOCKET_TIMEOUT_MS">Socket Timeout (ms)</Label>
                    <Input id="EMAIL_SOCKET_TIMEOUT_MS" type="number" step="1" value={Number(settings.EMAIL_SOCKET_TIMEOUT_MS ?? 20000)} onChange={(e) => update('EMAIL_SOCKET_TIMEOUT_MS', parseInt(e.target.value || '0'))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test SMTP */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Test SMTP</CardTitle>
              <CardDescription>Verify connection or send a test email without saving changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2">
                  <Label htmlFor="TEST_TO">Test Recipient Email</Label>
                  <Input id="TEST_TO" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testingVerify || saving || settings?.EMAIL_PROVIDER !== 'SMTP'}
                    onClick={handleVerifySmtp}
                    title={settings?.EMAIL_PROVIDER !== 'SMTP' ? 'SMTP verification is only available when provider is SMTP' : undefined}
                  >
                    {testingVerify ? 'Verifying…' : 'Test SMTP Connection'}
                  </Button>
                  <Button type="button" disabled={testingSend || saving} onClick={handleSendTestEmail}>
                    {testingSend ? 'Sending…' : 'Send Test Email'}
                  </Button>
                  <Button type="button" disabled={testingSend || saving} onClick={handleSendTestInvoiceEmail}>
                    {testingSend ? 'Sending…' : 'Send Test Invoice Email'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
              <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}

      {/* Email Template Preview */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Email Template Preview</CardTitle>
          <CardDescription>Preview built-in email templates without sending.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <Label htmlFor="PREVIEW_TYPE">Template</Label>
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
              <Button type="button" onClick={handlePreviewEmail} disabled={previewLoading}>
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
  )
}
