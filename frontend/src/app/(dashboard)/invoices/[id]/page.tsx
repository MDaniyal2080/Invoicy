"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Edit,
  Send,
  Download,
  Copy,
  Trash2,
  XCircle,
  Eye,
  ExternalLink,
  Share2,
  RefreshCcw,
  Link2,
  Link2Off,
  MoreVertical,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useInvoiceStore } from "@/lib/stores/invoice-store"
import apiClient from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PDFPreviewModal from "@/components/PDFPreviewModal"
import { usePaymentStore } from "@/lib/stores/payment-store"
import { getErrorMessage } from "@/lib/utils"

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  SENT: 'warning',
  VIEWED: 'warning',
  OVERDUE: 'destructive',
  DRAFT: 'secondary',
  CANCELLED: 'outline',
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || ''

  const {
    isLoading,
    currentInvoice,
    getInvoice,
    sendInvoice,
    downloadInvoicePDF,
    duplicateInvoice,
    deleteInvoice,
    markInvoiceAsPaid,
    cancelInvoice,
  } = useInvoiceStore()

  const {
    payments,
    fetchPayments,
    recordPayment,
    processPayment: processMockPayment,
    refundPayment,
    isLoading: isPayLoading,
  } = usePaymentStore()

  const [action, setAction] = useState<string | null>(null)
  // Removed unused showPdfOptions block to satisfy lint
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [pdfTemplate, setPdfTemplate] = useState<'classic' | 'modern'>('classic')
  const [pdfColor, setPdfColor] = useState<string>('')
  const [pdfFont, setPdfFont] = useState<string>('')
  const [pdfLayout, setPdfLayout] = useState<string>('')
  const [pdfFooter, setPdfFooter] = useState<string>('')

  // Compact actions dropdown
  const [openMenu, setOpenMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!id) return
    getInvoice(id).catch((err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to load invoice'))
      router.push('/invoices')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load payments for this invoice
  useEffect(() => {
    if (!id) return
    fetchPayments({ invoiceId: id }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const formatCurrency = (amount: number, currency?: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    } catch {
      return `$${(amount || 0).toFixed(2)}`
    }
  }

  const clientInitials = useMemo(() => {
    const name = currentInvoice?.client?.name || ''
    return name ? name.split(' ').map(n => n[0]).join('').slice(0,2) : 'CL'
  }, [currentInvoice])

  // Manual payment form state
  const [recordAmount, setRecordAmount] = useState<string>('')
  const [recordMethod, setRecordMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe'>('cash')
  const [recordDate, setRecordDate] = useState<string>('')
  const [recordTxn, setRecordTxn] = useState<string>('')
  const [recordNotes, setRecordNotes] = useState<string>('')

  // Mock payment form state
  const [procAmount, setProcAmount] = useState<string>('')
  const [procMethod, setProcMethod] = useState<'credit_card' | 'bank_transfer' | 'paypal'>('credit_card')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [procNotes, setProcNotes] = useState('')

  if (isLoading && !currentInvoice) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading invoice…</p>
      </div>
    )
  }

  if (!currentInvoice) return null

  const inv = currentInvoice
  const getKey = (obj: unknown, key: string): unknown => (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>) ? (obj as Record<string, unknown>)[key] : undefined)
  const isRecurring = Boolean(getKey(inv, 'recurringScheduleId') || getKey(inv, 'recurringId') || getKey(inv, 'generatedFromRecurring'))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice {inv.invoiceNumber || inv.id}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : ''}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Type:</span>
              <Badge className={
                isRecurring
                  ? 'bg-gradient-to-r from-indigo-500 to-emerald-500 text-white shadow-sm ring-1 ring-white/10'
                  : 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 dark:ring-blue-400/30'
              }>
                {isRecurring ? 'Recurring' : 'One-time'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 justify-end">
          <Badge variant={statusColors[inv.status] || 'default'}>{inv.status.replace(/_/g, ' ')}</Badge>
          {(() => {
            const shareIdRaw = getKey(inv, 'shareId')
            const shareEnabledRaw = getKey(inv, 'shareEnabled')
            const shareId = typeof shareIdRaw === 'string' ? shareIdRaw : undefined
            const shareEnabled = shareEnabledRaw !== false
            const isPublic = Boolean(shareId && shareEnabled)
            return (
              <Badge variant={isPublic ? 'info' : 'secondary'} className="uppercase">
                {isPublic ? 'Public' : 'Private'}
              </Badge>
            )
          })()}
          <Link href={`/invoices/${inv.id}/edit`}>
            <Button variant="info" size="sm" className="rounded-full hover-lift shadow-soft">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </Link>
          {/* Compact actions dropdown */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full hover-lift shadow-soft"
              onClick={() => setOpenMenu((v) => !v)}
            >
              <MoreVertical className="h-4 w-4 mr-2" /> Options
            </Button>
            {openMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-900 border border-border shadow-xl p-1 z-10">
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={() => { setOpenMenu(false); setShowPreviewModal(true); }}>
                  <Eye className="h-4 w-4" /> Preview & Customize
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading || action==='send'} onClick={async () => {
                  try { setOpenMenu(false); setAction('send'); await sendInvoice(inv.id); toast.success('Invoice sent') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to send invoice')) } finally { setAction(null) }
                }}>
                  <Send className="h-4 w-4" /> Send
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading || action==='paid'} onClick={async () => {
                  try { setOpenMenu(false); setAction('paid'); await markInvoiceAsPaid(inv.id); toast.success('Marked as paid') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to mark as paid')) } finally { setAction(null) }
                }}>
                  <Badge className="px-2 py-0.5">Paid</Badge>
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading || action==='download'} onClick={async () => {
                  try { setOpenMenu(false); setAction('download'); const blob = await downloadInvoicePDF(inv.id, { template: pdfTemplate === 'modern' ? 'modern' : undefined, font: pdfFont || undefined, layout: pdfLayout || undefined, footer: pdfFooter || undefined }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${inv.invoiceNumber || 'invoice'}.pdf`; a.click(); URL.revokeObjectURL(url) } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to download PDF')) } finally { setAction(null) }
                }}>
                  <Download className="h-4 w-4" /> Download PDF
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading || action==='duplicate'} onClick={async () => {
                  try { setOpenMenu(false); setAction('duplicate'); const dup = await duplicateInvoice(inv.id); toast.success('Invoice duplicated'); router.push(`/invoices/${dup.id}`) } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to duplicate invoice')) } finally { setAction(null) }
                }}>
                  <Copy className="h-4 w-4" /> Duplicate
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" disabled={isLoading || action==='cancel' || inv.status==='PAID' || inv.status==='CANCELLED'} onClick={async () => {
                  const ok = window.confirm('Cancel this invoice? This cannot be undone.'); if (!ok) return; try { setOpenMenu(false); setAction('cancel'); await cancelInvoice(inv.id); toast.success('Invoice cancelled') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to cancel invoice')) } finally { setAction(null) }
                }}>
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm text-red-600" disabled={isLoading || action==='delete'} onClick={async () => {
                  const ok = window.confirm('Delete this invoice?'); if (!ok) return; try { setOpenMenu(false); setAction('delete'); await deleteInvoice(inv.id); toast.success('Invoice deleted'); router.push('/invoices') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to delete invoice')) } finally { setAction(null) }
                }}>
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
                {(() => {
                  const shareId = typeof getKey(inv, 'shareId') === 'string' ? (getKey(inv, 'shareId') as string) : undefined
                  const shareEnabled = getKey(inv, 'shareEnabled') as boolean | undefined
                  return (
                    <>
                      {shareId && shareEnabled !== false && (
                        <>
                          <div className="h-px my-1 bg-border" />
                          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={() => { setOpenMenu(false); window.open(`/public/invoices/${shareId}`, '_blank') }}>
                            <ExternalLink className="h-4 w-4" /> Open public page
                          </button>
                          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={async () => {
                            try { const origin = typeof window !== 'undefined' ? window.location.origin : ''; const url = `${origin}/public/invoices/${shareId}`; await navigator.clipboard.writeText(url); toast.success('Public link copied') } catch { toast.error('Failed to copy link') } finally { setOpenMenu(false) }
                          }}>
                            <Share2 className="h-4 w-4" /> Copy public link
                          </button>
                        </>
                      )}
                      {(shareEnabled === false || !shareId) ? (
                        <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={async () => {
                          try { await apiClient.updateInvoiceShare(inv.id, true); await getInvoice(inv.id); toast.success('Sharing enabled') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to enable sharing')) } finally { setOpenMenu(false) }
                        }}>
                          <Link2 className="h-4 w-4" /> Enable sharing
                        </button>
                      ) : (
                        <>
                          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={async () => {
                            try { await apiClient.updateInvoiceShare(inv.id, false); await getInvoice(inv.id); toast.success('Sharing disabled') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to disable sharing')) } finally { setOpenMenu(false) }
                          }}>
                            <Link2Off className="h-4 w-4" /> Disable sharing
                          </button>
                          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-sm" onClick={async () => {
                            try { await apiClient.regenerateInvoiceShare(inv.id); await getInvoice(inv.id); toast.success('Link regenerated') } catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to regenerate link')) } finally { setOpenMenu(false) }
                          }}>
                            <RefreshCcw className="h-4 w-4" /> Regenerate link
                          </button>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Quick options (kept minimal via modal) */}
      {/* The previous inline PDF options were removed to reduce unused code and lint warnings. */}
      <div className="hidden" aria-hidden>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>PDF Options</CardTitle>
            <CardDescription>Customize the exported PDF appearance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pdfTemplate">Template</Label>
                <Select value={pdfTemplate} onValueChange={(v) => setPdfTemplate(v as 'classic' | 'modern')}>
                  <SelectTrigger id="pdfTemplate" className="w-full"><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdfColor">Color Scheme</Label>
                <Select value={pdfColor || 'default'} onValueChange={(v) => setPdfColor(v === 'default' ? '' : v)}>
                  <SelectTrigger id="pdfColor" className="w-full"><SelectValue placeholder="Choose color" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="indigo">Indigo</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                    <SelectItem value="violet">Violet</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectItem value="slate">Slate</SelectItem>
                    <SelectItem value="gray">Gray</SelectItem>
                    <SelectItem value="rose">Rose</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdfFont">Font</Label>
                <Select value={pdfFont || 'default'} onValueChange={(v) => setPdfFont(v === 'default' ? '' : v)}>
                  <SelectTrigger id="pdfFont" className="w-full"><SelectValue placeholder="Select font" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (Helvetica)</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Times">Times</SelectItem>
                    <SelectItem value="Courier">Courier (Monospace)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdfLayout">Layout</Label>
                <Select value={pdfLayout || 'default'} onValueChange={(v) => setPdfLayout(v === 'default' ? '' : v)}>
                  <SelectTrigger id="pdfLayout" className="w-full"><SelectValue placeholder="Select layout" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="compact">Compact Spacing</SelectItem>
                    <SelectItem value="left">Left-aligned Totals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="pdfFooter">Footer (optional)</Label>
              <Input
                id="pdfFooter"
                placeholder="Leave blank to use invoice/footer from Settings"
                value={pdfFooter}
                onChange={(e) => setPdfFooter(e.target.value)}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="info"
                size="sm"
                disabled={isLoading || action==='download'}
                onClick={async () => {
                  try {
                    setAction('download')
                    const blob = await downloadInvoicePDF(inv.id, {
                      template: pdfTemplate === 'modern' ? 'modern' : undefined,
                      font: pdfFont || undefined,
                      layout: pdfLayout || undefined,
                      footer: pdfFooter || undefined,
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${inv.invoiceNumber || 'invoice'}.pdf`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch (err: unknown) {
                    toast.error(getErrorMessage(err, 'Failed to download PDF'))
                  } finally {
                    setAction(null)
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Download with options
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Client and Invoice Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Client</CardTitle>
              <CardDescription>Billing details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-xs">
                    {clientInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{inv.client?.name || 'Unknown client'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-words">{inv.client?.email || ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Number</p>
                  <p className="font-medium">{inv.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-medium">{inv.status.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Date</p>
                  <p className="font-medium">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                  <p className="font-medium">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Currency</p>
                  <p className="font-medium">{inv.currency || 'USD'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>{inv.items?.length || 0} line items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2">Description</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {(inv.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-4 break-words">{it.description}</td>
                        <td className="py-2 pr-4">{it.quantity}</td>
                        <td className="py-2 pr-4">{formatCurrency(it.rate, inv.currency)}</td>
                        <td className="py-2 text-right">{formatCurrency((it.quantity || 0) * (it.rate || 0), inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Totals */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Amounts and totals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="font-medium">{formatCurrency(inv.subtotal, inv.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tax ({inv.taxRate || 0}%)</span>
                <span className="font-medium">{formatCurrency(inv.taxAmount, inv.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Discount{inv.discount ? ` (${inv.discountType === 'PERCENTAGE' ? `${inv.discount}%` : ''})` : ''}</span>
                <span className="font-medium">{inv.discountType === 'PERCENTAGE' ? `-${inv.discount}%` : formatCurrency(-(inv.discount || 0), inv.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Paid</span>
                <span className="font-medium">{formatCurrency(inv.paidAmount, inv.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Balance Due</span>
                <span className="font-medium">{formatCurrency(inv.balanceDue, inv.currency)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-gray-700 dark:text-gray-200">Total</span>
                <span className="text-lg font-semibold">{formatCurrency(inv.totalAmount, inv.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payments */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Record and track payments for this invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment History</p>
                  <span className="text-xs text-muted-foreground">{payments.length} records</span>
                </div>
                <div className="space-y-3">
                  {payments.length === 0 && (
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                  )}
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{p.invoiceNumber || inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.processedAt).toLocaleString()} • {p.method.replace(/_/g,' ')} • <span className="break-all">{p.transactionId || p.paymentNumber || ''}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            p.status === 'failed' ? 'text-destructive' : p.status === 'pending' ? 'text-warning' : 'text-foreground'
                          }`}
                        >
                          {formatCurrency(p.amount, inv.currency)}
                        </span>
                        {p.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await refundPayment(p.id)
                                await getInvoice(inv.id)
                                await fetchPayments({ invoiceId: inv.id })
                              } catch {}
                            }}
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Record Manual Payment</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="recordAmount">Amount</Label>
                      <Input id="recordAmount" type="number" min="0" step="0.01" value={recordAmount} onChange={(e) => setRecordAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="recordMethod">Method</Label>
                      <Select value={recordMethod} onValueChange={(v) => setRecordMethod(v as 'cash' | 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe')}>
                        <SelectTrigger id="recordMethod"><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="recordDate">Date</Label>
                      <Input id="recordDate" type="datetime-local" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="recordTxn">Reference</Label>
                      <Input id="recordTxn" placeholder="Transaction/Reference ID" value={recordTxn} onChange={(e) => setRecordTxn(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="recordNotes">Notes</Label>
                    <textarea id="recordNotes" className="w-full border rounded-md px-3 py-2 bg-background" rows={2} value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="success"
                      size="sm"
                      disabled={isLoading || isPayLoading}
                      onClick={async () => {
                        try {
                          const amt = parseFloat(recordAmount || '0')
                          if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
                          await recordPayment({
                            invoiceId: inv.id,
                            amount: amt,
                            method: recordMethod,
                            paymentDate: recordDate ? new Date(recordDate) : undefined,
                            transactionId: recordTxn || undefined,
                            notes: recordNotes || undefined,
                          })
                          await getInvoice(inv.id)
                          setRecordAmount(''); setRecordTxn(''); setRecordNotes(''); setRecordDate('')
                        } catch (err: unknown) {
                          toast.error(getErrorMessage(err, 'Failed to record payment'))
                        }
                      }}
                    >
                      Save Payment
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mock Gateway */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mock Payment Gateway</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="procAmount">Amount</Label>
                      <Input id="procAmount" type="number" min="0" step="0.01" value={procAmount} onChange={(e) => setProcAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="procMethod">Method</Label>
                      <Select value={procMethod} onValueChange={(v) => setProcMethod(v as 'credit_card' | 'bank_transfer' | 'paypal')}>
                        <SelectTrigger id="procMethod"><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {procMethod === 'credit_card' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input id="cardNumber" placeholder="4111 1111 1111 1111" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="cardExpiry">Expiry</Label>
                        <Input id="cardExpiry" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="cardCvv">CVV</Label>
                        <Input id="cardCvv" placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {procMethod === 'bank_transfer' && (
                    <div>
                      <Label htmlFor="bankAccount">Bank Account</Label>
                      <Input id="bankAccount" placeholder="IBAN / Account No." value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="procNotes">Notes</Label>
                    <textarea id="procNotes" className="w-full border rounded-md px-3 py-2 bg-background" rows={2} value={procNotes} onChange={(e) => setProcNotes(e.target.value)} />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="premium"
                      size="sm"
                      disabled={isLoading || isPayLoading}
                      onClick={async () => {
                        try {
                          const amt = parseFloat(procAmount || '0')
                          if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
                          await processMockPayment({
                            invoiceId: inv.id,
                            amount: amt,
                            method: procMethod,
                            cardNumber: procMethod==='credit_card' ? cardNumber : undefined,
                            cardExpiry: procMethod==='credit_card' ? cardExpiry : undefined,
                            cardCvv: procMethod==='credit_card' ? cardCvv : undefined,
                            bankAccount: procMethod==='bank_transfer' ? bankAccount : undefined,
                            notes: procNotes || undefined,
                          })
                          await getInvoice(inv.id)
                          setProcAmount(''); setProcNotes('')
                        } catch (err: unknown) {
                          toast.error(getErrorMessage(err, 'Payment failed'))
                        }
                      }}
                    >
                      Process Payment
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        invoiceId={inv.id}
        initialOptions={{
          template: pdfTemplate === 'modern' ? 'modern' : 'classic',
          font: pdfFont || 'helvetica',
          layout: pdfLayout || 'standard',
          footer: pdfFooter || '',
        }}
      />
    </div>
  )
}
