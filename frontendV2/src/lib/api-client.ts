export type ApiErrorShape = {
  statusCode?: number;
  message?: string;
  code?: string;
  requiresVerification?: boolean;
};

export type ApiRequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: "json" | "blob";
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "/api";

const ACCESS_TOKEN_KEY = "access_token";

function setCookieToken(token: string, rememberMe?: boolean) {
  try {
    const isHttps = window.location.protocol === "https:";
    const secureAttr = isHttps ? "; Secure" : "";
    const maxAgeAttr = rememberMe ? "; Max-Age=2592000" : "";
    document.cookie = `access_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax${maxAgeAttr}${secureAttr}`;
  } catch {
    // ignore
  }
}

function clearCookieToken() {
  try {
    document.cookie = "access_token=; Path=/; Max-Age=0; SameSite=Lax";
  } catch {
    // ignore
  }
}

export function setAccessToken(token: string, rememberMe?: boolean) {
  if (rememberMe) {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
  setCookieToken(token, rememberMe);
}

export function getAccessToken(): string | null {
  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const localToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  return sessionToken || localToken;
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  clearCookieToken();
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      const text = await res.text();
      return text ? { message: text } : undefined;
    } catch {
      return undefined;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getMessageFromData(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (!isRecord(data)) return fallback;

  const msg = data.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (Array.isArray(msg)) {
    const parts = msg.filter((p): p is string => typeof p === "string");
    if (parts.length > 0) return parts.join(", ");
  }

  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

function getNumberField(data: unknown, key: string): number | undefined {
  if (!isRecord(data)) return undefined;
  const v = data[key];
  return typeof v === "number" ? v : undefined;
}

function getStringField(data: unknown, key: string): string | undefined {
  if (!isRecord(data)) return undefined;
  const v = data[key];
  return typeof v === "string" ? v : undefined;
}

function getBoolField(data: unknown, key: string): boolean | undefined {
  if (!isRecord(data)) return undefined;
  const v = data[key];
  return typeof v === "boolean" ? v : undefined;
}

function getCurrentPathWithQuery(): string {
  try {
    return `${window.location.pathname}${window.location.search}`;
  } catch {
    return "/";
  }
}

export async function apiRequest<T>(
  path: string,
  config: ApiRequestConfig = {},
): Promise<T> {
  const token = typeof window !== "undefined" ? getAccessToken() : null;
  const method = config.method || "GET";

  const headers: Record<string, string> = {
    ...(config.headers || {}),
  };

  if (config.responseType !== "blob") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body:
      config.body === undefined || method === "GET"
        ? undefined
        : JSON.stringify(config.body),
  });

  if (!res.ok) {
    const data: unknown = await parseJsonSafe(res);
    const err = new Error(
      getMessageFromData(data, res.statusText || "Request failed"),
    ) as Error & ApiErrorShape;

    err.statusCode = getNumberField(data, "statusCode") ?? res.status;
    err.code = getStringField(data, "code");
    err.requiresVerification = getBoolField(data, "requiresVerification");

    if (typeof window !== "undefined") {
      const redirect = encodeURIComponent(getCurrentPathWithQuery());

      if (err.statusCode === 401) {
        clearAccessToken();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = `/login?redirect=${redirect}`;
        }
      }

      if (err.statusCode === 403 && (err.code === "EMAIL_NOT_VERIFIED" || err.requiresVerification)) {
        if (!window.location.pathname.startsWith("/email-verification")) {
          window.location.href = "/email-verification";
        }
      }
    }

    throw err;
  }

  if (config.responseType === "blob") {
    return (await res.blob()) as unknown as T;
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyName?: string | null;
  emailVerified?: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified?: boolean;
  companyName?: string | null;
  companyLogo?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  taxNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserSettings = {
  invoicePrefix?: string | null;
  invoiceStartNumber?: number | null;
  currency?: string | null;
  taxRate?: number | null;
  paymentTerms?: number | null;
  invoiceNotes?: string | null;
  invoiceFooter?: string | null;
  emailNotificationsEnabled?: boolean | null;
  emailNotifyNewInvoice?: boolean | null;
  emailNotifyPaymentReceived?: boolean | null;
  emailNotifyInvoiceOverdue?: boolean | null;
  emailNotifyWeeklySummary?: boolean | null;
  emailNotifyNewClientAdded?: boolean | null;
  subscriptionPlan?: string | null;
  subscriptionEnd?: string | null;
  invoiceLimit?: number | null;
};

export type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxNumber?: string;
};

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type DiscountType = "FIXED" | "PERCENTAGE";

export type Client = {
  id: string;
  clientType?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  taxNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  isActive?: boolean;
  _count?: { invoices?: number };
  createdAt?: string;
  updatedAt?: string;
};

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  discountType: DiscountType;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  notes?: string | null;
  terms?: string | null;
  footer?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client: Client;
  items: InvoiceItem[];
  payments?: unknown[];
  history?: unknown[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type InvoiceStatistics = {
  total: number;
  paid: number;
  overdue: number;
  draft: number;
  totalRevenue: number;
  pendingAmount: number;
};

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "PAYPAL"
  | "STRIPE"
  | "CHECK"
  | "OTHER";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  netAmount?: number | null;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionId?: string | null;
  status: PaymentStatus;
  notes?: string | null;
  paymentNumber?: string | null;
  createdAt?: string;
  invoice?: Invoice;
};

export type PaymentStatistics = {
  totalReceived: number;
  monthlyReceived: number;
  pendingPayments: number;
  failedPayments: number;
};

export type StripeConnectStatus = {
  connected: boolean;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
};

export type AdminDashboardStats = {
  totalUsers: number;
  activeUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  totalClients: number;
  subscriptionStats?: Array<{ plan: string | null; count: number }>;
  monthlyGrowth?: Array<{ month: string; count: number }>;
  systemSettings?: Record<string, unknown>;
};

export type AdminPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  role: string;
  subscriptionPlan: string | null;
  subscriptionEnd: string | null;
  invoiceLimit: number | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  _count: { invoices: number; clients: number };
};

export type AdminGetUsersParams = {
  search?: string;
  role?: string;
  subscriptionPlan?: string;
  page?: number;
  limit?: number;
};

export type AdminGetUsersResponse = {
  users: AdminUser[];
  pagination: AdminPagination;
};

export type AdminUserDetailsResponse = {
  user: AdminUser;
  stats: {
    totalRevenue: number;
    paidInvoices: number;
    pendingInvoices: number;
    totalInvoices: number;
    totalClients: number;
  };
};

export type AdminActivityLog = {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  description?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { email: string; firstName: string | null; lastName: string | null };
};

export type AdminActivityLogsParams = {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

export type AdminActivityLogsResponse = {
  logs: AdminActivityLog[];
  pagination: AdminPagination;
};

export type AdminErrorLog = {
  id: string;
  level: string;
  message: string;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  userId?: string | null;
  context?: unknown;
  createdAt: string;
};

export type AdminErrorLogsParams = {
  search?: string;
  level?: string;
  statusCode?: number;
  method?: string;
  path?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

export type AdminErrorLogsResponse = {
  logs: AdminErrorLog[];
  pagination: AdminPagination;
};

export type AdminBackupStatus = {
  lastBackupAt: string | null;
  lastBackupId: string | null;
  lastBackupFile: string | null;
  maintenanceMode: boolean;
};

export type AdminRunBackupResponse = {
  success: boolean;
  backupId: string;
  file: string;
  createdAt: string;
};

export type AdminInvoiceStatistics = {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  monthlyRevenue?: Array<{ month: string; amount: number }>;
};

export type EmailTemplateType =
  | "invoice"
  | "payment-reminder"
  | "payment-received"
  | "password-reset"
  | "verify-email"
  | "welcome";

export type EmailTemplatePreview = { subject: string; html: string };

const apiClient = {
  async login(email: string, password: string, rememberMe?: boolean) {
    const res = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password, rememberMe },
    });
    if (res?.access_token) {
      setAccessToken(res.access_token, rememberMe);
    }
    return res;
  },

  async register(input: RegisterInput) {
    const res = await apiRequest<LoginResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
    if (res?.access_token) {
      setAccessToken(res.access_token);
    }
    return res;
  },

  async refresh() {
    return apiRequest<{ access_token: string }>("/auth/refresh", {
      method: "POST",
      body: {},
    });
  },

  async getMe() {
    return apiRequest<AuthUser>("/auth/me", { method: "GET" });
  },

  async getAdminDashboardStats() {
    return apiRequest<AdminDashboardStats>("/admin/dashboard", { method: "GET" });
  },

  async getAdminInvoiceStatistics() {
    return apiRequest<AdminInvoiceStatistics>("/admin/invoice-statistics", {
      method: "GET",
    });
  },

  async getUsers(params?: AdminGetUsersParams) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.role) query.set("role", params.role);
    if (params?.subscriptionPlan) query.set("subscriptionPlan", params.subscriptionPlan);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<AdminGetUsersResponse>(`/admin/users${qs ? `?${qs}` : ""}`, {
      method: "GET",
    });
  },

  async getUserDetails(id: string) {
    return apiRequest<AdminUserDetailsResponse>(`/admin/users/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  },

  async updateUser(id: string, data: {
    role?: string;
    subscriptionPlan?: string;
    subscriptionEnd?: string;
    invoiceLimit?: number;
    emailVerified?: boolean;
    isActive?: boolean;
  }) {
    return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: data,
    });
  },

  async suspendUser(id: string) {
    return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/suspend`, {
      method: "POST",
      body: {},
    });
  },

  async activateUser(id: string) {
    return apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}/activate`, {
      method: "POST",
      body: {},
    });
  },

  async deleteUser(id: string) {
    return apiRequest<{ message: string }>(`/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async resetUserPassword(id: string, newPassword: string) {
    return apiRequest<{ message: string }>(`/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: { newPassword },
    });
  },

  async getSystemSettings() {
    return apiRequest<Record<string, any>>("/admin/settings", { method: "GET" });
  },

  async updateSystemSettings(data: Record<string, any>) {
    return apiRequest<Record<string, any>>("/admin/settings", {
      method: "PUT",
      body: data,
    });
  },

  async testSmtp(overrides?: Record<string, unknown>) {
    return apiRequest<{ success: boolean; error?: string }>("/admin/settings/test-smtp", {
      method: "POST",
      body: overrides || {},
    });
  },

  async sendTestEmail(to: string, overrides?: Record<string, unknown>) {
    return apiRequest<{ success: boolean; messageId?: string }>("/admin/settings/test-email", {
      method: "POST",
      body: { to, overrides: overrides || {} },
    });
  },

  async sendTestInvoiceEmail(to: string, overrides?: Record<string, unknown>) {
    return apiRequest<{ success: boolean; messageId?: string }>("/admin/settings/test-invoice-email", {
      method: "POST",
      body: { to, overrides: overrides || {} },
    });
  },

  async previewEmailTemplate(type?: EmailTemplateType) {
    const query = new URLSearchParams();
    if (type) query.set("type", type);
    const qs = query.toString();
    return apiRequest<EmailTemplatePreview>(`/admin/settings/email-preview${qs ? `?${qs}` : ""}`, {
      method: "GET",
    });
  },

  async adminGetBackupStatus() {
    return apiRequest<AdminBackupStatus>("/admin/backup/status", { method: "GET" });
  },

  async adminRunBackup() {
    return apiRequest<AdminRunBackupResponse>("/admin/backup/run", {
      method: "POST",
      body: {},
    });
  },

  async adminSetMaintenance(enabled: boolean) {
    return apiRequest<{ maintenanceMode: boolean }>("/admin/maintenance", {
      method: "POST",
      body: { enabled },
    });
  },

  async getActivityLogs(params?: AdminActivityLogsParams) {
    const query = new URLSearchParams();
    if (params?.userId) query.set("userId", params.userId);
    if (params?.action) query.set("action", params.action);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<AdminActivityLogsResponse>(`/admin/activity-logs${qs ? `?${qs}` : ""}`, {
      method: "GET",
    });
  },

  async getErrorLogs(params?: AdminErrorLogsParams) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.level) query.set("level", params.level);
    if (params?.statusCode !== undefined) query.set("statusCode", String(params.statusCode));
    if (params?.method) query.set("method", params.method);
    if (params?.path) query.set("path", params.path);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<AdminErrorLogsResponse>(`/admin/error-logs${qs ? `?${qs}` : ""}`, {
      method: "GET",
    });
  },

  async deleteErrorLog(id: string) {
    return apiRequest<{ message: string }>(`/admin/error-logs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async clearErrorLogs(olderThanDays?: number) {
    const query = new URLSearchParams();
    if (olderThanDays !== undefined) query.set("olderThanDays", String(olderThanDays));
    const qs = query.toString();
    return apiRequest<{ message: string; count?: number }>(`/admin/error-logs${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },

  async getUserProfile() {
    return apiRequest<UserProfile>("/users/profile", { method: "GET" });
  },

  async updateUserProfile(input: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    taxNumber?: string;
    companyLogo?: string;
  }) {
    return apiRequest<UserProfile>("/users/profile", {
      method: "PUT",
      body: input,
    });
  },

  async getUserSettings() {
    return apiRequest<UserSettings>("/users/settings", { method: "GET" });
  },

  async updateUserSettings(input: {
    invoicePrefix?: string;
    invoiceStartNumber?: number;
    currency?: string;
    taxRate?: number;
    paymentTerms?: number;
    invoiceNotes?: string;
    invoiceFooter?: string;
    emailNotificationsEnabled?: boolean;
    emailNotifyNewInvoice?: boolean;
    emailNotifyPaymentReceived?: boolean;
    emailNotifyInvoiceOverdue?: boolean;
    emailNotifyWeeklySummary?: boolean;
    emailNotifyNewClientAdded?: boolean;
  }) {
    return apiRequest<UserSettings>("/users/settings", {
      method: "PUT",
      body: input,
    });
  },

  async resendVerification() {
    return apiRequest<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: {},
    });
  },

  async verifyEmail(token: string) {
    return apiRequest<{ message: string }>(
      `/auth/verify-email/${encodeURIComponent(token)}`,
      { method: "GET" },
    );
  },

  async forgotPassword(email: string) {
    return apiRequest<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  async resetPassword(token: string, newPassword: string) {
    return apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    });
  },

  logout() {
    clearAccessToken();
  },

  async getClients(params?: { search?: string; isActive?: boolean }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.isActive !== undefined) query.set("isActive", String(params.isActive));
    const qs = query.toString();
    return apiRequest<Client[]>(`/clients${qs ? `?${qs}` : ""}`);
  },

  async createClient(data: Omit<Client, "id"> & { name: string; email: string }) {
    return apiRequest<Client>("/clients", { method: "POST", body: data });
  },

  async getClient(id: string) {
    return apiRequest<Client>(`/clients/${encodeURIComponent(id)}`);
  },

  async updateClient(id: string, data: Partial<Omit<Client, "id" | "_count">>) {
    return apiRequest<Client>(`/clients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    });
  },

  async deleteClient(id: string) {
    return apiRequest<{ message: string }>(`/clients/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getClientInvoices(id: string) {
    return apiRequest<Invoice[]>(`/clients/${encodeURIComponent(id)}/invoices`);
  },

  async getInvoices(params?: {
    status?: InvoiceStatus;
    clientId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.clientId) query.set("clientId", params.clientId);
    if (params?.search) query.set("search", params.search);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortDir) query.set("sortDir", params.sortDir);
    const qs = query.toString();
    return apiRequest<Paginated<Invoice>>(`/invoices${qs ? `?${qs}` : ""}`);
  },

  async getInvoiceStatistics() {
    return apiRequest<InvoiceStatistics>("/invoices/statistics", { method: "GET" });
  },

  async deleteInvoice(id: string) {
    return apiRequest<{ message: string }>(`/invoices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async sendInvoicesBulk(ids: string[]) {
    return apiRequest<unknown>("/invoices/bulk/send", {
      method: "POST",
      body: { ids },
    });
  },

  async updateInvoicesStatusBulk(ids: string[], status: InvoiceStatus) {
    return apiRequest<unknown>("/invoices/bulk/status", {
      method: "POST",
      body: { ids, status },
    });
  },

  async markInvoicesPaidBulk(ids: string[]) {
    return apiRequest<unknown>("/invoices/bulk/mark-paid", {
      method: "POST",
      body: { ids },
    });
  },

  async deleteInvoicesBulk(ids: string[]) {
    return apiRequest<unknown>("/invoices/bulk/delete", {
      method: "POST",
      body: { ids },
    });
  },

  async getPaymentStatistics() {
    return apiRequest<PaymentStatistics>("/payments/statistics", { method: "GET" });
  },

  async stripeCreateConnectOnboarding() {
    return apiRequest<{ url: string }>("/payments/stripe/connect/onboarding", {
      method: "POST",
      body: {},
    });
  },

  async stripeGetConnectStatus() {
    return apiRequest<StripeConnectStatus>("/payments/stripe/connect/status", {
      method: "GET",
    });
  },

  async getPayments(params?: {
    invoiceId?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.invoiceId) query.set("invoiceId", params.invoiceId);
    if (params?.status) query.set("status", params.status);
    if (params?.method) query.set("method", params.method);
    if (params?.search) query.set("search", params.search);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<Paginated<Payment>>(`/payments${qs ? `?${qs}` : ""}`);
  },

  async getInvoice(id: string) {
    return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}`);
  },

  async createInvoice(data: {
    clientId: string;
    invoiceNumber?: string;
    invoiceDate?: string | Date;
    dueDate: string | Date;
    status?: InvoiceStatus;
    items: Array<{ description: string; quantity: number; rate: number }>;
    taxRate?: number;
    discount?: number;
    discountType?: DiscountType;
    currency?: string;
    notes?: string;
    terms?: string;
    footer?: string;
  }) {
    const normalizeDate = (d: string | Date) =>
      typeof d === "string" ? new Date(d).toISOString() : d.toISOString();

    return apiRequest<Invoice>("/invoices", {
      method: "POST",
      body: {
        ...data,
        invoiceDate: data.invoiceDate ? normalizeDate(data.invoiceDate) : undefined,
        dueDate: normalizeDate(data.dueDate),
      },
    });
  },

  async updateInvoice(
    id: string,
    data: {
      clientId?: string;
      invoiceNumber?: string;
      invoiceDate?: string | Date;
      dueDate?: string | Date;
      status?: InvoiceStatus;
      items?: Array<{ description: string; quantity: number; rate: number }>;
      taxRate?: number;
      discount?: number;
      discountType?: DiscountType;
      currency?: string;
      notes?: string;
      terms?: string;
      footer?: string;
    },
  ) {
    const normalizeDate = (d: string | Date) =>
      typeof d === "string" ? new Date(d).toISOString() : d.toISOString();

    return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        ...data,
        invoiceDate: data.invoiceDate ? normalizeDate(data.invoiceDate) : undefined,
        dueDate: data.dueDate ? normalizeDate(data.dueDate) : undefined,
      },
    });
  },

  async sendInvoice(id: string) {
    return apiRequest<unknown>(`/invoices/${encodeURIComponent(id)}/send`, {
      method: "POST",
      body: {},
    });
  },

  async markInvoicePaid(id: string) {
    return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status: "PAID" },
    });
  },

  async downloadInvoicePdf(id: string) {
    return apiRequest<Blob>(`/invoices/${encodeURIComponent(id)}/download`, {
      method: "GET",
      responseType: "blob",
    });
  },

  async duplicateInvoice(id: string) {
    return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: {},
    });
  },

  async getPublicInvoice(shareId: string) {
    return apiRequest<Invoice>(`/public/invoices/${encodeURIComponent(shareId)}`, {
      method: "GET",
    });
  },

  async createPublicInvoiceStripeCheckout(shareId: string) {
    return apiRequest<{ url: string }>(
      `/public/invoices/${encodeURIComponent(shareId)}/payments/stripe/checkout`,
      {
        method: "POST",
        body: {},
      },
    );
  },

  async verifyPublicInvoiceStripeCheckout(shareId: string, sessionId: string) {
    return apiRequest<unknown>(
      `/public/invoices/${encodeURIComponent(shareId)}/payments/stripe/verify`,
      {
        method: "POST",
        body: { sessionId },
      },
    );
  },
};

export default apiClient;
