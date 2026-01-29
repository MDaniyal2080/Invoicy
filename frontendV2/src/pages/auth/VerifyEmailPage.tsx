import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";
import apiClient from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { token: sessionToken, refreshMe, refreshToken } = useAuth();

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token");
        return;
      }
      if (ranRef.current) return;
      ranRef.current = true;

      setStatus("loading");
      try {
        const res = await apiClient.verifyEmail(token);
        setStatus("success");
        setMessage(res?.message || "Email verified successfully");

        if (sessionToken) {
          await refreshToken();
          await refreshMe();
          toast.success("Email verified");
          navigate("/dashboard", { replace: true });
        } else {
          toast.success("Email verified. Please sign in.");
        }
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Invalid or expired verification link");
      }
    };

    run();
  }, [token, navigate, sessionToken, refreshMe, refreshToken]);

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
            <h1 className="text-3xl font-bold text-foreground mb-2">Verify Email</h1>
            <p className="text-muted-foreground">
              {message || "Verifying your email, please wait..."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground flex items-center gap-3">
            {status === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : status === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : status === "error" ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5" />
            )}
            <span>
              {status === "success"
                ? "Email verified successfully."
                : status === "error"
                ? "We could not verify your email."
                : "Working on it…"}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <Link to="/login">
              <Button className="w-full h-12" size="lg">Go to sign in</Button>
            </Link>
            {status === "success" && (
              <Button variant="outline" className="w-full h-12" onClick={() => navigate("/dashboard")}>
                Continue to dashboard
              </Button>
            )}
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
