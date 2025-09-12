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
import { Badge } from '@/components/ui/badge'

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
  const { isAuthenticated, user, logout } = useAuthStore()
  const initials = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || (user?.email?.[0]?.toUpperCase() ?? 'U')
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                Invoicy
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <a href="#features" className="text-sm lg:text-base text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm lg:text-base text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm lg:text-base text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Testimonials</a>
              {isAuthenticated ? (
                <>
                  <Link href={(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard'}>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm">{(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? 'Admin' : 'Dashboard'}</Button>
                  </Link>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Link href="/settings" className="flex items-center">
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs sm:text-sm"
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
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm">Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
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
      <section className="pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <Badge className="mb-4 sm:mb-6" variant="outline">
            <Zap className="h-3 w-3 mr-1" />
            <span className="text-xs sm:text-sm">New: AI-powered invoice generation</span>
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight">
            <span className="block">Invoice Management</span>
            <span className="block bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl lg:max-w-3xl mx-auto px-4">
            Create professional invoices, track payments, and manage your business finances with the most intuitive invoicing platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md sm:max-w-none mx-auto">
            <Link href={isAuthenticated ? ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard') : '/register'} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-sm sm:text-base">
                {isAuthenticated ? 'Go to Dashboard' : 'Start Free Trial'}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm sm:text-base">
              Watch Demo
            </Button>
          </div>
          <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Everything you need to manage invoices
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl lg:max-w-2xl mx-auto px-4">
              Powerful features designed to streamline your invoicing process and grow your business.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="p-3 bg-gradient-to-br from-indigo-100 to-emerald-100 dark:from-indigo-900/20 dark:to-emerald-900/20 rounded-lg w-fit mb-4">
                      <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
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
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">10k+</p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Active Users</p>
            </div>
            <div>
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">$50M+</p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Invoices Processed</p>
            </div>
            <div>
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">99.9%</p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Uptime</p>
            </div>
            <div>
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">24/7</p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 px-4">
              Choose the plan that fits your business needs
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`border-0 shadow-lg ${plan.popular ? 'ring-2 ring-indigo-600' : ''}`}>
                {plan.popular && (
                  <div className="bg-gradient-to-r from-indigo-600 to-emerald-600 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-600 dark:text-gray-300">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="h-5 w-5 text-emerald-600 mr-2 mt-0.5" />
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={isAuthenticated ? ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? '/admin' : '/dashboard') : '/register'}>
                    <Button 
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700' 
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
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
      <section id="testimonials" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Loved by businesses worldwide
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 px-4">
              See what our customers have to say about Invoicy
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">{testimonial.content}</p>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-600 to-emerald-600">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 px-4">
            Ready to streamline your invoicing?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-white/90 mb-6 sm:mb-8 max-w-xl lg:max-w-2xl mx-auto px-4">
            Join thousands of businesses using Invoicy to manage their finances efficiently.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-sm sm:text-base">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
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
