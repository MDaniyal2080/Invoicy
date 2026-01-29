'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, Check, X, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    companyAddress: '',
    taxId: '',
    agreedToTerms: false,
  })

  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })

  const passwordRulesFor = (password: string) => ({
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*]/.test(password),
  })

  const passwordValidationErrorFor = (password: string) => {
    const rules = passwordRulesFor(password)
    if (!rules.hasMinLength) return 'Password must be at least 8 characters'
    if (!rules.hasUpperCase) return 'Password must contain at least one uppercase letter'
    if (!rules.hasLowerCase) return 'Password must contain at least one lowercase letter'
    if (!rules.hasNumber) return 'Password must contain at least one number'
    if (!rules.hasSpecialChar) return 'Password must contain at least one special character (!@#$%^&*)'
    return null
  }

  const checkPasswordStrength = (password: string) => {
    setPasswordStrength(passwordRulesFor(password))
  }

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password })
    checkPasswordStrength(password)
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleNextStep = () => {
    setError('')
    if (currentStep === 1) {
      if (!isValidEmail(formData.email)) {
        setError('Please enter a valid email address')
        return
      }

      const passwordError = passwordValidationErrorFor(formData.password)
      if (passwordError) {
        setError(passwordError)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }
    if (currentStep === 2) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setError('First name and Last name are required')
        return
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    // Validate password strength
    const passwordError = passwordValidationErrorFor(formData.password)
    if (passwordError) {
      setError(passwordError)
      setCurrentStep(1)
      return
    }
    
    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName || undefined,
        companyPhone: formData.phone || undefined,
        companyAddress: formData.companyAddress || undefined,
        taxNumber: formData.taxId || undefined,
      })
      toast.success('Account created successfully!')
      router.push('/dashboard')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <div className={`flex items-center ${passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.hasMinLength ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  At least 8 characters
                </div>
                <div className={`flex items-center ${passwordStrength.hasUpperCase ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.hasUpperCase ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  One uppercase letter
                </div>
                <div className={`flex items-center ${passwordStrength.hasLowerCase ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.hasLowerCase ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  One lowercase letter
                </div>
                <div className={`flex items-center ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.hasNumber ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  One number
                </div>
                <div className={`flex items-center ${passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordStrength.hasSpecialChar ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  One special character (!@#$%^&*)
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
          </>
        )
      case 2:
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
          </>
        )
      case 3:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Inc."
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Input
                id="companyAddress"
                type="text"
                placeholder="123 Business St, City, State 12345"
                value={formData.companyAddress}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID (Optional)</Label>
              <Input
                id="taxId"
                type="text"
                placeholder="XX-XXXXXXX"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="terms"
                checked={formData.agreedToTerms}
                onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                disabled={isLoading}
              />
              <Label
                htmlFor="terms"
                className="text-sm font-normal cursor-pointer"
              >
                I agree to the{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <FrontPageShell
      title={<SiteBrand />}
      description="Tech-Forward Dark Mode"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Create an account</h2>
          <p className="text-sm text-slate-600">
            Step {currentStep} of 3 - {currentStep === 1 ? 'Account Details' : currentStep === 2 ? 'Personal Information' : 'Company Information'}
          </p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        <div>
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    step <= currentStep
                      ? 'border-[#0f0c29] bg-[#0f0c29] text-white'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {step < currentStep ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <span className="font-bold">{step}</span>
                  )}
                </div>
                {step < 3 && (
                  <div
                    className={`ml-3 h-1 w-16 sm:w-20 rounded-full transition-all duration-300 ${
                      step < currentStep ? 'bg-[#0f0c29]' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {renderStep()}
          {error && currentStep !== 1 && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-between pt-2">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                disabled={isLoading}
                className="h-11 px-5"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Previous
              </Button>
            )}
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={isLoading}
                className={`h-11 px-6 bg-[#0f0c29] hover:bg-[#302b63] text-white ${currentStep === 1 ? 'w-full' : 'ml-auto'}`}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isLoading || !formData.agreedToTerms}
                className="h-11 px-6 ml-auto bg-[#0f0c29] hover:bg-[#302b63] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            )}
          </div>
        </form>

        <div className="text-center text-sm">
          <span className="text-slate-600">Already have an account? </span>
          <Link href="/login" className="text-slate-900 font-semibold underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </FrontPageShell>
  )
}
