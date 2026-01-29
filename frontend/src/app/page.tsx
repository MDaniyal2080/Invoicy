'use client'

import Link from 'next/link'
import { 
  ArrowRight,
  Check,
  Star,
  Zap,
  Shield,
  BarChart3,
  Users,
  CreditCard,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FrontInfoCallout, FrontPalette, useFrontPageLightMode } from '@/components/ui/front-page-shell'

const features = [
  {
    icon: FileText,
    title: 'Professional Invoices',
    description: 'Create beautiful, customizable invoices that impress your clients.'
  },
  {
    icon: Users,
    title: 'Client Management',
    description: 'Keep all your client information organized in one secure place.'
  },
  {
    icon: CreditCard,
    title: 'Payment Tracking',
    description: 'Track payments, send reminders, and manage your cash flow effortlessly.'
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Get insights into your business performance with detailed reports.'
  },
  {
    icon: Shield,
    title: 'Bank-Level Security',
    description: 'Your data is encrypted and protected with enterprise-grade security.'
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Built for speed and performance, so you can focus on your business.'
  }
]

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Freelance Designer',
    content: 'Invoicy has transformed how I manage my invoicing. It\'s intuitive, fast, and my clients love the professional invoices.',
    rating: 5
  },
  {
    name: 'Michael Chen',
    role: 'Consultant',
    content: 'The best invoicing solution I\'ve used. The analytics help me understand my business better.',
    rating: 5
  },
  {
    name: 'Emma Davis',
    role: 'Agency Owner',
    content: 'Managing multiple clients has never been easier. Invoicy saves me hours every week.',
    rating: 5
  }
]

const pricingPlans = [
  {
    name: 'Starter',
    price: '$9',
    period: '/month',
    description: 'Perfect for freelancers and small businesses',
    features: [
      'Up to 10 clients',
      'Unlimited invoices',
      'Basic reports',
      'Email support'
    ],
    popular: false
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    description: 'For growing businesses with more needs',
    features: [
      'Unlimited clients',
      'Unlimited invoices',
      'Advanced analytics',
      'Payment reminders',
      'Priority support',
      'Custom branding'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Tailored solutions for large organizations',
    features: [
      'Everything in Professional',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Training & onboarding'
    ],
    popular: false
  }
]

export default function LandingPage() {
  useFrontPageLightMode(true)
  const { isAuthenticated, user, logout } = useAuthStore()
  const initials = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || (user?.email?.[0]?.toUpperCase() ?? 'U')
  return (
    <div className="min-h-screen bg-front-page motion-safe:animate-fade-in">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0c29]/70 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-semibold text-white">
                Invoicy
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <a href="#features" className="text-sm lg:text-base text-white/80 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm lg:text-base text-white/80 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm lg:text-base text-white/80 hover:text-white transition-colors">Testimonials</a>
              {isAuthenticated ? (
                <>
                  <Link href={(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/20 bg-white/10 text-xs sm:text-sm text-white backdrop-blur-md hover:bg-white/15"
                    >
                      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? 'Admin' : 'Dashboard'}
                    </Button>
                  </Link>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Link href="/settings" className="flex items-center">
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-white/20">
                        <AvatarFallback className="bg-white/15 text-white text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs sm:text-sm text-white hover:bg-white/10"
                      onClick={async () => {
                        try { await logout() } catch {}
                        // middleware will handle redirects from protected routes
                      }}
                    >
                      <span className="hidden sm:inline">Sign out</span>
                      <span className="sm:hidden">Out</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/20 bg-white/10 text-xs sm:text-sm text-white backdrop-blur-md hover:bg-white/15"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button
                      variant="premium"
                      size="sm"
                      className="relative overflow-hidden rounded-full animate-none text-xs sm:text-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.25),transparent_60%)] before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100"
                    >
                      <span className="hidden sm:inline">Get Started</span>
                      <span className="sm:hidden">Start</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 lg:pb-28 px-4 sm:px-6 lg:px-8 bg-front-gradient text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top,rgba(99,102,241,0.55),transparent_55%),radial-gradient(circle_at_bottom,rgba(139,92,246,0.45),transparent_60%)]" />
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl motion-safe:animate-pulse" />
          <div className="absolute -bottom-32 right-[-8rem] h-96 w-96 rounded-full bg-purple-500/25 blur-3xl motion-safe:animate-pulse" />
        </div>

        <div className="container mx-auto text-center relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight motion-safe:animate-fade-in-up motion-safe:[animation-delay:140ms] motion-safe:[animation-fill-mode:backwards]">
            <span className="block">Invoice Management</span>
            <span className="block text-white/90">
              Made Simple
            </span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-white/80 mb-6 sm:mb-8 max-w-2xl lg:max-w-3xl mx-auto px-4 motion-safe:animate-fade-in-up motion-safe:[animation-delay:220ms] motion-safe:[animation-fill-mode:backwards]">
            Create professional invoices, track payments, and manage your business finances with the most intuitive invoicing platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md sm:max-w-none mx-auto motion-safe:animate-fade-in-up motion-safe:[animation-delay:300ms] motion-safe:[animation-fill-mode:backwards]">
            <Link href={isAuthenticated ? ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard') : '/register'} className="w-full sm:w-auto">
              <Button
                variant="premium"
                size="xl"
                className="relative w-full sm:w-auto rounded-full px-10 text-sm sm:text-base animate-none overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_60%)] before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Start Free Trial'}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>

          <div className="mt-10 sm:mt-12 mx-auto max-w-sm w-full overflow-hidden rounded-3xl border border-white/15 bg-white/95 text-slate-900 shadow-2xl shadow-indigo-900/20 backdrop-blur-sm transition-transform duration-300 motion-safe:animate-fade-in-up motion-safe:[animation-delay:380ms] motion-safe:[animation-fill-mode:backwards] hover:-translate-y-1 hover:shadow-[0_40px_120px_-50px_rgba(0,0,0,0.55)]">
            <div className="px-6 py-9 text-center text-white bg-front-gradient relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity [background:radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)] hover:opacity-100" />
              <h2 className="text-2xl font-semibold tracking-tight">Modern Dark</h2>
            </div>
            <div className="px-6 py-6 space-y-6">
              <div className="space-y-1 text-left">
                <h3 className="text-base font-semibold">Tech-Forward Dark Mode</h3>
                <p className="text-sm text-slate-600">Modern dark theme for contemporary businesses. Reduces eye strain and looks premium.</p>
              </div>

              <FrontPalette />

              <FrontInfoCallout>
                <div className="space-y-1">
                  <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
                  <div className="font-semibold">Best for: Tech companies, modern startups</div>
                </div>
              </FrontInfoCallout>

              <div className="space-y-3">
                <h4 className="text-base font-semibold">UI Components</h4>
                <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <Button className="w-full h-12 bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] text-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    Generate Invoice
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between transition-transform duration-300 hover:scale-[1.01]">
                    <div>
                      <div className="text-sm font-semibold">Monthly Summary</div>
                      <div className="text-xs text-slate-600">January 2024</div>
                    </div>
                    <div className="text-2xl font-semibold text-[#0f0c29]">$32,450</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-white/70 px-4">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative overflow-hidden py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-front-page">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.10),transparent_55%)]" />
        </div>
        <div className="container mx-auto relative">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f0c29] mb-3 sm:mb-4">
              Everything you need to manage invoices
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl lg:max-w-2xl mx-auto px-4">
              Powerful features designed to streamline your invoicing process and grow your business.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="border-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <CardHeader>
                    <div className="p-3 bg-gradient-to-br from-[#0f0c29]/10 to-[#6366f1]/10 rounded-xl w-fit mb-4">
                      <Icon className="h-6 w-6 text-[#302b63]" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-front-page">
        <div className="container mx-auto">
          <div className="mx-auto max-w-6xl rounded-3xl border border-white/60 bg-white/70 p-6 sm:p-10 shadow-xl shadow-slate-200/30 backdrop-blur-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              <div className="transition-transform duration-300 hover:-translate-y-1">
                <p className="text-4xl font-bold bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] bg-clip-text text-transparent">10k+</p>
                <p className="text-slate-600 mt-2">Active Users</p>
              </div>
              <div className="transition-transform duration-300 hover:-translate-y-1">
                <p className="text-4xl font-bold bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] bg-clip-text text-transparent">$50M+</p>
                <p className="text-slate-600 mt-2">Invoices Processed</p>
              </div>
              <div className="transition-transform duration-300 hover:-translate-y-1">
                <p className="text-4xl font-bold bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] bg-clip-text text-transparent">99.9%</p>
                <p className="text-slate-600 mt-2">Uptime</p>
              </div>
              <div className="transition-transform duration-300 hover:-translate-y-1">
                <p className="text-4xl font-bold bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] bg-clip-text text-transparent">24/7</p>
                <p className="text-slate-600 mt-2">Support</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative overflow-hidden py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-front-page">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_70%_0%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.10),transparent_55%)]" />
        </div>
        <div className="container mx-auto relative">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f0c29] mb-3 sm:mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">
              Choose the plan that fits your business needs
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`border-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.popular ? 'ring-2 ring-[#6366f1]/50' : ''}`}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-[#0f0c29] via-[#302b63] to-[#6366f1] text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-[#0f0c29]">{plan.price}</span>
                    <span className="text-slate-600">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="h-5 w-5 text-emerald-600 mr-2 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={isAuthenticated ? ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard') : '/register'}>
                    <Button 
                      className="w-full rounded-full animate-none"
                      variant={plan.popular ? 'premium' : 'outline'}
                    >
                      {isAuthenticated ? 'Open Dashboard' : 'Get Started'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="relative overflow-hidden py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-front-page">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_30%_0%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(circle_at_80%_35%,rgba(139,92,246,0.10),transparent_55%)]" />
        </div>
        <div className="container mx-auto relative">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f0c29] mb-3 sm:mb-4">
              Loved by businesses worldwide
            </h2>
            <p className="text-base sm:text-lg text-slate-600 px-4">
              See what our customers have to say about Invoicy
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-600 mb-4">{testimonial.content}</p>
                  <div>
                    <p className="font-semibold text-[#0f0c29]">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-front-gradient">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-75 [background:radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_60%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.22),transparent_60%)]" />
        </div>
        <div className="container mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 px-4">
            Ready to streamline your invoicing?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-white/90 mb-6 sm:mb-8 max-w-xl lg:max-w-2xl mx-auto px-4">
            Join thousands of businesses using Invoicy to manage their finances efficiently.
          </p>
          <Link href="/register">
            <Button size="xl" variant="premium" className="rounded-full animate-none px-12 text-sm sm:text-base">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#0f0c29] text-white">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-4">
                Invoicy
              </h3>
              <p className="text-gray-400">
                The modern invoicing platform for growing businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Invoicy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
