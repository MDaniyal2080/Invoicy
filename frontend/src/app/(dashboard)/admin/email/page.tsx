'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

export default function AdminEmailSettingsPage() {
  const { addNotification, setLoading } = useUIStore()
  const [settings, setSettings] = useState<any | null>(null)
  const [loading, setLocalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testingVerify, setTestingVerify] = useState(false)
  const [testingSend, setTestingSend] = useState(false)
  const [previewType, setPreviewType] = useState<'invoice' | 'payment-reminder' | 'payment-received' | 'password-reset' | 'verify-email' | 'welcome'>('welcome')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLocalLoading(true)
        setLoading(true)
        const s = await apiClient.getSystemSettings()
        if (mounted) setSettings(s)
      } catch (e: any) {
        addNotification({ type: 'error', title: 'Failed to load email settings', message: e?.message })
      } finally {
        setLocalLoading(false)
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [addNotification, setLoading])

  function update<K extends keyof any>(key: any, value: any) {
    setSettings((prev: any) => (prev ? { ...prev, [key]: value } : prev))
  }

  function buildOverrides(): Record<string, any> {
    const s = settings || {}
    const keys = [
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
    ] as const
    const o: Record<string, any> = {}
    keys.forEach((k) => { o[k as any] = s[k as any] })
    return o
  }

  async function handleSave() {
    if (!settings) return
    try {
      setSaving(true)
      setLoading(true)
      const res = await apiClient.updateSystemSettings(settings)
      setSettings(res)
      addNotification({ type: 'success', title: 'Email settings updated' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Update failed', message: e?.message })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleVerifySmtp() {
    try {
      setTestingVerify(true)
      const overrides = buildOverrides()
      const res = await apiClient.testSmtp(overrides)
      if (res?.success) {
        addNotification({ type: 'success', title: 'SMTP connection successful' })
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
      addNotification({ type: 'error', title: 'SMTP verification failed', message: e?.message })
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
      addNotification({ type: 'error', title: 'Failed to send test email', message: e?.message })
    } finally {
      setTestingSend(false)
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
      addNotification({ type: 'error', title: 'Failed to send test invoice email', message: e?.message })
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
      addNotification({ type: 'error', title: 'Failed to load preview', message: e?.message })
    } finally {
      setPreviewLoading(false)
    }
  }

  const isBrevoHost = /brevo|sendinblue|smtp-relay\./i.test(String(settings?.EMAIL_HOST || ''))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Configuration</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Provider configuration, SMTP tests and template preview</p>
        </div>
        <Button onClick={handleSave} disabled={!settings || saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading settings...</p>}

      {settings && (
        <div className="space-y-6">
          {/* Email (SMTP / Providers) */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Email (Provider)</CardTitle>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border">
                  Provider: <b>{String(settings.EMAIL_PROVIDER || 'SMTP')}</b>
                </span>
              </div>
              <CardDescription>
                Configure the outgoing email provider used system-wide.
              </CardDescription>
            </CardHeader>
            <CardContent>
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

              {/* Brevo (API) Options */}
              {settings.EMAIL_PROVIDER === 'BREVO' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <Label htmlFor="BREVO_API_KEY">Brevo API Key</Label>
                    <Input id="BREVO_API_KEY" type="password" value={settings.BREVO_API_KEY || ''} onChange={(e) => update('BREVO_API_KEY', e.target.value)} placeholder="xkeysib_..." />
                    <p className="text-xs text-gray-500 mt-1">Emails will be sent via Brevo REST API. Enter "__SECRET__" to keep the current key unchanged.</p>
                  </div>
                </div>
              )}

              {/* Brevo SMTP helper fields when using SMTP host for Brevo (optional) */}
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
                        <p className="text-xs text-gray-500 mt-1">Used as the SMTP password. Enter "__SECRET__" to keep the existing value unchanged.</p>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" variant="outline" disabled={testingVerify || saving || settings?.EMAIL_PROVIDER !== 'SMTP'} onClick={handleVerifySmtp} title={settings?.EMAIL_PROVIDER !== 'SMTP' ? 'SMTP verification is only available when provider is SMTP' : undefined}>
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
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <iframe title="Email Preview" className="w-full h-[600px] bg-white" srcDoc={preview.html}></iframe>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
