import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";

export function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  const redirect = encodeURIComponent(`${location.pathname}${location.search}`);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!token) {
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/email-verification" replace />;
  }

  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
