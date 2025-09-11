'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Plus, Trash2, Calculator, XCircle, ExternalLink, Share2, RefreshCcw, Link2, Link2Off } from 'lucide-react'
import { useInvoiceStore, type DiscountType } from '@/lib/stores/invoice-store'
import apiClient from '@/lib/api-client'
import { useRecurringInvoiceStore } from '@/lib/stores/recurring-invoice-store'
import type { RecurrenceFrequency } from '@/types/recurring-invoice'
import { getErrorMessage } from '@/lib/utils'

type InvoiceItemForm = {
  id: number
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceFormState {
  issueDate: string
  dueDate: string
  clientId: string
  clientName: string
  clientEmail: string
  clientAddress: string
  items: InvoiceItemForm[]
  notes: string
  terms: string
  subtotal: number
  tax: number
  total: number
  taxRate: number
  discount: number
  discountType: DiscountType
}

type RecurringFields = {
  frequency: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string
  maxOccurrences?: number
  dueInDays?: number
  autoSend: boolean
}

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || ''

  const { isLoading, currentInvoice, getInvoice, updateInvoice } = useInvoiceStore()
  const { createRecurringInvoice, runNowRecurringInvoice } = useRecurringInvoiceStore()

  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurring, setRecurring] = useState<RecurringFields>({
    frequency: 'MONTHLY',
    interval: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxOccurrences: undefined,
    dueInDays: 30,
    autoSend: false,
  })
  const [currency, setCurrency] = useState<string>('USD')
  const [invoiceData, setInvoiceData] = useState<InvoiceFormState>({
    issueDate: '',
    dueDate: '',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    items: [
      { id: 1, description: '', quantity: 1, rate: 0, amount: 0 }
    ],
    notes: '',
    terms: 'Payment is due within 30 days',
    subtotal: 0,
    tax: 0,
    total: 0,
    taxRate: 0,
    discount: 0,
    discountType: 'FIXED',
  })

  const toDateInputValue = (d?: string | Date) => {
    if (!d) return ''
    try {
      return new Date(d).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  useEffect(() => {
    if (!id) return
    getInvoice(id).catch(() => {
      router.push('/invoices')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let mounted = true
    apiClient
      .getClients()
      .then((list) => { if (mounted) setClients(list || []) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const addrPart = (s?: string) => (s && s.trim()) ? s.trim() : ''

  useEffect(() => {
    if (!currentInvoice) return
    let mounted = true

    const rawItems = Array.isArray((currentInvoice as unknown as Record<string, unknown>).items)
      ? ((currentInvoice as unknown as { items: Array<Record<string, unknown>> }).items)
      : []
    const mappedItems: InvoiceItemForm[] = rawItems.map((it, idx) => {
      const qty = typeof it.quantity === 'number' ? (it.quantity as number) : 1
      const rate = typeof it.rate === 'number' ? (it.rate as number) : 0
      return {
        id: idx + 1,
        description: typeof it.description === 'string' ? (it.description as string) : '',
        quantity: qty,
        rate,
        amount: qty * rate,
      }
    })

    const clientName = currentInvoice.client?.name || ''
    const clientEmail = currentInvoice.client?.email || ''

    const itemsForTotals = mappedItems.length ? mappedItems : [{ id: 1, description: '', quantity: 1, rate: 0, amount: 0 }]
    const { subtotal, tax, total } = computeTotals(
      itemsForTotals,
      currentInvoice.taxRate || 0,
      currentInvoice.discount || 0,
      (currentInvoice.discountType as DiscountType) || 'FIXED'
    )

    setInvoiceData({
      issueDate: toDateInputValue(currentInvoice.invoiceDate),
      dueDate: toDateInputValue(currentInvoice.dueDate),
      clientId: currentInvoice.clientId || '',
      clientName,
      clientEmail,
      clientAddress: '',
      items: itemsForTotals,
      notes: currentInvoice.notes || '',
      terms: currentInvoice.terms || 'Payment is due within 30 days',
      subtotal,
      tax,
      total,
      taxRate: currentInvoice.taxRate || 0,
      discount: currentInvoice.discount || 0,
      discountType: (currentInvoice.discountType as DiscountType) || 'FIXED',
    })

    // Auto-reflect recurring status for invoices generated from schedules (robust detection)
    try {
      const obj = currentInvoice as unknown as Record<string, unknown>
      const history = Array.isArray(obj.history) ? (obj.history as Array<Record<string, unknown>>) : []
      const createdViaHistory = history.some((h) => typeof h?.description === 'string' && String(h.description).includes('created from recurring template'))
      const derivedRecurring = Boolean(
        obj.generatedFromRecurring || obj.recurringScheduleId || obj.recurringId || createdViaHistory
      )
      setIsRecurring(derivedRecurring)
    } catch {}

    // Load full client to populate flattened address fields
    const loadClient = async () => {
      try {
        const cid = currentInvoice.clientId
        if (!cid) return
        const c = await apiClient.getClient(cid)
        if (!mounted) return
        const addr = [
          addrPart(c.addressLine1),
          addrPart(c.addressLine2),
          addrPart(c.city),
          addrPart(c.state),
          addrPart(c.postalCode),
          addrPart(c.country),
        ]
          .filter(Boolean)
          .join(', ')
        setInvoiceData(prev => ({
          ...prev,
          clientName: c?.name || prev.clientName,
          clientEmail: c?.email || prev.clientEmail,
          clientAddress: addr || prev.clientAddress,
        }))
      } catch {
        // ignore client load errors
      }
    }
    loadClient()

    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInvoice])

  // Fallback initialize currency from user settings or system default if invoice has no currency
  useEffect(() => {
    if (currentInvoice && typeof (currentInvoice as unknown as Record<string, unknown>)?.currency === 'string') return
    let mounted = true
    ;(async () => {
      try {
        const settings = await apiClient.getUserSettings()
        if (mounted && settings?.currency) {
          setCurrency(String(settings.currency))
          return
        }
      } catch {}
      try {
        const cfg = await apiClient.getPublicConfig()
        if (mounted && cfg?.defaultCurrency) setCurrency(cfg.defaultCurrency)
      } catch {}
    })()
    return () => { mounted = false }
  }, [currentInvoice])

  const computeTotals = (
    items: { amount: number }[],
    taxRate: number,
    discount: number,
    discountType: DiscountType
  ) => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const tax = subtotal * ((taxRate || 0) / 100)
    const discountAmt = discountType === 'PERCENTAGE' ? subtotal * ((discount || 0) / 100) : (discount || 0)
    const total = subtotal + tax - discountAmt
    return { subtotal, tax, total }
  }

  useEffect(() => {
    const { subtotal, tax, total } = computeTotals(
      invoiceData.items,
      invoiceData.taxRate,
      invoiceData.discount,
      invoiceData.discountType
    )
    setInvoiceData((prev) => ({ ...prev, subtotal, tax, total }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData.taxRate, invoiceData.discount, invoiceData.discountType])

  const handleClientChange = async (value: string) => {
    setInvoiceData((prev) => ({ ...prev, clientId: value }))
    if (!value) return
    try {
      const c = await apiClient.getClient(value)
      const addr = [
        addrPart(c.addressLine1),
        addrPart(c.addressLine2),
        addrPart(c.city),
        addrPart(c.state),
        addrPart(c.postalCode),
        addrPart(c.country),
      ]
        .filter(Boolean)
        .join(', ')
      setInvoiceData((prev) => ({
        ...prev,
        clientId: value,
        clientName: c?.name || prev.clientName,
        clientEmail: c?.email || prev.clientEmail,
        clientAddress: addr || prev.clientAddress,
      }))
    } catch {
      // ignore autofill errors
    }
  }

  const addItem = () => {
    const newItem = {
      id: invoiceData.items.length + 1,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, newItem]
    })
  }

  const removeItem = (id: number) => {
    const updatedItems = invoiceData.items.filter(item => item.id !== id)
    const { subtotal, tax, total } = computeTotals(
      updatedItems,
      invoiceData.taxRate,
      invoiceData.discount,
      invoiceData.discountType
    )
    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
      subtotal,
      tax,
      total,
    })
  }

  const updateItem = (id: number, field: keyof InvoiceItemForm | 'description', value: string | number) => {
    const updatedItems = invoiceData.items.map(item => {
      if (item.id === id) {
        const updatedItem: InvoiceItemForm = { ...item }
        if (field === 'description') {
          updatedItem.description = String(value)
        } else if (field === 'quantity') {
          const q = Number(value) || 0
          updatedItem.quantity = q
          updatedItem.amount = q * Number(updatedItem.rate)
        } else if (field === 'rate') {
          const r = Number(value) || 0
          updatedItem.rate = r
          updatedItem.amount = Number(updatedItem.quantity) * r
        } else if (field === 'amount') {
          updatedItem.amount = Number(value) || 0
        }
        return updatedItem
      }
      return item
    })

    const { subtotal, tax, total } = computeTotals(
      updatedItems,
      invoiceData.taxRate,
      invoiceData.discount,
      invoiceData.discountType
    )

    setInvoiceData({
      ...invoiceData,
      items: updatedItems,
      subtotal,
      tax,
      total
    })
  }

  const validateInvoice = () => {
    if (!invoiceData.clientId) {
      toast.error('Please select a client')
      return false
    }
    if (new Date(invoiceData.issueDate) > new Date(invoiceData.dueDate)) {
      toast.error('Due date must be after issue date')
      return false
    }
    const validItems = invoiceData.items.filter(it => it.description.trim() && it.quantity > 0 && it.rate >= 0)
    if (validItems.length === 0) {
      toast.error('Add at least one valid item')
      return false
    }
    return true
  }

  const validateRecurringForm = () => {
    if (!invoiceData.clientId) { toast.error('Please select a client'); return false }
    const validItems = invoiceData.items.filter(it => it.description.trim() && it.quantity > 0 && it.rate >= 0)
    if (validItems.length === 0) { toast.error('Add at least one valid item'); return false }
    if (!(recurring.interval >= 1)) { toast.error('Interval must be at least 1'); return false }
    if (!recurring.frequency) { toast.error('Select a frequency'); return false }
    if (!recurring.startDate) { toast.error('Select a start date'); return false }
    if (recurring.endDate && new Date(recurring.endDate) < new Date(recurring.startDate)) {
      toast.error('End date must be on or after start date')
      return false
    }
    if (typeof recurring.maxOccurrences !== 'undefined' && recurring.maxOccurrences < 1) {
      toast.error('Max occurrences must be at least 1')
      return false
    }
    return true
  }

  const handleSave = () => {
    if (!validateInvoice()) return
    setIsSubmitting(true)
    const payload = {
      clientId: invoiceData.clientId,
      invoiceDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      items: invoiceData.items.map((it) => ({ description: it.description, quantity: it.quantity, rate: it.rate })),
      taxRate: invoiceData.taxRate,
      discount: invoiceData.discount,
      discountType: invoiceData.discountType,
      currency,
      notes: invoiceData.notes,
      terms: invoiceData.terms,
    }
    updateInvoice(id, payload)
      .then(() => {
        router.push(`/invoices/${id}`)
      })
      .catch(() => {})
      .finally(() => setIsSubmitting(false))
  }

  const handleCreateSchedule = async () => {
    if (!validateRecurringForm()) return
    setIsSubmitting(true)
    try {
      const payload = {
        clientId: invoiceData.clientId,
        items: invoiceData.items.map((it) => ({ description: it.description, quantity: it.quantity, rate: it.rate })),
        taxRate: invoiceData.taxRate,
        discount: invoiceData.discount,
        discountType: invoiceData.discountType,
        currency,
        notes: invoiceData.notes,
        terms: invoiceData.terms,
        dueInDays: recurring.dueInDays,
        frequency: recurring.frequency as RecurrenceFrequency,
        interval: recurring.interval,
        startDate: recurring.startDate,
        endDate: recurring.endDate ? recurring.endDate : undefined,
        maxOccurrences: recurring.maxOccurrences,
        autoSend: recurring.autoSend,
      }
      const created = await createRecurringInvoice(payload)
      // If the start date is today or earlier, generate the first invoice immediately
      try {
        const start = new Date(recurring.startDate)
        const today = new Date()
        start.setHours(0,0,0,0)
        today.setHours(0,0,0,0)
        if (start.getTime() <= today.getTime()) {
          await runNowRecurringInvoice(created.id)
          toast.success('First invoice generated from schedule')
        } else {
          toast.info('Schedule created. First invoice will generate on the start date')
        }
      } catch (e: unknown) {
        toast.error(getErrorMessage(e, 'Schedule created, but failed to generate the first invoice automatically'))
      }
      router.push('/invoices')
    } catch (err: unknown) {
      // rely on store-based notifications
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !currentInvoice) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }
  if (!currentInvoice) return null

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/invoices/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Invoice</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Update the invoice details and save changes</p>
            {(() => {
              const obj = currentInvoice as unknown as Record<string, unknown>
              const hist = Array.isArray(obj.history) ? (obj.history as Array<Record<string, unknown>>) : []
              const createdViaHistory = hist.some((h) => typeof h?.description === 'string' && String(h.description).includes('created from recurring template'))
              const derivedRecurring = Boolean(obj.generatedFromRecurring || obj.recurringScheduleId || obj.recurringId || createdViaHistory)
              return (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Type:</span>
                  <Badge className={
                    derivedRecurring
                      ? 'bg-gradient-to-r from-indigo-500 to-emerald-500 text-white shadow-sm ring-1 ring-white/10'
                      : 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 dark:ring-blue-400/30'
                  }>
                    {derivedRecurring ? 'Recurring' : 'One-time'}
                  </Badge>
                </div>
              )
            })()}
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="destructive"
            onClick={() => router.push(`/invoices/${id}`)}
            disabled={isSubmitting}
            className="rounded-full hover-lift shadow-soft text-white"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {(() => {
            const obj = currentInvoice as unknown as Record<string, unknown>
            const hist = Array.isArray(obj.history) ? (obj.history as Array<Record<string, unknown>>) : []
            const createdViaHistory = hist.some((h) => typeof h?.description === 'string' && String(h.description).includes('created from recurring template'))
            const derivedRecurring = Boolean(obj.generatedFromRecurring || obj.recurringScheduleId || obj.recurringId || createdViaHistory)
            return isRecurring && !derivedRecurring ? (
            <Button
              onClick={handleCreateSchedule}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
            >
              <Save className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
            ) : (
            <Button onClick={handleSave} disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            )
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Basic information about the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <div className="relative">
                    <Input
                      id="issueDate"
                      type="date"
                      value={invoiceData.issueDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, issueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <div className="relative">
                    <Input
                      id="dueDate"
                      type="date"
                      min={invoiceData.issueDate || undefined}
                      value={invoiceData.dueDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={(val) => setCurrency(val)}>
                    <SelectTrigger id="currency" className="w-full" aria-label="Currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {['USD','EUR','GBP','CAD','AUD','INR','JPY','CNY','NGN','ZAR','SGD','AED','PKR'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recurring schedule toggle */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recurring Invoice</CardTitle>
                <CardDescription>Generate invoices on a schedule</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {(() => {
                  const inv: any = currentInvoice as any
                  const createdViaHistory = Array.isArray(inv?.history)
                    ? inv.history.some((h: any) => typeof h?.description === 'string' && h.description.includes('created from recurring template'))
                    : false
                  const derivedRecurring = Boolean(inv?.generatedFromRecurring || inv?.recurringScheduleId || inv?.recurringId || createdViaHistory)
                  return (
                    <>
                      <input
                        id="isRecurring"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        disabled={derivedRecurring}
                        title={derivedRecurring ? 'This invoice was generated from a recurring schedule' : undefined}
                      />
                      <Label htmlFor="isRecurring">Recurring</Label>
                    </>
                  )
                })()}
              </div>
            </CardHeader>
            {isRecurring && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={recurring.frequency}
                      onValueChange={(val) => setRecurring({ ...recurring, frequency: val as RecurrenceFrequency })}
                    >
                      <SelectTrigger id="frequency" className="w-full" aria-label="Frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">Interval</Label>
                    <Input id="interval" type="number" min="1" value={recurring.interval} onChange={(e) => setRecurring({ ...recurring, interval: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueInDays">Due In (days)</Label>
                    <Input id="dueInDays" type="number" min="1" value={recurring.dueInDays ?? ''} onChange={(e) => setRecurring({ ...recurring, dueInDays: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" required value={recurring.startDate} onChange={(e) => setRecurring({ ...recurring, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (optional)</Label>
                    <Input id="endDate" type="date" min={recurring.startDate || undefined} value={recurring.endDate || ''} onChange={(e) => setRecurring({ ...recurring, endDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxOccurrences">Max Occurrences (optional)</Label>
                    <Input id="maxOccurrences" type="number" min="1" value={recurring.maxOccurrences ?? ''} onChange={(e) => setRecurring({ ...recurring, maxOccurrences: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined })} />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input id="autoSend" type="checkbox" className="h-4 w-4" checked={recurring.autoSend} onChange={(e) => setRecurring({ ...recurring, autoSend: e.target.checked })} />
                  <Label htmlFor="autoSend">Automatically email generated invoices</Label>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Client Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>Details about the client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Select Client</Label>
                <Select
                  value={invoiceData.clientId || undefined}
                  onValueChange={(val) => handleClientChange(val)}
                >
                  <SelectTrigger id="clientId" className="w-full" aria-label="Client">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.email ? ` (${c.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    placeholder="Enter client name"
                    value={invoiceData.clientName}
                    onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email Address</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="client@example.com"
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData({ ...invoiceData, clientEmail: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientAddress">Billing Address</Label>
                <textarea
                  id="clientAddress"
                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="Enter billing address"
                  value={invoiceData.clientAddress}
                  onChange={(e) => setInvoiceData({ ...invoiceData, clientAddress: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>Add products or services to the invoice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                
                {invoiceData.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.rate}
                        onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        value={item.amount.toFixed(2)}
                        disabled
                        className="bg-gray-50 dark:bg-gray-800"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id as number)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button
                  variant="outline"
                  onClick={addItem}
                  className="w-full md:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Notes and payment terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="Additional notes for the client"
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <textarea
                  id="terms"
                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="Payment terms and conditions"
                  value={invoiceData.terms}
                  onChange={(e) => setInvoiceData({ ...invoiceData, terms: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Summary */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-lg sticky top-24">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">{(() => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(invoiceData.subtotal || 0) } catch { return `${currency} ${invoiceData.subtotal.toFixed(2)}` } })()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax ({invoiceData.taxRate}%)</span>
                  <span className="font-medium">{(() => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(invoiceData.tax || 0) } catch { return `${currency} ${invoiceData.tax.toFixed(2)}` } })()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Discount {invoiceData.discountType === 'PERCENTAGE' ? `(${invoiceData.discount || 0}%)` : ''}
                  </span>
                  <span className="font-medium">-
                    {(() => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
                      invoiceData.discountType === 'PERCENTAGE'
                        ? invoiceData.subtotal * ((invoiceData.discount || 0) / 100)
                        : (invoiceData.discount || 0)
                    ) } catch { return `${currency} ${(
                      invoiceData.discountType === 'PERCENTAGE'
                        ? invoiceData.subtotal * ((invoiceData.discount || 0) / 100)
                        : (invoiceData.discount || 0)
                    ).toFixed(2)}` } })()}
                  </span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {(() => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(invoiceData.total || 0) } catch { return `${currency} ${invoiceData.total.toFixed(2)}` } })()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={invoiceData.taxRate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, taxRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="discountType">Discount Type</Label>
                    <Select
                      value={invoiceData.discountType}
                      onValueChange={(val) => setInvoiceData({ ...invoiceData, discountType: val as DiscountType })}
                    >
                      <SelectTrigger id="discountType" className="w-full" aria-label="Discount Type">
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Fixed</SelectItem>
                        <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="discount">Discount {invoiceData.discountType === 'PERCENTAGE' ? '(%)' : '($)'}</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceData.discount}
                      onChange={(e) => setInvoiceData({ ...invoiceData, discount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <Button className="w-full" variant="outline" disabled>
                  <Calculator className="h-4 w-4 mr-2" />
                  Preview Invoice
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sharing */}
          <Card className="border-0 shadow-lg mt-6">
            <CardHeader>
              <CardTitle>Sharing</CardTitle>
              <CardDescription>Public access to this invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const inv: any = currentInvoice as any
                const shareId: string | undefined = inv?.shareId
                const shareEnabled: boolean = inv?.shareEnabled !== false
                if (!shareId && !shareEnabled) {
                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Sharing is disabled.</p>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await apiClient.updateInvoiceShare(id, true)
                            await getInvoice(id)
                            toast.success('Sharing enabled')
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Failed to enable sharing')
                          }
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-2" /> Enable sharing
                      </Button>
                    </div>
                  )
                }
                // If shareId exists or shareEnabled is true
                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                const url = shareId ? `${origin}/public/invoices/${shareId}` : ''
                return (
                  <div className="space-y-3">
                    {shareId ? (
                      <>
                        <div className="text-xs text-muted-foreground break-all select-all p-2 rounded-md bg-muted/40">
                          {url}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { if (shareId) window.open(`/public/invoices/${shareId}`, '_blank') }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" /> Open public
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(url)
                                toast.success('Public link copied')
                              } catch {
                                toast.error('Failed to copy link')
                              }
                            }}
                          >
                            <Share2 className="h-4 w-4 mr-2" /> Copy link
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Link will be generated after enabling sharing.</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiClient.updateInvoiceShare(id, !shareEnabled)
                            await getInvoice(id)
                            toast.success(!shareEnabled ? 'Sharing enabled' : 'Sharing disabled')
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Failed to update sharing')
                          }
                        }}
                      >
                        {shareEnabled ? (
                          <>
                            <Link2Off className="h-4 w-4 mr-2" /> Disable
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" /> Enable
                          </>
                        )}
                      </Button>
                      {shareEnabled && shareId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await apiClient.regenerateInvoiceShare(id)
                              await getInvoice(id)
                              toast.success('Link regenerated')
                            } catch (e: any) {
                              toast.error(e?.response?.data?.message || 'Failed to regenerate link')
                            }
                          }}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" /> Regenerate
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
