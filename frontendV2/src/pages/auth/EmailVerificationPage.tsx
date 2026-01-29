import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, RefreshCw, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";
import apiClient from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";

export default function EmailVerificationPage() {
  const navigate = useNavigate();
  const { token, user, logout, refreshMe, refreshToken, loading } = useAuth();

  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!loading && !token) {
      navigate("/login", { replace: true });
    }
  }, [token, loading, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleResend = async () => {
    try {
      setResending(true);
      await apiClient.resendVerification();
      toast.success("Verification email queued");
      setCountdown(60);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  const handleIHaveVerified = async () => {
    try {
      const me = await refreshMe();
      if (me?.emailVerified) {
        await refreshToken();
        await refreshMe();
        toast.success("Email verified");
        navigate("/dashboard", { replace: true });
        return;
      }
      toast.message("Not verified yet", {
        description: "We still cannot confirm your email. Please try again in a moment.",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to check status");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Invoicy</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Verify your email</h1>
            <p className="text-muted-foreground">
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{user?.email || "your email address"}</span>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
            <div>Please check your inbox and click the verification link.</div>
            <div className="mt-1 text-xs text-muted-foreground">Don&apos;t forget to check your spam folder.</div>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              onClick={handleResend}
              disabled={resending || countdown > 0}
              className="w-full h-12"
              size="lg"
            >
              {resending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button variant="outline" onClick={handleIHaveVerified} className="w-full h-12">
              I&apos;ve verified my email
            </Button>

            <Button variant="outline" onClick={handleLogout} className="w-full h-12">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </motion.div>
      </div>

      <div className="hidden lg:flex lg:flex-1 relative hero-gradient items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>
    </div>
  );
}
