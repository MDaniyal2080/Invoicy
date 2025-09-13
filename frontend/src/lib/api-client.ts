import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { Invoice, CreateInvoiceInput } from '@/types/invoice';
import type { RecurringInvoice, CreateRecurringInvoiceInput } from '@/types/recurring-invoice'
import { useUIStore } from '@/lib/stores/ui-store';
import type { Client, CreateClientInput, UpdateClientInput, GetClientsParams } from '@/types/client'
import { ensurePaginated, normalizeList } from '@/lib/utils/response'
import { getErrorCode } from '@/lib/utils'

// Users/Profile DTOs (minimal to avoid explicit any)
type UpdateProfileInput = Partial<{
  firstName: string
  lastName: string
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  taxNumber?: string
}>

type UpdateUserSettingsInput = Partial<{
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  taxNumber?: string
  invoicePrefix?: string
  invoiceStartNumber?: number
  paymentTerms?: number
  invoiceNotes?: string
  invoiceFooter?: string
  currency?: string
  taxRate?: number
  // Notification preferences
  emailNotificationsEnabled?: boolean
  emailNotifyNewInvoice?: boolean
  emailNotifyPaymentReceived?: boolean
  emailNotifyInvoiceOverdue?: boolean
  emailNotifyWeeklySummary?: boolean
  emailNotifyNewClientAdded?: boolean
}>

type PaginationParams = { page?: number; limit?: number }
type CommonQueryParams = Record<string, string | number | boolean | undefined>
type AdminGetUsersParams = { search?: string } & PaginationParams
type ActivityLogsParams = PaginationParams
type ErrorLogsParams = { search?: string; level?: string; method?: string; path?: string; statusCode?: number } & PaginationParams

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      // Prevent hanging requests (can be overridden via per-request config)
      timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15000),
    });

    // Request interceptor to add token
    this.client.interceptors.request.use(
      (config) => {
        // Begin global loading on client
        if (typeof window !== 'undefined') {
          try { useUIStore.getState().startLoading() } catch {}
        }
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        if (typeof window !== 'undefined') {
          try { useUIStore.getState().stopLoading() } catch {}
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // End global loading on client
        if (typeof window !== 'undefined') {
          try { useUIStore.getState().stopLoading() } catch {}
        }
        return response;
      },
      async (error: AxiosError) => {
        // End global loading on client
        if (typeof window !== 'undefined') {
          try { useUIStore.getState().stopLoading() } catch {}
        }
        if (error.response?.status === 403) {
          const code = getErrorCode(error)
          if (code === 'EMAIL_NOT_VERIFIED') {
            if (typeof window !== 'undefined' &&
              !window.location.pathname.startsWith('/email-verification') &&
              !window.location.pathname.startsWith('/verify-email')) {
              window.location.href = '/email-verification'
            }
          }
        }
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          this.clearToken();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string, rememberMe?: boolean) {
    this.token = token;
    if (typeof window !== 'undefined') {
      // Store in sessionStorage when rememberMe is false, otherwise localStorage
      if (rememberMe) {
        sessionStorage.removeItem('access_token');
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
        sessionStorage.setItem('access_token', token);
      }

      // Also sync to a cookie so Next.js middleware can protect routes on the server edge
      // Use non-HttpOnly cookie (set by client) with SameSite=Lax
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const secureAttr = isHttps ? '; Secure' : '';
      const maxAgeAttr = rememberMe ? '; Max-Age=2592000' : ''; // 30 days
      document.cookie = `access_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax${maxAgeAttr}${secureAttr}`;
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      // Prefer sessionStorage when present (non-remembered sessions)
      const sessionToken = sessionStorage.getItem('access_token');
      const localToken = localStorage.getItem('access_token');
      this.token = sessionToken || localToken;

      // If we have a token but middleware cookie is missing (e.g., after hard refresh), resync it
      if (this.token) {
        try {
          const hasCookie = document.cookie.split('; ').some((c) => c.startsWith('access_token='));
          if (!hasCookie) {
            const remember = !!(localToken && !sessionToken);
            this.setToken(this.token, remember);
          }
        } catch {
          // no-op if document.cookie not accessible
        }
      }
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      sessionStorage.removeItem('access_token');
      // Clear cookie for middleware
      document.cookie = 'access_token=; Path=/; Max-Age=0; SameSite=Lax';
    }
  }

  // Auth endpoints
  async login(email: string, password: string, rememberMe?: boolean) {
    const response = await this.client.post('/auth/login', { email, password, rememberMe });
    if (response.data.access_token) {
      this.setToken(response.data.access_token, rememberMe);
    }
    return response.data;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    taxNumber?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    if (response.data.access_token) {
      this.setToken(response.data.access_token);
    }
    return response.data;
  }

  async logout() {
    this.clearToken();
    return { success: true };
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.client.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }

  async verifyEmail(token: string) {
    const response = await this.client.get(`/auth/verify-email/${token}`);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }

  async resendVerification() {
    const response = await this.client.post('/auth/resend-verification');
    return response.data;
  }

  // Users endpoints
  async getProfile() {
    const response = await this.client.get('/users/profile');
    return response.data;
  }

  async updateProfile(data: UpdateProfileInput) {
    const response = await this.client.put('/users/profile', data);
    return response.data;
  }

  async getUserSettings() {
    const response = await this.client.get('/users/settings');
    return response.data;
  }

  async updateUserSettings(data: UpdateUserSettingsInput) {
    const response = await this.client.put('/users/settings', data);
    return response.data;
  }

  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/users/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Mock billing endpoints
  async upgradePlanMock(plan?: 'BASIC' | 'PREMIUM') {
    const response = await this.client.post('/users/upgrade-mock', plan ? { plan } : {});
    return response.data as { subscriptionPlan: string; subscriptionEnd: string | null; invoiceLimit: number; message?: string };
  }

  async downgradeToFreeMock() {
    const response = await this.client.post('/users/downgrade-mock');
    return response.data as { subscriptionPlan: string; subscriptionEnd: string | null; invoiceLimit: number; message?: string };
  }

  // Clients endpoints
  async getClients(
    params?: GetClientsParams
  ): Promise<Client[]> {
    const response = await this.client.get('/clients', { params });
    return normalizeList<Client>(response.data);
  }

  async getClientsPaginated(
    params?: GetClientsParams
  ) {
    const response = await this.client.get('/clients', { params });
    return ensurePaginated<Client>(response.data);
  }

  async getClient(id: string): Promise<Client> {
    const response = await this.client.get(`/clients/${id}`);
    return response.data as Client;
  }

  async createClient(data: CreateClientInput): Promise<Client> {
    const response = await this.client.post('/clients', data);
    return response.data as Client;
  }

  async updateClient(id: string, data: UpdateClientInput): Promise<Client> {
    const response = await this.client.patch(`/clients/${id}`, data);
    return response.data as Client;
  }

  async deleteClient(id: string): Promise<{ success?: boolean } | unknown> {
    const response = await this.client.delete(`/clients/${id}`);
    return response.data;
  }

  // Invoices endpoints
  async getInvoices(
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<Invoice[] | { items: Invoice[]; total: number; totalPages: number; page: number; limit: number }> {
    const response = await this.client.get('/invoices', { params });
    return response.data;
  }

  async getInvoice(id: string): Promise<Invoice> {
    const response = await this.client.get(`/invoices/${id}`);
    return response.data as Invoice;
  }

  async createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
    const response = await this.client.post('/invoices', data);
    return response.data as Invoice;
  }

  async updateInvoice(id: string, data: Partial<CreateInvoiceInput>): Promise<Invoice> {
    const response = await this.client.patch(`/invoices/${id}`, data);
    return response.data as Invoice;
  }

  async deleteInvoice(id: string): Promise<{ success?: boolean } | unknown> {
    const response = await this.client.delete(`/invoices/${id}`);
    return response.data;
  }

  async sendInvoicesBulk(ids: string[]): Promise<{ summary: { totalRequested: number; sent: number; skipped: number; failed: number; notFound: number }; results: Array<{ id: string; status: 'sent' | 'skipped' | 'failed' | 'not_found'; message?: string }> }>
  {
    const response = await this.client.post('/invoices/bulk/send', { ids });
    return response.data;
  }

  async updateInvoicesStatusBulk(ids: string[], status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED') {
    const response = await this.client.post('/invoices/bulk/status', { ids, status });
    return response.data as { summary: { totalRequested: number; updated: number; notFound: number } };
  }

  async markInvoicesPaidBulk(ids: string[]) {
    const response = await this.client.post('/invoices/bulk/mark-paid', { ids });
    return response.data as { summary: { totalRequested: number; updated: number; notFound: number } };
  }

  async deleteInvoicesBulk(ids: string[]) {
    const response = await this.client.post('/invoices/bulk/delete', { ids });
    return response.data as { summary: { totalRequested: number; deleted: number; skipped: number; notFound: number } };
  }

  async sendInvoice(id: string): Promise<unknown> {
    const response = await this.client.post(`/invoices/${id}/send`);
    return response.data;
  }

  async downloadInvoicePDF(
    id: string,
    opts?: { 
      template?: string; 
      color?: string; 
      accentColor?: string;
      headerBorderColor?: string;
      tableHeaderColor?: string;
      font?: string; 
      layout?: string; 
      footer?: string;
      pageSize?: string;
      margins?: string;
      watermarkText?: string;
      showSignature?: boolean;
      customFields?: Record<string, string>;
      logoSize?: string;
      headerStyle?: string;
    }
  ): Promise<Blob> {
    const response = await this.client.get(`/invoices/${id}/download`, {
      responseType: 'blob',
      params: opts ? {
        template: opts.template,
        color: opts.color,
        accentColor: opts.accentColor,
        headerBorderColor: opts.headerBorderColor,
        tableHeaderColor: opts.tableHeaderColor,
        font: opts.font,
        layout: opts.layout,
        footer: opts.footer,
        pageSize: opts.pageSize,
        margins: opts.margins,
        watermarkText: opts.watermarkText,
        showSignature: opts.showSignature,
        customFields: opts.customFields ? JSON.stringify(opts.customFields) : undefined,
        logoSize: opts.logoSize,
        headerStyle: opts.headerStyle,
      } : undefined,
    });
    return response.data as Blob;
  }

  async previewInvoicePDF(
    id: string,
    opts?: { 
      template?: string; 
      color?: string; 
      accentColor?: string;
      headerBorderColor?: string;
      tableHeaderColor?: string;
      font?: string; 
      layout?: string; 
      footer?: string;
      pageSize?: string;
      margins?: string;
      watermarkText?: string;
      showSignature?: boolean;
      customFields?: Record<string, string>;
      logoSize?: string;
      headerStyle?: string;
    }
  ): Promise<string> {
    const blob = await this.downloadInvoicePDF(id, opts);
    return URL.createObjectURL(blob);
  }

  async markInvoiceAsPaid(id: string): Promise<Invoice> {
    const response = await this.client.patch(`/invoices/${id}/status`, { status: 'PAID' });
    return response.data as Invoice;
  }

  async duplicateInvoice(id: string): Promise<Invoice> {
    const response = await this.client.post(`/invoices/${id}/duplicate`);
    return response.data as Invoice;
  }

  async cancelInvoice(id: string): Promise<Invoice> {
    const response = await this.client.post(`/invoices/${id}/cancel`);
    return response.data as Invoice;
  }

  // Invoice share endpoints
  async updateInvoiceShare(id: string, enable: boolean) {
    const response = await this.client.patch(`/invoices/${id}/share`, { enable });
    return response.data as { id: string; shareId: string; shareEnabled: boolean };
  }

  async regenerateInvoiceShare(id: string) {
    const response = await this.client.post(`/invoices/${id}/share/regenerate`);
    return response.data as { id: string; shareId: string; shareEnabled: boolean };
  }

  // Recurring Invoices endpoints
  async getRecurringInvoices(
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<
    RecurringInvoice[] | { items: RecurringInvoice[]; total: number; totalPages: number; page: number; limit: number }
  > {
    const response = await this.client.get('/recurring-invoices', { params });
    return response.data;
  }

  async getRecurringInvoice(id: string): Promise<RecurringInvoice> {
    const response = await this.client.get(`/recurring-invoices/${id}`);
    return response.data as RecurringInvoice;
  }

  async createRecurringInvoice(data: CreateRecurringInvoiceInput): Promise<RecurringInvoice> {
    const response = await this.client.post('/recurring-invoices', data);
    return response.data as RecurringInvoice;
  }

  async updateRecurringInvoice(id: string, data: Partial<CreateRecurringInvoiceInput>): Promise<RecurringInvoice> {
    const response = await this.client.patch(`/recurring-invoices/${id}`, data);
    return response.data as RecurringInvoice;
  }

  async deleteRecurringInvoice(id: string): Promise<{ success?: boolean } | unknown> {
    const response = await this.client.delete(`/recurring-invoices/${id}`);
    return response.data;
  }

  async pauseRecurringInvoice(id: string): Promise<RecurringInvoice> {
    const response = await this.client.post(`/recurring-invoices/${id}/pause`);
    return response.data as RecurringInvoice;
  }

  async resumeRecurringInvoice(id: string): Promise<RecurringInvoice> {
    const response = await this.client.post(`/recurring-invoices/${id}/resume`);
    return response.data as RecurringInvoice;
  }

  async cancelRecurringInvoice(id: string): Promise<RecurringInvoice> {
    const response = await this.client.post(`/recurring-invoices/${id}/cancel`);
    return response.data as RecurringInvoice;
  }

  async runNowRecurringInvoice(id: string): Promise<Invoice> {
    const response = await this.client.post(`/recurring-invoices/${id}/run-now`);
    return response.data as Invoice;
  }

  async processDueRecurringInvoices(): Promise<unknown> {
    const response = await this.client.post('/recurring-invoices/process-due');
    return response.data;
  }

  // Public invoices endpoints
  async getPublicInvoice(shareId: string): Promise<Invoice> {
    const response = await this.client.get(`/public/invoices/${shareId}`);
    return response.data as Invoice;
  }

  // Public payments endpoints (no auth)
  async recordPublicPayment(
    shareId: string,
    data: {
      amount: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'STRIPE' | 'CHECK' | 'OTHER';
      paymentDate?: Date | string;
      transactionId?: string;
      notes?: string;
    }
  ) {
    const response = await this.client.post(`/public/invoices/${shareId}/payments/record`, data);
    return response.data;
  }

  async processPublicPayment(
    shareId: string,
    data: {
      amount: number;
      paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'CASH' | 'DEBIT_CARD' | 'CHECK' | 'OTHER';
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      bankAccount?: string;
      notes?: string;
    }
  ) {
    const response = await this.client.post(`/public/invoices/${shareId}/payments/process`, data);
    return response.data;
  }

  // Payments endpoints (mock)
  async getPayments(params?: CommonQueryParams) {
    const response = await this.client.get('/payments', { params });
    return response.data;
  }

  async getPayment(id: string) {
    const response = await this.client.get(`/payments/${id}`);
    return response.data;
  }

  async recordPayment(data: {
    invoiceId: string;
    amount: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'STRIPE' | 'CHECK' | 'OTHER';
    paymentDate?: Date | string;
    transactionId?: string;
    notes?: string;
  }) {
    const response = await this.client.post('/payments/record', data);
    return response.data;
  }

  async processPayment(data: {
    invoiceId: string;
    amount: number;
    paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'CASH' | 'DEBIT_CARD' | 'CHECK' | 'OTHER';
    cardNumber?: string;
    cardExpiry?: string;
    cardCvv?: string;
    bankAccount?: string;
    notes?: string;
  }) {
    const response = await this.client.post('/payments/process', data);
    return response.data;
  }

  async getPaymentStatistics() {
    const response = await this.client.get('/payments/statistics');
    return response.data as { totalReceived: number; monthlyReceived: number; pendingPayments: number; failedPayments: number };
  }

  async refundPayment(id: string, amount?: number) {
    const response = await this.client.post(`/payments/${id}/refund`, typeof amount === 'number' ? { amount } : {});
    return response.data;
  }

  // Stripe: SaaS subscription (admin-configured platform Stripe)
  async stripeCreateSubscriptionCheckout(
    plan: 'BASIC' | 'PREMIUM',
    opts?: { force?: boolean }
  ): Promise<{ url: string }> {
    const payload: any = { plan }
    if (opts?.force) payload.force = true
    const response = await this.client.post('/payments/stripe/subscription/checkout', payload)
    return response.data as { url: string }
  }

  async stripeCreateBillingPortal(): Promise<{ url: string }> {
    const response = await this.client.post('/payments/stripe/subscription/portal')
    return response.data as { url: string }
  }

  async stripeSyncSubscription(): Promise<{ subscriptionPlan: string; subscriptionEnd: string | null; invoiceLimit: number }> {
    const response = await this.client.post('/payments/stripe/subscription/sync')
    return response.data as { subscriptionPlan: string; subscriptionEnd: string | null; invoiceLimit: number }
  }

  // Stripe Connect: per-user payments for invoice collection
  async stripeCreateConnectOnboarding(): Promise<{ url: string }> {
    const response = await this.client.post('/payments/stripe/connect/onboarding')
    return response.data as { url: string }
  }

  async stripeGetConnectStatus(): Promise<{ connected: boolean; detailsSubmitted?: boolean; chargesEnabled?: boolean }> {
    const response = await this.client.get('/payments/stripe/connect/status')
    return response.data as { connected: boolean; detailsSubmitted?: boolean; chargesEnabled?: boolean }
  }

  // Public invoice: Create Stripe Checkout for invoice payment
  async createPublicInvoiceStripeCheckout(shareId: string): Promise<{ url: string }> {
    const response = await this.client.post(`/public/invoices/${shareId}/payments/stripe/checkout`)
    return response.data as { url: string }
  }

  async verifyPublicInvoiceStripeCheckout(shareId: string, sessionId: string): Promise<{ processed: 'created' | 'exists'; status: string; paidAmount: number; balanceDue: number }>
  {
    const response = await this.client.post(`/public/invoices/${shareId}/payments/stripe/verify`, { sessionId })
    return response.data as { processed: 'created' | 'exists'; status: string; paidAmount: number; balanceDue: number }
  }

  // Analytics endpoints
  async getDashboardStats() {
    const response = await this.client.get('/analytics/dashboard');
    return response.data;
  }

  async getRevenueStats(params?: CommonQueryParams) {
    const response = await this.client.get('/analytics/revenue', { params });
    return response.data;
  }

  async getInvoiceStats(params?: CommonQueryParams) {
    const response = await this.client.get('/analytics/invoices', { params });
    return response.data;
  }

  async getClientStats(params?: CommonQueryParams) {
    const response = await this.client.get('/analytics/clients', { params });
    return response.data;
  }

  // Admin endpoints
  async getAdminStats() {
    const response = await this.client.get('/admin/dashboard');
    return response.data;
  }

  async getUsers(params?: AdminGetUsersParams) {
    const response = await this.client.get('/admin/users', { params });
    return response.data;
  }

  async getUserDetails(id: string) {
    const response = await this.client.get(`/admin/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/admin/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.client.delete(`/admin/users/${id}`);
    return response.data;
  }

  async activateUser(id: string) {
    const response = await this.client.post(`/admin/users/${id}/activate`);
    return response.data;
  }

  async suspendUser(id: string) {
    const response = await this.client.post(`/admin/users/${id}/suspend`);
    return response.data;
  }

  async resetUserPassword(id: string, newPassword: string) {
    const response = await this.client.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  }

  async getSystemSettings() {
    const response = await this.client.get('/admin/settings');
    return response.data;
  }

  async updateSystemSettings(data: Record<string, unknown>) {
    const response = await this.client.put('/admin/settings', data);
    return response.data;
  }

  // Admin SMTP testing
  async testSmtp(overrides?: Record<string, unknown>) {
    const response = await this.client.post('/admin/settings/test-smtp', overrides || {});
    return response.data as { success: boolean; error?: string };
  }

  async sendTestEmail(to: string, overrides?: Record<string, unknown>) {
    const response = await this.client.post('/admin/settings/test-email', { to, overrides: overrides || {} });
    return response.data as { success: boolean; messageId?: string };
  }

  async sendTestInvoiceEmail(to: string, overrides?: Record<string, unknown>) {
    const response = await this.client.post('/admin/settings/test-invoice-email', { to, overrides: overrides || {} });
    return response.data as { success: boolean; messageId?: string };
  }

  async previewEmailTemplate(type?: 'invoice' | 'payment-reminder' | 'payment-received' | 'password-reset' | 'verify-email' | 'welcome') {
    const response = await this.client.get('/admin/settings/email-preview', { params: { type } });
    return response.data as { subject: string; html: string };
  }

  // Public config (no auth)
  async getPublicConfig() {
    const response = await this.client.get('/config/public');
    return response.data as { siteName: string; timezone: string; defaultCurrency: string; allowRegistration: boolean; maxUploadMB: number };
  }

  // Admin: Backup & Maintenance
  async adminGetBackupStatus() {
    const response = await this.client.get('/admin/backup/status');
    return response.data as { lastBackupAt: string | null; lastBackupId: string | null; lastBackupFile: string | null; maintenanceMode: boolean };
  }

  async adminRunBackup() {
    const response = await this.client.post('/admin/backup/run');
    return response.data as { success: boolean; backupId: string; file: string; createdAt: string };
  }

  async adminSetMaintenance(enabled: boolean) {
    const response = await this.client.post('/admin/maintenance', { enabled });
    return response.data as { maintenanceMode: boolean };
  }

  // Activity logs
  async getActivityLogs(params?: ActivityLogsParams) {
    const response = await this.client.get('/admin/activity-logs', { params });
    return response.data;
  }

  // Error logs
  async getErrorLogs(params?: ErrorLogsParams) {
    const response = await this.client.get('/admin/error-logs', { params });
    return response.data;
  }

  async deleteErrorLog(id: string) {
    const response = await this.client.delete(`/admin/error-logs/${id}`);
    return response.data;
  }

  async clearErrorLogs(olderThanDays?: number) {
    const response = await this.client.delete('/admin/error-logs', {
      params: olderThanDays ? { olderThanDays } : {},
    });
    return response.data;
  }

  async getAdminInvoiceStatistics() {
    const response = await this.client.get('/admin/invoice-statistics');
    return response.data;
  }

  // Generic request method
  async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }
}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;

// Export class for testing
export { ApiClient };
