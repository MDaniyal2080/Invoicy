'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Save,
  User,
  Building2,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Mail,
  Upload,
  Check,
  Eye,
  EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/utils'

const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Palette },
]

export default function SettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [savedSection, setSavedSection] = useState<string | null>(null)
  const { changePassword, isLoading } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Security: show/hide password toggles and strength helpers
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const hasMin = newPassword.length >= 8
  const hasUpper = /[A-Z]/.test(newPassword)
  const hasLower = /[a-z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
  const score = [hasMin, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  const strength = score <= 2 ? 'Weak' : score === 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong'
  const canChange = currentPassword.length > 0 && newPassword === confirmPassword && score >= 4

  // Profile state (wired to backend)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [companyLogo, setCompanyLogo] = useState('')
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [role, setRole] = useState('')

  // Company profile fields (subset mapped to backend profile)
  const [companyName, setCompanyName] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')

  // Invoice/User settings
  const [invoicePrefix, setInvoicePrefix] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<number | ''>('')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [isSettingsLoading, setIsSettingsLoading] = useState(false)
  const [invoiceStartNumber, setInvoiceStartNumber] = useState<number | ''>('')
  const [currency, setCurrency] = useState('')
  const [taxRate, setTaxRate] = useState<number | ''>('')
  const [invoiceFooter, setInvoiceFooter] = useState('')

  // Notification settings
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [emailNotifyNewInvoice, setEmailNotifyNewInvoice] = useState(true)
  const [emailNotifyPaymentReceived, setEmailNotifyPaymentReceived] = useState(true)
  const [emailNotifyInvoiceOverdue, setEmailNotifyInvoiceOverdue] = useState(true)
  const [emailNotifyWeeklySummary, setEmailNotifyWeeklySummary] = useState(false)
  const [emailNotifyNewClientAdded, setEmailNotifyNewClientAdded] = useState(true)

  // Billing (read-only display for now)
  const [subscriptionPlan, setSubscriptionPlan] = useState('Free')
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)
  const [invoiceLimit, setInvoiceLimit] = useState<number | null>(null)
  const [invoiceUsage, setInvoiceUsage] = useState<number>(0)
  // const [isBillingActionLoading, setIsBillingActionLoading] = useState(false)
  // Mock checkout modal state
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<null | 'BASIC' | 'PREMIUM'>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [ccName, setCcName] = useState('')
  const [ccNumber, setCcNumber] = useState('')
  const [ccExpiry, setCcExpiry] = useState('')
  const [ccCvc, setCcCvc] = useState('')
  // Subscription currency from system settings (admin-configured)
  const [billingCurrency, setBillingCurrency] = useState<string>('USD')
  const formatBilling = (amount: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: billingCurrency }).format(amount) } catch { return `${billingCurrency} ${amount.toFixed(2)}` }
  }
  // Stripe Connect status
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; detailsSubmitted?: boolean; chargesEnabled?: boolean } | null>(null)
  const [loadingConnect, setLoadingConnect] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)

  // Preferences (local only)
  type ThemeOption = 'light' | 'dark' | 'system'
  const [theme, setTheme] = useState<ThemeOption>('system')
  const realtimeEnabled = useUIStore(s => s.realtimeEnabled)
  const setRealtimeEnabled = useUIStore(s => s.setRealtimeEnabled)
  const applyTheme = (th: ThemeOption) => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const useDark = th === 'dark' || (th === 'system' && prefersDark)
    if (useDark) root.classList.add('dark')
    else root.classList.remove('dark')
  }

  // Sync active tab with URL (?tab=...)
  useEffect(() => {
    const tabParam = (searchParams.get('tab') || '').toLowerCase()
    const validTabs = settingsTabs.map(t => t.id)
    setActiveTab(validTabs.includes(tabParam) ? tabParam : 'profile')
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    const loadProfile = async () => {
      try {
        setIsProfileLoading(true)
        const profile = await apiClient.getProfile()
        if (!mounted) return
        setFirstName(profile.firstName || '')
        setLastName(profile.lastName || '')
        setEmail(profile.email || '')
        setCompanyName(profile.companyName || '')
        setTaxNumber(profile.taxNumber || '')
        setCompanyAddress(profile.companyAddress || '')
        setCompanyPhone(profile.companyPhone || '')
        setCompanyEmail(profile.companyEmail || '')
        setRole(profile.role || '')
        setCompanyLogo(profile.companyLogo || '')
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, 'Failed to load profile'))
      } finally {
        setIsProfileLoading(false)
      }
    }
    loadProfile()
    return () => { mounted = false }
  }, [])

  // Load system default currency for subscription pricing
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cfg = await apiClient.getPublicConfig()
        if (mounted && cfg?.defaultCurrency) setBillingCurrency(cfg.defaultCurrency)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // Load Stripe Connect status (best-effort)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const st = await apiClient.stripeGetConnectStatus()
        if (mounted) setConnectStatus(st)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadSettings = async () => {
      try {
        setIsSettingsLoading(true)
        const settings = await apiClient.getUserSettings()
        if (!mounted) return
        setInvoicePrefix(settings.invoicePrefix || '')
        setPaymentTerms(typeof settings.paymentTerms === 'number' ? settings.paymentTerms : '')
        setInvoiceNotes(settings.invoiceNotes || '')
        setInvoiceStartNumber(
          typeof settings.invoiceStartNumber === 'number' ? settings.invoiceStartNumber : ''
        )
        setCurrency(settings.currency || '')
        setTaxRate(typeof settings.taxRate === 'number' ? settings.taxRate : '')
        setInvoiceFooter(settings.invoiceFooter || '')
        // Billing
        setSubscriptionPlan(settings.subscriptionPlan || 'Free')
        setSubscriptionEnd(settings.subscriptionEnd || null)
        setInvoiceLimit(typeof settings.invoiceLimit === 'number' ? settings.invoiceLimit : null)
        // Notification preferences
        setEmailNotificationsEnabled(
          typeof settings.emailNotificationsEnabled === 'boolean' ? settings.emailNotificationsEnabled : true
        )
        setEmailNotifyNewInvoice(
          typeof settings.emailNotifyNewInvoice === 'boolean' ? settings.emailNotifyNewInvoice : true
        )
        setEmailNotifyPaymentReceived(
          typeof settings.emailNotifyPaymentReceived === 'boolean' ? settings.emailNotifyPaymentReceived : true
        )
        setEmailNotifyInvoiceOverdue(
          typeof settings.emailNotifyInvoiceOverdue === 'boolean' ? settings.emailNotifyInvoiceOverdue : true
        )
        setEmailNotifyWeeklySummary(
          typeof settings.emailNotifyWeeklySummary === 'boolean' ? settings.emailNotifyWeeklySummary : false
        )
        setEmailNotifyNewClientAdded(
          typeof settings.emailNotifyNewClientAdded === 'boolean' ? settings.emailNotifyNewClientAdded : true
        )
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, 'Failed to load settings'))
      } finally {
        setIsSettingsLoading(false)
      }
    }
    loadSettings()
    return () => { mounted = false }
  }, [])

  // Load analytics usage for billing tab (how many invoices created)
  useEffect(() => {
    let mounted = true
    const loadUsage = async () => {
      try {
        // Prefer analytics by status to exclude CANCELLED from usage
        const invStats = await apiClient.getInvoiceStats()
        if (!mounted) return
        const dist: Array<{ status?: string; count?: number }> = Array.isArray(invStats?.statusDistribution) ? invStats.statusDistribution : []
        if (dist.length > 0) {
          const used = dist.filter(d => String(d.status).toUpperCase() !== 'CANCELLED')
            .reduce((sum, d) => sum + Number(d.count || 0), 0)
          setInvoiceUsage(used)
        } else {
          // Fallback to dashboard total count
          const data = await apiClient.getDashboardStats()
          setInvoiceUsage(Number(data?.totalInvoices || 0))
        }
      } catch {}
    }
    loadUsage()
    return () => { mounted = false }
  }, [])

  // Initialize theme preference from localStorage and apply
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? (localStorage.getItem('theme') as ThemeOption | null) : null
      const initial = stored || 'system'
      setTheme(initial)
      applyTheme(initial)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = (section: string) => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setSavedSection(section)
      setTimeout(() => setSavedSection(null), 3000)
    }, 1000)
  }

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      await apiClient.updateProfile({ firstName, lastName, companyPhone })
      setSavedSection('profile')
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update profile'))
    } finally {
      setIsSaving(false)
      setTimeout(() => setSavedSection(null), 3000)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <Card className="glass-card hover-lift">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gradient">Personal Information</CardTitle>
              <CardDescription className="text-muted-foreground">Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={role} disabled />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile}
                  disabled={isSaving || isProfileLoading}
                  className="gradient-primary hover-lift shadow-medium text-white font-semibold px-6 py-3"
                >
                  {savedSection === 'profile' ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      {isSaving ? 'Saving...' : (isProfileLoading ? 'Loading...' : 'Save Changes')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'billing':
        return (
          <Card className="glass-card hover-lift">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gradient">Billing</CardTitle>
              <CardDescription className="text-muted-foreground">View your current plan and usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 hover:border-primary/20 transition-all duration-200">
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xl font-bold text-gradient">{subscriptionPlan || 'Free'}</span>
                    {subscriptionPlan?.toLowerCase() === 'free' && <Badge variant="secondary" className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20">Free</Badge>}
                  </div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-secondary/5 to-accent/5 border border-secondary/10 hover:border-secondary/20 transition-all duration-200">
                  <p className="text-sm text-muted-foreground">Next Renewal</p>
                  <p className="mt-2 text-xl font-bold text-gradient">
                    {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/10 hover:border-accent/20 transition-all duration-200">
                  <p className="text-sm text-muted-foreground">Invoice Limit</p>
                  <p className="mt-2 text-xl font-bold text-gradient">{typeof invoiceLimit === 'number' ? (invoiceLimit === 0 ? 'Unlimited' : invoiceLimit) : '—'}</p>
                </div>
              </div>

              {/* Usage */}
              <div className="p-6 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Usage</p>
                    <p className="text-sm text-muted-foreground">
                      {typeof invoiceLimit === 'number' && invoiceLimit > 0
                        ? `You have used ${invoiceUsage} of ${invoiceLimit} invoices`
                        : `You have created ${invoiceUsage} invoices`}
                    </p>
                  </div>
                  {typeof invoiceLimit === 'number' && invoiceLimit > 0 && (
                    <Badge variant={invoiceUsage >= (invoiceLimit || 0) ? 'destructive' : 'warning'}>
                      {invoiceUsage >= (invoiceLimit || 0) ? 'Limit reached' : 'Limited'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stripe Connect (user payouts) */}
              <div className="flex items-center justify-between p-6 rounded-xl glass-card hover-lift">
                <div className="space-y-1">
                  <p className="font-semibold text-lg">Stripe Connect</p>
                  <p className="text-muted-foreground text-sm">
                    {connectStatus?.connected
                      ? `Connected${connectStatus?.chargesEnabled ? ' • Charges enabled' : ' • Pending verification'}`
                      : 'Not connected. Connect your Stripe account to accept invoice payments.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={connectStatus?.connected ? 'outline' : 'default'}
                    disabled={loadingConnect}
                    onClick={async () => {
                      try {
                        setLoadingConnect(true)
                        const res = await apiClient.stripeCreateConnectOnboarding()
                        const url = res?.url
                        if (url) window.location.href = url
                        else toast.error('Could not start Stripe onboarding')
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, 'Failed to start Stripe onboarding'))
                      } finally { setLoadingConnect(false) }
                    }}
                  >
                    {loadingConnect ? 'Loading…' : (connectStatus?.connected ? 'Update details' : 'Connect Stripe')}
                  </Button>
                </div>
              </div>

              {/* Subscription (Stripe) */}
              <div className="flex items-center justify-between p-6 rounded-xl glass-card hover-lift">
                <div className="space-y-1">
                  <p className="font-semibold text-lg">Subscription (Stripe)</p>
                  <p className="text-muted-foreground">Start or manage your subscription via Stripe Checkout.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={loadingSubs}
                    onClick={async () => {
                      try {
                        setLoadingSubs(true)
                        const { url } = await apiClient.stripeCreateSubscriptionCheckout('BASIC')
                        if (url) window.location.href = url
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, 'Failed to start Stripe checkout'))
                      } finally { setLoadingSubs(false) }
                    }}
                  >
                    Subscribe Basic (Stripe)
                  </Button>
                  <Button
                    className="gradient-primary text-white"
                    disabled={loadingSubs}
                    onClick={async () => {
                      try {
                        setLoadingSubs(true)
                        const { url } = await apiClient.stripeCreateSubscriptionCheckout('PREMIUM')
                        if (url) window.location.href = url
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, 'Failed to start Stripe checkout'))
                      } finally { setLoadingSubs(false) }
                    }}
                  >
                    Subscribe Premium (Stripe)
                  </Button>
                  <Button
                    variant="outline"
                    disabled={loadingSubs}
                    onClick={async () => {
                      try {
                        setLoadingSubs(true)
                        const { url } = await apiClient.stripeCreateBillingPortal()
                        if (url) window.location.href = url
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, 'Failed to open billing portal'))
                      } finally { setLoadingSubs(false) }
                    }}
                  >
                    Manage Billing (Stripe)
                  </Button>
                </div>
              </div>

              {/* Mock Checkout Modal */}
              {showCheckout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-border shadow-2xl">
                    <div className="p-6 space-y-6">
                      <div>
                        <h3 className="text-xl font-semibold">Upgrade to {checkoutPlan}</h3>
                        <p className="text-sm text-muted-foreground mt-1">This is a demo checkout. No real payment is processed.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Plan</p>
                          <p className="font-medium">{checkoutPlan === 'BASIC' ? 'Basic' : 'Premium'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="font-medium">{checkoutPlan === 'BASIC' ? `${formatBilling(9)}/mo` : `${formatBilling(19)}/mo`}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="cc-name">Cardholder Name</Label>
                          <Input id="cc-name" placeholder="Jane Doe" value={ccName} onChange={e => setCcName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cc-number">Card Number</Label>
                          <Input id="cc-number" placeholder="4242 4242 4242 4242" value={ccNumber} onChange={e => setCcNumber(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="cc-exp">Expiry</Label>
                            <Input id="cc-exp" placeholder="MM/YY" value={ccExpiry} onChange={e => setCcExpiry(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="cc-cvc">CVC</Label>
                            <Input id="cc-cvc" placeholder="123" value={ccCvc} onChange={e => setCcCvc(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => { if (!isProcessingPayment) { setShowCheckout(false); setCheckoutPlan(null); }}}>Cancel</Button>
                        <Button
                          className="gradient-primary text-white"
                          disabled={isProcessingPayment}
                          onClick={async () => {
                            try {
                              setIsProcessingPayment(true)
                              // Simulate payment delay
                              await new Promise(r => setTimeout(r, 1000))
                              // Call mock upgrade
                              const res = await apiClient.upgradePlanMock(checkoutPlan || undefined)
                              setSubscriptionPlan(res.subscriptionPlan)
                              setSubscriptionEnd(res.subscriptionEnd)
                              setInvoiceLimit(typeof res.invoiceLimit === 'number' ? res.invoiceLimit : null)
                              toast.success(res.message || `Upgraded to ${res.subscriptionPlan} (mock)`)
                              setShowCheckout(false)
                              setCheckoutPlan(null)
                            } catch (err: unknown) {
                              toast.error(getErrorMessage(err, 'Failed to upgrade'))
                            } finally {
                              setIsProcessingPayment(false)
                            }
                          }}
                        >
                          {isProcessingPayment ? 'Processing...' : (checkoutPlan === 'BASIC' ? `Pay ${formatBilling(9)}/mo` : `Pay ${formatBilling(19)}/mo`)}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 'company':
        return (
          <Card className="glass-card hover-lift">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gradient">Company Information</CardTitle>
              <CardDescription className="text-muted-foreground">Manage your company details and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 ring-4 ring-primary/20 group-hover:ring-primary/40 transition-all duration-200">
                      <AvatarImage src={companyLogo ? (() => { try { return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').origin + companyLogo } catch { return 'http://localhost:3001' + companyLogo } })() : "https://github.com/shadcn.png"} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-xl font-bold">
                        {(firstName?.[0] || 'U')}{(lastName?.[0] || 'N')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLogoUploading}
                      className="hover-lift shadow-soft"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      {isLogoUploading ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      JPG, GIF or PNG. Max size of 2MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const inputEl = e.currentTarget as HTMLInputElement
                        const file = inputEl.files?.[0]
                        if (!file) return
                        try {
                          setIsLogoUploading(true)
                          const res = await apiClient.uploadLogo(file)
                          const url = res?.companyLogo || ''
                          if (url) setCompanyLogo(url)
                          toast.success('Logo uploaded')
                        } catch (err: unknown) {
                          toast.error(getErrorMessage(err, 'Failed to upload logo'))
                        } finally {
                          setIsLogoUploading(false)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                    <Input
                      id="taxId"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      disabled={isProfileLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <textarea
                    id="address"
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    disabled={isProfileLoading}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Invoice Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      disabled={isSettingsLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceStartNumber">Starting Invoice Number</Label>
                    <Input
                      id="invoiceStartNumber"
                      type="number"
                      value={invoiceStartNumber}
                      onChange={(e) => setInvoiceStartNumber(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={isSettingsLoading}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Input
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        disabled={isSettingsLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxRate">Tax Rate (%)</Label>
                      <Input
                        id="taxRate"
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={isSettingsLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                    <Input
                      id="paymentTerms"
                      type="number"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={isSettingsLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNotes">Default Invoice Notes</Label>
                    <textarea
                      id="invoiceNotes"
                      className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      disabled={isSettingsLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceFooter">Invoice Footer</Label>
                    <textarea
                      id="invoiceFooter"
                      className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                      value={invoiceFooter}
                      onChange={(e) => setInvoiceFooter(e.target.value)}
                      disabled={isSettingsLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      setIsSaving(true)
                      // Update company profile fields
                      await apiClient.updateProfile({
                        companyName,
                        companyAddress,
                        taxNumber,
                        companyEmail,
                      })
                      // Update invoice settings
                      await apiClient.updateUserSettings({
                        invoicePrefix,
                        invoiceStartNumber: invoiceStartNumber === '' ? undefined : invoiceStartNumber,
                        currency: currency || undefined,
                        taxRate: taxRate === '' ? undefined : taxRate,
                        paymentTerms: paymentTerms === '' ? undefined : paymentTerms,
                        invoiceNotes,
                        invoiceFooter,
                      })
                      setSavedSection('company')
                      toast.success('Company settings updated')
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err, 'Failed to update company settings'))
                    } finally {
                      setIsSaving(false)
                      setTimeout(() => setSavedSection(null), 3000)
                    }
                  }}
                  disabled={isSaving || isProfileLoading || isSettingsLoading}
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
                >
                  {savedSection === 'company' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : ((isProfileLoading || isSettingsLoading) ? 'Loading...' : 'Save Changes')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'notifications':
        return (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M12 3v18m9-9H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="font-medium">Live updates (real-time)</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Enable Server‑Sent Events to see invoice and payment changes instantly.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={realtimeEnabled}
                    onChange={(e) => {
                      setRealtimeEnabled(e.target.checked)
                      toast.success(e.target.checked ? 'Real-time updates enabled' : 'Real-time updates disabled')
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={emailNotificationsEnabled}
                    onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                    disabled={isSettingsLoading || isSaving}
                  />
                </div>

                <div className="space-y-3 pl-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={emailNotifyNewInvoice}
                      onChange={(e) => setEmailNotifyNewInvoice(e.target.checked)}
                      disabled={isSettingsLoading || isSaving || !emailNotificationsEnabled}
                    />
                    <span className="text-sm">New invoice created</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={emailNotifyPaymentReceived}
                      onChange={(e) => setEmailNotifyPaymentReceived(e.target.checked)}
                      disabled={isSettingsLoading || isSaving || !emailNotificationsEnabled}
                    />
                    <span className="text-sm">Payment received</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={emailNotifyInvoiceOverdue}
                      onChange={(e) => setEmailNotifyInvoiceOverdue(e.target.checked)}
                      disabled={isSettingsLoading || isSaving || !emailNotificationsEnabled}
                    />
                    <span className="text-sm">Invoice overdue</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={emailNotifyWeeklySummary}
                      onChange={(e) => setEmailNotifyWeeklySummary(e.target.checked)}
                      disabled={isSettingsLoading || isSaving || !emailNotificationsEnabled}
                    />
                    <span className="text-sm">Weekly summary report</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={emailNotifyNewClientAdded}
                      onChange={(e) => setEmailNotifyNewClientAdded(e.target.checked)}
                      disabled={isSettingsLoading || isSaving || !emailNotificationsEnabled}
                    />
                    <span className="text-sm">New client added</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      setIsSaving(true)
                      await apiClient.updateUserSettings({
                        emailNotificationsEnabled,
                        emailNotifyNewInvoice,
                        emailNotifyPaymentReceived,
                        emailNotifyInvoiceOverdue,
                        emailNotifyWeeklySummary,
                        emailNotifyNewClientAdded,
                      })
                      setSavedSection('notifications')
                      toast.success('Notification preferences updated')
                    } catch (err: unknown) {
                      toast.error(getErrorMessage(err, 'Failed to update preferences'))
                    } finally {
                      setIsSaving(false)
                      setTimeout(() => setSavedSection(null), 3000)
                    }
                  }}
                  disabled={isSaving || isSettingsLoading}
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
                >
                  {savedSection === 'notifications' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'preferences':
        return (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Personalize your application experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(val) => {
                    const value = val as ThemeOption
                    setTheme(value)
                    try { if (typeof window !== 'undefined') localStorage.setItem('theme', value) } catch {}
                    applyTheme(value)
                    toast.success('Theme updated')
                  }}
                >
                  <SelectTrigger id="theme" className="w-full" aria-label="Theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border border-input">
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose how the app looks on your device.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  onValueChange={(val) => {
                    try {
                      if (typeof window !== 'undefined') localStorage.setItem('language', val)
                    } catch {}
                    toast.success('Language preference saved')
                  }}
                >
                  <SelectTrigger id="language" className="w-full" aria-label="Language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border border-input max-h-64 overflow-auto">
                    <SelectItem value="system">System Default</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="fr-FR">Français (FR)</SelectItem>
                    <SelectItem value="de-DE">Deutsch (DE)</SelectItem>
                    <SelectItem value="es-ES">Español (ES)</SelectItem>
                    <SelectItem value="pt-PT">Português (PT)</SelectItem>
                    <SelectItem value="pt-BR">Português (BR)</SelectItem>
                    <SelectItem value="it-IT">Italiano (IT)</SelectItem>
                    <SelectItem value="nl-NL">Nederlands (NL)</SelectItem>
                    <SelectItem value="pl-PL">Polski (PL)</SelectItem>
                    <SelectItem value="tr-TR">Türkçe (TR)</SelectItem>
                    <SelectItem value="ru-RU">Русский (RU)</SelectItem>
                    <SelectItem value="ja-JP">日本語 (JP)</SelectItem>
                    <SelectItem value="zh-CN">中文 (简体)</SelectItem>
                    <SelectItem value="zh-TW">中文 (繁體)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">Affects date/number formatting across the app where supported.</p>
              </div>
            </CardContent>
          </Card>
        )

      case 'security':
        return (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security and authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100">Two-Factor Authentication</p>
                      <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
                        Add an extra layer of security to your account
                      </p>
                      <Button variant="outline" size="sm" className="mt-3">
                        Enable 2FA
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Change Password</h3>
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                      >
                        {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isLoading}
                        className="pr-10"
                        aria-describedby="security-password-help"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                      >
                        {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                        <div
                          className={`h-2 transition-all ${
                            score <= 2 ? 'bg-red-500 w-1/4' : score === 3 ? 'bg-yellow-500 w-2/4' : score === 4 ? 'bg-emerald-500 w-3/4' : 'bg-green-600 w-full'
                          }`}
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground" id="security-password-help">
                        <span className={hasMin ? 'text-emerald-600' : ''}>• At least 8 characters</span>
                        <span className={hasUpper ? 'text-emerald-600' : ''}>• Uppercase letter</span>
                        <span className={hasLower ? 'text-emerald-600' : ''}>• Lowercase letter</span>
                        <span className={hasNumber ? 'text-emerald-600' : ''}>• Number</span>
                        <span className={hasSpecial ? 'text-emerald-600' : ''}>• Special character</span>
                        <span className="text-right font-medium">{strength}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="default"
                      onClick={async () => {
                        if (!currentPassword || !newPassword) {
                          toast.error('Please fill in all password fields')
                          return
                        }
                        if (newPassword !== confirmPassword) {
                          toast.error('New passwords do not match')
                          return
                        }
                        if (!canChange) {
                          toast.error('Please choose a stronger password and ensure both fields match')
                          return
                        }
                        try {
                          await changePassword(currentPassword, newPassword)
                          toast.success('Password changed successfully')
                          setCurrentPassword('')
                          setNewPassword('')
                          setConfirmPassword('')
                        } catch (err: unknown) {
                          toast.error(getErrorMessage(err, 'Failed to change password'))
                        }
                      }}
                      disabled={isLoading || !canChange}
                    >
                      {isLoading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Chrome on Windows • New York, US
                        </p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => handleSave('security')}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600"
                >
                  {savedSection === 'security' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gradient">Settings</h1>
          <p className="text-muted-foreground text-lg">Manage your account and application preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card className="glass-card">
            <CardContent className="p-0">
              <nav className="space-y-2 p-2">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('tab', tab.id)
                        router.push(`${pathname}?${params.toString()}`)
                      }}
                      className={cn(
                        'w-full flex items-center px-4 py-3 text-left text-sm font-semibold rounded-xl transition-all duration-200 group',
                        isActive
                          ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary shadow-soft border-l-4 border-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:shadow-soft'
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center rounded-lg p-2 mr-3 transition-all duration-200",
                        isActive 
                          ? "bg-white/20" 
                          : "group-hover:bg-white/10"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {tab.label}
                      {isActive && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      )}
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
