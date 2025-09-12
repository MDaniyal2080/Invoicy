"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
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
  const params = useParams()
  const shareId = (params?.shareId as string) || ''

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
      {/* Header with branding */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Invoicy
                </h1>
                <p className="text-xs text-muted-foreground">Professional Invoicing</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in">
        {/* Invoice Header */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 sm:p-8 shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Hash className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  {inv.invoiceNumber || inv.id}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
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
                <div className="flex items-center gap-2 text-muted-foreground">
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
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(inv.totalAmount, inv.currency)}
                </p>
                {(inv.balanceDue || 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Balance Due: <span className="font-semibold text-orange-600 dark:text-orange-400">
                      {formatCurrency(inv.balanceDue, inv.currency)}
                    </span>
                  </p>
                )}
              </div>
              
              {(inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (inv.balanceDue || 0) > 0) && (
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
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
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bill To</h2>
              </div>
              
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 ring-2 ring-blue-200 dark:ring-blue-800 shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg">
                    {clientInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {inv.client?.name || 'Unknown Client'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 break-words mb-3">{inv.client?.email || ''}</p>
                  {/* Address omitted because client model does not include address */}
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Invoice Items</h2>
                </div>
                <Badge variant="outline" className="px-3 py-1">
                  {inv.items?.length || 0} items
                </Badge>
              </div>
              
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Description</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">Qty</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">Rate</th>
                        <th className="px-3 py-3 sm:px-6 sm:py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-700">
                      {(inv.items || []).map((item: InvoiceItem, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-3 sm:px-6 sm:py-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100 break-words">{item.description}</div>
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-center text-slate-600 dark:text-slate-400">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-right text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.rate, inv.currency)}
                          </td>
                          <td className="px-3 py-3 sm:px-6 sm:py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
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
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(inv.subtotal, inv.currency)}
                  </span>
                </div>
                
                {(inv.taxRate || 0) > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600 dark:text-slate-400">Tax ({inv.taxRate}%)</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(inv.taxAmount, inv.currency)}
                    </span>
                  </div>
                )}
                
                {(inv.discount || 0) > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Discount {inv.discountType === 'PERCENTAGE' ? `(${inv.discount}%)` : ''}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{inv.discountType === 'PERCENTAGE' 
                        ? `${inv.discount}%` 
                        : formatCurrency(inv.discount, inv.currency)}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">Total</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </span>
                  </div>
                  
                  {(inv.paidAmount || 0) > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-slate-600 dark:text-slate-400">Paid</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(inv.paidAmount, inv.currency)}
                      </span>
                    </div>
                  )}
                  
                  {(inv.balanceDue || 0) > 0 && (
                    <div className="flex items-center justify-between py-2 bg-orange-50 dark:bg-orange-950/20 -mx-4 px-4 rounded-lg">
                      <span className="font-semibold text-orange-700 dark:text-orange-300">Balance Due</span>
                      <span className="text-xl font-bold text-orange-700 dark:text-orange-300">
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
          <div id="payment-section" className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Payment Options</h2>
              </div>
            </div>
            <div className="p-6">
                {result ? (
                  <div className="space-y-4">
                    <div className={`p-6 rounded-xl border-2 ${result.success 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        {result.success ? (
                          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        )}
                        <h3 className={`text-lg font-semibold ${result.success 
                          ? 'text-green-800 dark:text-green-200' 
                          : 'text-red-800 dark:text-red-200'
                        }`}>
                          {result.success ? 'Payment Successful!' : 'Payment Failed'}
                        </h3>
                      </div>
                      <p className={`text-sm mb-3 ${result.success 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                      }`}>
                        {result.message}
                      </p>
                      {result.transactionId && (
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Transaction ID</p>
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
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        onClick={() => setResult(null)}
                      >
                        Make Another Payment
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Secure Payment</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Powered by Stripe</p>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-8">
                      <div className="text-center space-y-6">
                        <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(inv.balanceDue, inv.currency)}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto text-lg">
                          Your payment is secured with industry-standard encryption. Card details are never stored on our servers.
                        </p>
                        
                        {stripeError && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 max-w-md mx-auto">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                              <p className="text-sm text-red-700 dark:text-red-300">{stripeError}</p>
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
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-12 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-lg"
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
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-lg">
            <div className="space-y-4">
              {inv.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Notes</h3>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{inv.notes}</p>
                </div>
              )}
              {inv.terms && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Terms & Conditions</h3>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{inv.terms}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Powered by Invoicy</span>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Professional invoicing made simple</p>
        </div>
      </div>
    </div>
  )
}
