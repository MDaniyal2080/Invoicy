import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import EmailVerificationPage from "./pages/auth/EmailVerificationPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import InvoicesListPage from "./pages/invoices/InvoicesListPage";
import CreateInvoicePage from "./pages/invoices/CreateInvoicePage";
import InvoiceDetailPage from "./pages/invoices/InvoiceDetailPage";
import EditInvoicePage from "./pages/invoices/EditInvoicePage";
import ClientsPage from "./pages/clients/ClientsPage";
import CreateClientPage from "./pages/clients/CreateClientPage";
import ClientDetailPage from "./pages/clients/ClientDetailPage";
import EditClientPage from "./pages/clients/EditClientPage";
import PaymentsPage from "./pages/payments/PaymentsPage";
import ReportsPage from "./pages/reports/ReportsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUserDetailsPage from "./pages/admin/AdminUserDetailsPage";
import AdminGeneralSettingsPage from "./pages/admin/AdminGeneralSettingsPage";
import AdminEmailSettingsPage from "./pages/admin/AdminEmailSettingsPage";
import AdminPaymentConfigPage from "./pages/admin/AdminPaymentConfigPage";
import AdminBackupPage from "./pages/admin/AdminBackupPage";
import AdminMaintenancePage from "./pages/admin/AdminMaintenancePage";
import NotFound from "./pages/NotFound";

import PublicInvoicePage from "./pages/public/PublicInvoicePage";

import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/legal/TermsOfServicePage";
import CookiePolicyPage from "./pages/legal/CookiePolicyPage";

import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/cookie-policy" element={<CookiePolicyPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/public/invoices/:shareId" element={<PublicInvoicePage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/email-verification" element={<EmailVerificationPage />} />

              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices"
                element={
                  <RequireAuth>
                    <InvoicesListPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices/new"
                element={
                  <RequireAuth>
                    <CreateInvoicePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices/:id"
                element={
                  <RequireAuth>
                    <InvoiceDetailPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices/:id/edit"
                element={
                  <RequireAuth>
                    <EditInvoicePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/clients"
                element={
                  <RequireAuth>
                    <ClientsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/clients/new"
                element={
                  <RequireAuth>
                    <CreateClientPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/clients/:id"
                element={
                  <RequireAuth>
                    <ClientDetailPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/clients/:id/edit"
                element={
                  <RequireAuth>
                    <EditClientPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/payments"
                element={
                  <RequireAuth>
                    <PaymentsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <ReportsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <SettingsPage />
                  </RequireAuth>
                }
              />

              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminDashboardPage />
                  </RequireAdmin>
                }
              />

              <Route
                path="/admin/users/:id"
                element={
                  <RequireAdmin>
                    <AdminUserDetailsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/general"
                element={
                  <RequireAdmin>
                    <AdminGeneralSettingsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/email"
                element={
                  <RequireAdmin>
                    <AdminEmailSettingsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <RequireAdmin>
                    <AdminPaymentConfigPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/backup"
                element={
                  <RequireAdmin>
                    <AdminBackupPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/maintenance"
                element={
                  <RequireAdmin>
                    <AdminMaintenancePage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
