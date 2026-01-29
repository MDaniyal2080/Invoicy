"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import apiClient from "@/lib/api-client"
import type { InvoiceType as Invoice, InvoiceItem, InvoiceStatus } from "@/lib/stores/invoice-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, CreditCard, Building2, Calendar, Hash, DollarSign, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { getErrorMessage } from "@/lib/utils"
import { useFrontPageLightMode } from "@/components/ui/front-page-shell"

type APIError = { response?: { data?: { message?: string } } }

const statusColors: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  SENT: 'warning',
  VIEWED: 'warning',
  OVERDUE: 'destructive',
  DRAFT: 'secondary',
  CANCELLED: 'outline',
}

export default function PublicInvoicePage() {
  useFrontPageLightMode(true)
  const params = useParams()
  const shareId = (params?.shareId as string) || ''
  const searchParams = useSearchParams()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPayForm, setShowPayForm] = useState(false)
  const [payMethod, setPayMethod] = useState<'credit_card' | 'bank_transfer' | 'paypal'>('credit_card')
  const [payAmount, setPayAmount] = useState<string>('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; transactionId?: string } | null>(null)
  const [isStripeRedirecting, setIsStripeRedirecting] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [verifyingOnReturn, setVerifyingOnReturn] = useState(false)
  const [verifiedSessionId, setVerifiedSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!shareId) return
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await apiClient.getPublicInvoice(shareId)
        if (!mounted) return
        setInvoice(data)
      } catch (err: unknown) {
        const e = err as APIError
        const msg = e?.response?.data?.message ?? 'Invoice not found or no longer available.'
        setError(msg)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [shareId])

  // Fallback verification: if returning from Stripe with paid=1 & session_id, verify server-side and refresh invoice
  useEffect(() => {
    if (!shareId) return
    const paid = searchParams.get('paid')
    const sid = searchParams.get('session_id')
    if (paid === '1' && sid && sid !== verifiedSessionId) {
      let cancelled = false
      ;(async () => {
        try {
          setVerifyingOnReturn(true)
          setStripeError(null)
          await apiClient.verifyPublicInvoiceStripeCheckout(shareId, sid)
          if (cancelled) return
          setVerifiedSessionId(sid)
          const fresh = await apiClient.getPublicInvoice(shareId)
          if (!cancelled) setInvoice(fresh)
        } catch (e: unknown) {
          if (!cancelled) setStripeError(getErrorMessage(e, 'We could not auto-verify your payment. Please refresh in a moment.'))
        } finally {
          if (!cancelled) setVerifyingOnReturn(false)
        }
      })()
      return () => { cancelled = true }
    }
  }, [searchParams, shareId, verifiedSessionId])

  // Initialize default amount from invoice balance
  useEffect(() => {
    if (invoice?.balanceDue && !payAmount) {
      setPayAmount(String(invoice.balanceDue))
    }
  }, [invoice, payAmount])

  const formatCurrency = (amount: number, currency?: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    } catch {
      return `$${(amount || 0).toFixed(2)}`
    }
  }

  const clientInitials = useMemo(() => {
    const name = invoice?.client?.name || ''
    return name ? name.split(' ').map((n: string) => n[0]).join('').slice(0,2) : 'CL'
  }, [invoice])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary shadow-glow"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass-card hover-lift animate-fade-in max-w-md w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-destructive/20 to-orange-500/20 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 bg-gradient-to-r from-destructive to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">!</span>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gradient">Invoice Unavailable</CardTitle>
            <CardDescription className="text-muted-foreground">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              The shared invoice link may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invoice) return null

  const inv = invoice

  const getStatusIcon = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID': return <CheckCircle className="w-4 h-4" />
      case 'OVERDUE': return <AlertCircle className="w-4 h-4" />
      case 'PARTIALLY_PAID': return <Clock className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-front-page">
      {/* Header with branding */}
      <div className="bg-front-gradient border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-front-gradient rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Invoicy
                </h1>
                <p className="text-xs text-white/70">Professional Invoicing</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/30 text-white hover:bg-white/10 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 motion-safe:animate-fade-in">
        {/* Invoice Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl shadow-slate-200/20 transition-all duration-300 motion-safe:animate-fade-in-up hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/30">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Hash className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f0c29]">
                  {inv.invoiceNumber || inv.id}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  Issued: {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'N/A'}
                </span>
              </div>
              {inv.dueDate && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    Due: {new Date(inv.dueDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              )}
              {/* Payment return verification hint */}
              {verifyingOnReturn && (
                <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-300 border-t-slate-700"></div>
                  Verifying your payment...
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-start lg:items-end gap-4">
              <Badge 
                variant={statusColors[inv.status] || 'default'} 
                className="px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                {getStatusIcon(inv.status)}
                {inv.status?.replace(/_/g, ' ')}
              </Badge>
              
              <div className="text-right space-y-1">
                <p className="text-2xl font-bold text-[#0f0c29]">
                  {formatCurrency(inv.totalAmount, inv.currency)}
                </p>
                {(inv.balanceDue || 0) > 0 && (
                  <p className="text-sm text-slate-600">
                    Balance Due: <span className="font-semibold text-orange-600">
                      {formatCurrency(inv.balanceDue, inv.currency)}
                    </span>
                  </p>
                )}
              </div>
              
              {(inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (inv.balanceDue || 0) > 0) && (
                <Button
                  className="bg-[#0f0c29] hover:bg-[#302b63] text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  onClick={() => {
                    setShowPayForm(true)
                    // Scroll to payment section after a brief delay to ensure it's rendered
                    setTimeout(() => {
                      const paymentSection = document.getElementById('payment-section')
                      if (paymentSection) {
                        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }, 100)
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Client & Items */}
          <div className="xl:col-span-2 space-y-8">
            {/* Client Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg transition-all duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:80ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-[#0f0c29]" />
                <h2 className="text-xl font-semibold text-[#0f0c29]">Bill To</h2>
              </div>
              
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 ring-2 ring-slate-200 shadow-md">
                  <AvatarFallback className="bg-front-gradient text-white font-bold text-lg">
                    {clientInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-[#0f0c29] mb-1">
                    {inv.client?.name || 'Unknown Client'}
                  </h3>
                  <p className="text-slate-600 break-words mb-3">{inv.client?.email || ''}</p>
                  {/* Address omitted because client model does not include address */}
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg transition-all duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:140ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#0f0c29]" />
                  <h2 className="text-xl font-semibold text-[#0f0c29]">Invoice Items</h2>
                </div>
                <Badge variant="outline" className="px-3 py-1">
                  {inv.items?.length || 0} items
                </Badge>
              </div>
              
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-slate-700">Description</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-sm font-semibold text-slate-700">Qty</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-right text-sm font-semibold text-slate-700">Rate</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-right text-sm font-semibold text-slate-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {(inv.items || []).map((item: InvoiceItem, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-3 sm:px-6 sm:py-4">
                            <div className="font-medium text-slate-900 break-words">{item.description}</div>
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-center text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-right text-slate-600">
                            {formatCurrency(item.rate, inv.currency)}
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-right font-semibold text-slate-900">
                            {formatCurrency((item.quantity || 0) * (item.rate || 0), inv.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary & Payment */}
          <div className="space-y-8">
            {/* Invoice Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg transition-all duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:220ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold text-[#0f0c29]">Summary</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(inv.subtotal, inv.currency)}
                  </span>
                </div>
                
                {(inv.taxRate || 0) > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Tax ({inv.taxRate}%)</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(inv.taxAmount, inv.currency)}
                    </span>
                  </div>
                )}
                
                {(inv.discount || 0) > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">
                      Discount {inv.discountType === 'PERCENTAGE' ? `(${inv.discount}%)` : ''}
                    </span>
                    <span className="font-medium text-green-600">
                      -{inv.discountType === 'PERCENTAGE' 
                        ? `${inv.discount}%` 
                        : formatCurrency(inv.discount, inv.currency)}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-lg font-semibold text-[#0f0c29]">Total</span>
                    <span className="text-2xl font-bold text-[#0f0c29]">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </span>
                  </div>
                  
                  {(inv.paidAmount || 0) > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-slate-600">Paid</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(inv.paidAmount, inv.currency)}
                      </span>
                    </div>
                  )}
                  
                  {(inv.balanceDue || 0) > 0 && (
                    <div className="flex items-center justify-between py-2 bg-orange-50 -mx-4 px-4 rounded-lg">
                      <span className="font-semibold text-orange-700">Balance Due</span>
                      <span className="text-xl font-bold text-orange-700">
                        {formatCurrency(inv.balanceDue, inv.currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Section - Moved outside the grid */}
        {(inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (inv.balanceDue || 0) > 0 && (showPayForm || result)) && (
          <div
            id="payment-section"
            className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden transition-all duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:300ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-[#0f0c29]" />
                <h2 className="text-xl font-semibold text-[#0f0c29]">Payment Options</h2>
              </div>
            </div>
            <div className="p-6">
                {result ? (
                  <div className="space-y-4">
                    <div className={`p-6 rounded-xl border-2 ${result.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        {result.success ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        )}
                        <h3 className={`text-lg font-semibold ${result.success 
                          ? 'text-green-800' 
                          : 'text-red-800'
                        }`}>
                          {result.success ? 'Payment Successful!' : 'Payment Failed'}
                        </h3>
                      </div>
                      <p className={`text-sm mb-3 ${result.success 
                        ? 'text-green-700' 
                        : 'text-red-700'
                      }`}>
                        {result.message}
                      </p>
                      {result.transactionId && (
                        <div className="bg-white/60 rounded-lg p-3">
                          <p className="text-xs text-slate-600 mb-1">Transaction ID</p>
                          <p className="font-mono text-sm font-medium">{result.transactionId}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          setLoading(true)
                          try {
                            const fresh = await apiClient.getPublicInvoice(shareId)
                            setInvoice(fresh)
                          } catch {}
                          setLoading(false)
                        }}
                      >
                        Refresh Invoice
                      </Button>
                      <Button
                        className="flex-1 bg-[#0f0c29] hover:bg-[#302b63] text-white"
                        onClick={() => setResult(null)}
                      >
                        Make Another Payment
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-front-gradient rounded-xl flex items-center justify-center shadow-lg">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-2xl font-semibold text-slate-900">Secure Payment</h3>
                        <p className="text-sm text-slate-600">Powered by Stripe</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
                      <div className="text-center space-y-6">
                        <div className="text-4xl font-bold text-[#0f0c29]">
                          {formatCurrency(inv.balanceDue, inv.currency)}
                        </div>
                        <p className="text-slate-600 max-w-lg mx-auto text-lg">
                          Your payment is secured with industry-standard encryption. Card details are never stored on our servers.
                        </p>
                        
                        {stripeError && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md mx-auto">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                              <p className="text-sm text-red-700">{stripeError}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowPayForm(false)}
                            className="px-8 py-3 rounded-xl"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="lg"
                            className="bg-[#0f0c29] hover:bg-[#302b63] text-white font-semibold px-12 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-lg"
                            disabled={isStripeRedirecting || !inv || (inv.balanceDue || 0) <= 0}
                            onClick={async () => {
                              try {
                                setStripeError(null)
                                setIsStripeRedirecting(true)
                                const res = await apiClient.createPublicInvoiceStripeCheckout(shareId)
                                const url = res?.url
                                if (url) {
                                  window.location.href = url
                                } else {
                                  setStripeError('Unable to create checkout session. Please try again later.')
                                }
                              } catch (e: unknown) {
                                setStripeError(getErrorMessage(e, 'Stripe checkout is not available.'))
                              } finally {
                                setIsStripeRedirecting(false)
                              }
                            }}
                          >
                            {isStripeRedirecting ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-3"></div>
                                Redirecting to Stripe...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-5 h-5 mr-3" />
                                Pay with Stripe
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {(inv.notes || inv.terms) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg transition-all duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:360ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-xl">
            <div className="space-y-4">
              {inv.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Notes</h3>
                  <p className="text-slate-600 whitespace-pre-wrap break-words">{inv.notes}</p>
                </div>
              )}
              {inv.terms && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Terms & Conditions</h3>
                  <p className="text-slate-600 whitespace-pre-wrap break-words">{inv.terms}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 motion-safe:animate-fade-in-up motion-safe:[animation-delay:420ms] motion-safe:[animation-fill-mode:backwards]">
          <div className="flex items-center justify-center gap-2 text-slate-600 mb-2">
            <div className="w-8 h-8 bg-front-gradient rounded-lg flex items-center justify-center transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Powered by Invoicy</span>
          </div>
          <p className="text-sm text-slate-500">Professional invoicing made simple</p>
        </div>
      </div>
    </div>
  )
}
