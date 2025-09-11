'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api-client'
import { useRecurringInvoiceStore } from '@/lib/stores/recurring-invoice-store'
import type { DiscountType } from '@/types/invoice'
import type { RecurrenceFrequency } from '@/types/recurring-invoice'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Local form types
 type ItemForm = { id: number; description: string; quantity: number; rate: number; amount: number }
 type RecurringForm = {
  clientId: string
  items: ItemForm[]
  notes: string
  terms: string
  subtotal: number
  tax: number
  total: number
  taxRate: number
  discount: number
  discountType: DiscountType
  currency: string
  dueInDays?: number
  frequency: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string
  maxOccurrences?: number
  autoSend: boolean
 }

export default function EditRecurringInvoicePage() {
  const router = useRouter()
  // This route has been deprecated; redirect to invoices list
  useEffect(() => { router.replace('/invoices') }, [router])
  return null
  const params = useParams()
  const id = (params?.id as string) || ''

  const {
    isLoading,
    currentRecurringInvoice,
    getRecurringInvoice,
    updateRecurringInvoice,
  } = useRecurringInvoiceStore()

  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<RecurringForm>({
    clientId: '',
    items: [{ id: 1, description: '', quantity: 1, rate: 0, amount: 0 }],
    notes: '',
    terms: 'Payment is due within 30 days',
    subtotal: 0,
    tax: 0,
    total: 0,
    taxRate: 10,
    discount: 0,
    discountType: 'FIXED',
    currency: 'USD',
    dueInDays: 30,
    frequency: 'MONTHLY',
    interval: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxOccurrences: undefined,
    autoSend: false,
  })

  const toDateInputValue = (d?: string | Date | null) => {
    if (!d) return ''
    try {
      return new Date(d).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  useEffect(() => {
    if (!id) return
    getRecurringInvoice(id).catch((err: any) => {
      const msg = err?.response?.data?.message || 'Failed to load recurring invoice'
      toast.error(msg)
      router.push('/recurring-invoices')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let mounted = true
    apiClient.getClients()
      .then((res: any) => {
        const items = Array.isArray(res) ? res : (res?.items ?? [])
        if (mounted) setClients(items)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

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
    if (!currentRecurringInvoice) return

    const mappedItems = (currentRecurringInvoice.items || []).map((it: any, idx: number) => ({
      id: idx + 1,
      description: it.description || '',
      quantity: typeof it.quantity === 'number' ? it.quantity : 1,
      rate: typeof it.rate === 'number' ? it.rate : 0,
      amount: (typeof it.quantity === 'number' ? it.quantity : 1) * (typeof it.rate === 'number' ? it.rate : 0),
    }))

    const itemsForTotals = mappedItems.length ? mappedItems : [{ id: 1, description: '', quantity: 1, rate: 0, amount: 0 }]
    const { subtotal, tax, total } = computeTotals(
      itemsForTotals,
      currentRecurringInvoice.taxRate || 0,
      currentRecurringInvoice.discount || 0,
      (currentRecurringInvoice.discountType as DiscountType) || 'FIXED'
    )

    setForm({
      clientId: currentRecurringInvoice.clientId || '',
      items: itemsForTotals,
      notes: currentRecurringInvoice.notes || '',
      terms: currentRecurringInvoice.terms || 'Payment is due within 30 days',
      subtotal,
      tax,
      total,
      taxRate: currentRecurringInvoice.taxRate || 0,
      discount: currentRecurringInvoice.discount || 0,
      discountType: (currentRecurringInvoice.discountType as DiscountType) || 'FIXED',
      currency: currentRecurringInvoice.currency || 'USD',
      dueInDays: currentRecurringInvoice.dueInDays || undefined,
      frequency: currentRecurringInvoice.frequency,
      interval: currentRecurringInvoice.interval || 1,
      startDate: toDateInputValue(currentRecurringInvoice.startDate),
      endDate: toDateInputValue(currentRecurringInvoice.endDate) || '',
      maxOccurrences: currentRecurringInvoice.maxOccurrences || undefined,
      autoSend: !!currentRecurringInvoice.autoSend,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRecurringInvoice])

  useEffect(() => {
    const { subtotal, tax, total } = computeTotals(
      form.items,
      form.taxRate,
      form.discount,
      form.discountType
    )
    setForm((prev) => ({ ...prev, subtotal, tax, total }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.taxRate, form.discount, form.discountType])

  const addItem = () => {
    const newItem = { id: form.items.length + 1, description: '', quantity: 1, rate: 0, amount: 0 }
    setForm({ ...form, items: [...form.items, newItem] })
  }

  const removeItem = (id: number) => {
    const updatedItems = form.items.filter(item => item.id !== id)
    const { subtotal, tax, total } = computeTotals(updatedItems, form.taxRate, form.discount, form.discountType)
    setForm({ ...form, items: updatedItems, subtotal, tax, total })
  }

  const updateItem = (id: number, field: keyof ItemForm, value: any) => {
    const updatedItems = form.items.map(item => {
      if (item.id === id) {
        const updatedItem: ItemForm = { ...item, [field]: value } as ItemForm
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = Number(updatedItem.quantity) * Number(updatedItem.rate)
        }
        return updatedItem
      }
      return item
    })
    const { subtotal, tax, total } = computeTotals(updatedItems, form.taxRate, form.discount, form.discountType)
    setForm({ ...form, items: updatedItems, subtotal, tax, total })
  }

  const validate = () => {
    if (!form.clientId) { toast.error('Please select a client'); return false }
    const validItems = form.items.filter(it => it.description.trim() && it.quantity > 0 && it.rate >= 0)
    if (validItems.length === 0) { toast.error('Add at least one valid item'); return false }
    if (!(form.interval >= 1)) { toast.error('Interval must be at least 1'); return false }
    if (!form.frequency) { toast.error('Select a frequency'); return false }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const payload = {
        clientId: form.clientId,
        items: form.items.map(it => ({ description: it.description, quantity: Number(it.quantity), rate: Number(it.rate) })),
        taxRate: form.taxRate,
        discount: form.discount,
        discountType: form.discountType,
        currency: form.currency,
        notes: form.notes,
        terms: form.terms,
        dueInDays: form.dueInDays,
        frequency: form.frequency,
        interval: form.interval,
        startDate: form.startDate,
        endDate: form.endDate ? form.endDate : null,
        maxOccurrences: form.maxOccurrences,
        autoSend: form.autoSend,
      }
      await updateRecurringInvoice(id, payload)
      toast.success('Recurring invoice updated')
      router.push(`/recurring-invoices/${id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update recurring invoice'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !currentRecurringInvoice) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }
  if (!currentRecurringInvoice) return null

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/recurring-invoices/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Recurring Invoice</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Update the schedule and items, then save changes</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => router.push(`/recurring-invoices/${id}`)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schedule Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>How often to generate invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(val) => setForm({ ...form, frequency: val as RecurrenceFrequency })}
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
                  <Input id="interval" type="number" min="1" value={form.interval} onChange={(e) => setForm({ ...form, interval: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueInDays">Due In (days)</Label>
                  <Input id="dueInDays" type="number" min="1" value={form.dueInDays ?? ''} onChange={(e) => setForm({ ...form, dueInDays: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOccurrences">Max Occurrences (optional)</Label>
                  <Input id="maxOccurrences" type="number" min="1" value={form.maxOccurrences ?? ''} onChange={(e) => setForm({ ...form, maxOccurrences: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined })} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input id="autoSend" type="checkbox" className="h-4 w-4" checked={form.autoSend} onChange={(e) => setForm({ ...form, autoSend: e.target.checked })} />
                <Label htmlFor="autoSend">Automatically email generated invoices</Label>
              </div>
            </CardContent>
          </Card>

          {/* Client */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Client</CardTitle>
              <CardDescription>Select a client for invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Select Client</Label>
                <Select
                  value={form.clientId || undefined}
                  onValueChange={(val) => setForm({ ...form, clientId: val })}
                >
                  <SelectTrigger id="clientId" className="w-full" aria-label="Select Client">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.email ? ` (${c.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>What to include on each invoice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2">Amount</div>
                </div>
                {form.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <Input placeholder="Item description" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Input type="number" min="1" placeholder="1" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="md:col-span-2">
                      <Input type="number" min="0" step="0.01" placeholder="0.00" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="md:col-span-2">
                      <Input type="number" value={item.amount.toFixed(2)} disabled className="bg-gray-50 dark:bg-gray-800" />
                    </div>
                    <div className="md:col-span-12 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addItem} className="w-full md:w-auto">
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes / Terms */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Additional</CardTitle>
              <CardDescription>Notes and payment terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea id="notes" className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background" placeholder="Additional notes for the client" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <textarea id="terms" className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background" placeholder="Payment terms and conditions" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-lg sticky top-24">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">${form.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax ({form.taxRate}%)</span>
                  <span className="font-medium">${form.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Discount {form.discountType === 'PERCENTAGE' ? `(${form.discount || 0}%)` : ''}</span>
                  <span className="font-medium">-${(form.discountType === 'PERCENTAGE' ? form.subtotal * ((form.discount || 0) / 100) : (form.discount || 0)).toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">${form.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input id="taxRate" type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="discountType">Discount Type</Label>
                    <Select
                      value={form.discountType}
                      onValueChange={(val) => setForm({ ...form, discountType: val as DiscountType })}
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
                    <Label htmlFor="discount">Discount {form.discountType === 'PERCENTAGE' ? '(%)' : '($)'}</Label>
                    <Input id="discount" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
