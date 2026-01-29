import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Building2, FileText, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import heroBg from "@/assets/hero-bg.jpg";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";

const steps = [
  { id: 1, name: "Account" },
  { id: 2, name: "Personal" },
  { id: 3, name: "Company" },
];

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    companyName: "",
    termsAccepted: false,
  });

  const passwordRules = () => {
    const { password } = formData;
    return {
      hasMinLength: password.length >= 8,
      hasLowerCase: /[a-z]/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*]/.test(password),
    };
  };

  const passwordValidationError = () => {
    const rules = passwordRules();
    if (!rules.hasMinLength) return "Password must be at least 8 characters";
    if (!rules.hasLowerCase) return "Password must contain at least one lowercase letter";
    if (!rules.hasUpperCase) return "Password must contain at least one uppercase letter";
    if (!rules.hasNumber) return "Password must contain at least one number";
    if (!rules.hasSpecialChar) return "Password must contain at least one special character (!@#$%^&*)";
    return null;
  };

  const passwordStrength = () => {
    const { password } = formData;
    let strength = 0;
    if (password.length >= 8) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[!@#$%^&*]/.test(password)) strength += 20;
    return strength;
  };

  const strengthLabel = () => {
    const strength = passwordStrength();
    if (strength <= 20) return { label: "Weak", color: "bg-destructive" };
    if (strength <= 40) return { label: "Fair", color: "bg-warning" };
    if (strength <= 60) return { label: "Good", color: "bg-accent" };
    return { label: "Strong", color: "bg-success" };
  };

  const handleNext = () => {
    if (currentStep === 1) {
      const email = formData.email.trim();
      if (!email) {
        toast.error("Email is required");
        return;
      }
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidEmail) {
        toast.error("Please enter a valid email address");
        return;
      }

      const passwordError = passwordValidationError();
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.firstName.trim()) {
        toast.error("First name is required");
        return;
      }
      if (!formData.lastName.trim()) {
        toast.error("Last name is required");
        return;
      }
    }

    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      handleNext();
      return;
    }

    if (!formData.termsAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    const passwordError = passwordValidationError();
    if (passwordError) {
      toast.error(passwordError);
      setCurrentStep(1);
      return;
    }

    setIsLoading(true);
    try {
      const user = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName || undefined,
      });

      toast.success("Account created");
      if (user?.emailVerified === false) {
        navigate("/email-verification", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Invoicy</span>
          </Link>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      currentStep >= step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-1 mx-2 rounded ${
                        currentStep > step.id ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of 3: {steps[currentStep - 1].name}
            </p>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {currentStep === 1 && "Create your account"}
              {currentStep === 2 && "Personal information"}
              {currentStep === 3 && "Company details"}
            </h1>
            <p className="text-muted-foreground">
              {currentStep === 1 && "Create your account to continue"}
              {currentStep === 2 && "Tell us about yourself"}
              {currentStep === 3 && "Help us personalize your experience"}
            </p>
          </div>

          {/* Social Login - Step 1 Only */}
          {null}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Account */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      className="pl-10 h-12 input-focus"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      className="pl-10 pr-10 h-12 input-focus"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Progress value={passwordStrength()} className="h-2 flex-1" />
                        <span className={`text-xs font-medium ${
                          strengthLabel().label === "Strong" ? "text-success" :
                          strengthLabel().label === "Good" ? "text-accent" :
                          strengthLabel().label === "Fair" ? "text-warning" :
                          "text-destructive"
                        }`}>
                          {strengthLabel().label}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {(() => {
                          const rules = passwordRules();
                          const items = [
                            { ok: rules.hasMinLength, label: "At least 8 characters" },
                            { ok: rules.hasUpperCase, label: "One uppercase letter" },
                            { ok: rules.hasLowerCase, label: "One lowercase letter" },
                            { ok: rules.hasNumber, label: "One number" },
                            { ok: rules.hasSpecialChar, label: "One special character (!@#$%^&*)" },
                          ];
                          return items.map((item) => (
                            <div
                              key={item.label}
                              className={`flex items-center gap-2 ${item.ok ? "text-success" : "text-muted-foreground"}`}
                            >
                              {item.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                              <span>{item.label}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Personal */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        className="pl-10 h-12 input-focus"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => updateFormData("lastName", e.target.value)}
                      className="h-12 input-focus"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Company */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Acme Inc."
                      value={formData.companyName}
                      onChange={(e) => updateFormData("companyName", e.target.value)}
                      className="pl-10 h-12 input-focus"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) => updateFormData("termsAccepted", checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" className="text-accent hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-accent hover:underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1 h-12">
                  Back
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1 h-12"
                size="lg"
                disabled={isLoading || (currentStep === 3 && !formData.termsAccepted)}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {currentStep < 3 ? "Continue" : "Create Account"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right Panel - Hero */}
      <div className="hidden lg:flex lg:flex-1 relative hero-gradient items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative z-10 text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-8">
              <FileText className="w-10 h-10 text-accent-foreground" />
            </div>
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">
              Get Started
              <br />
              <span className="text-accent">with Invoicy</span>
            </h2>
            <ul className="text-primary-foreground/80 space-y-3 text-left max-w-xs mx-auto">
              {[
                "Create and send invoices",
                "Manage clients",
                "Track payments",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
