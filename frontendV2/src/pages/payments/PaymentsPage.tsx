import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import apiClient, { Payment, PaymentMethod, PaymentStatus } from "@/lib/api-client";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatShortDate(date: string) {
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return date;
  }
}

function statusBadgeClass(status: PaymentStatus) {
  switch (status) {
    case "COMPLETED":
      return "paid";
    case "FAILED":
      return "overdue";
    case "PENDING":
    case "PROCESSING":
      return "sent";
    case "REFUNDED":
    case "CANCELLED":
    default:
      return "draft";
  }
}

const statusOptions: Array<{ value: "all" | PaymentStatus; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
];

const methodOptions: Array<{ value: "all" | PaymentMethod; label: string }> = [
  { value: "all", label: "All Methods" },
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "STRIPE", label: "Stripe" },
  { value: "CHECK", label: "Check" },
  { value: "OTHER", label: "Other" },
];

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | PaymentMethod>("all");
  const [page, setPage] = useState(1);

  const statusParam = statusFilter === "all" ? undefined : statusFilter;
  const methodParam = methodFilter === "all" ? undefined : methodFilter;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["payment-statistics"],
    queryFn: async () => apiClient.getPaymentStatistics(),
  });

  const {
    data: paymentsResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["payments", searchQuery, statusParam, methodParam, page],
    queryFn: async () =>
      apiClient.getPayments({
        search: searchQuery || undefined,
        status: statusParam,
        method: methodParam,
        page,
        limit: 20,
      }),
  });

  const payments = useMemo(() => paymentsResp?.items || [], [paymentsResp]);
  const totalPages = paymentsResp?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground">Track payments and receipts</p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Total Received</p>
                <p className="text-2xl font-bold text-foreground">
                  {statsLoading ? "..." : formatMoney(stats?.totalReceived ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-foreground">
                  {statsLoading ? "..." : formatMoney(stats?.monthlyReceived ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground">
                  {statsLoading ? "..." : String(stats?.pendingPayments ?? 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-foreground">
                  {statsLoading ? "..." : String(stats?.failedPayments ?? 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Card className="premium-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={(v) => {
                  setStatusFilter(v as "all" | PaymentStatus);
                  setPage(1);
                }}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={methodFilter} onValueChange={(v) => {
                  setMethodFilter(v as "all" | PaymentMethod);
                  setPage(1);
                }}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    {methodOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Payments</CardTitle>
            <div className="text-sm text-muted-foreground">
              {paymentsResp?.total ?? 0} total
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
            {isError && (
              <div className="text-sm text-destructive">
                Failed to load payments. {" "}
                <button className="underline" onClick={() => void refetch()}>
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !isError && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border">
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Payment</th>
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Invoice</th>
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Client</th>
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Method</th>
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Status</th>
                      <th className="text-left text-sm font-medium text-muted-foreground py-3 px-4">Date</th>
                      <th className="text-right text-sm font-medium text-muted-foreground py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: Payment) => {
                      const invoiceNumber = p.invoice?.invoiceNumber || "-";
                      const clientName = p.invoice?.client?.name || "-";
                      const currency = p.invoice?.currency || "USD";

                      return (
                        <tr key={p.id} className="border-b border-border/50 table-row-hover">
                          <td className="py-4 px-4 font-medium text-foreground">
                            {p.paymentNumber || p.transactionId || p.id.slice(0, 8)}
                            <div className="text-xs text-muted-foreground">
                              {formatMoney(p.amount, currency)}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-foreground">{invoiceNumber}</td>
                          <td className="py-4 px-4 text-foreground">{clientName}</td>
                          <td className="py-4 px-4 text-muted-foreground">{p.paymentMethod}</td>
                          <td className="py-4 px-4">
                            <span className={`status-badge status-${statusBadgeClass(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-muted-foreground">{formatShortDate(p.paymentDate)}</td>
                          <td className="py-4 px-4 text-right">
                            {p.invoiceId ? (
                              <Link to={`/invoices/${p.invoiceId}`}>
                                <Button variant="ghost" size="sm">
                                  View Invoice
                                  <ArrowUpRight className="w-4 h-4 ml-1" />
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {payments.length === 0 && (
                  <div className="pt-4 text-sm text-muted-foreground">No payments found.</div>
                )}

                {totalPages > 1 && (
                  <div className="pt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {paymentsResp?.page ?? 1} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
