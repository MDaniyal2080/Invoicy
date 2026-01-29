import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  Copy,
  Trash2,
  Printer,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";

function statusBadgeClass(status: string) {
  switch (status) {
    case "PAID":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "DRAFT":
      return "draft";
    case "SENT":
    case "VIEWED":
      return "sent";
    default:
      return "pending";
  }
}

function formatLongDate(date: string) {
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const v = value[key];
  return typeof v === "string" ? v : undefined;
}

function getNumberField(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const v = value[key];
  return typeof v === "number" ? v : undefined;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<
    "send" | "paid" | "pdf" | "print" | "duplicate" | "delete" | null
  >(null);

  const invoiceId = id || "";

  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invoice", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => apiClient.getInvoice(invoiceId),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      return apiClient.sendInvoice(invoiceId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    },
    onSettled: () => setActionLoading(null),
  });

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      const blob = await apiClient.downloadInvoicePdf(invoiceId);
      return blob;
    },
    onSuccess: async (blob) => {
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        toast.message("Pop-up blocked", {
          description: "Please allow pop-ups to print the invoice.",
        });
        return;
      }
      const tryPrint = () => {
        try {
          win.focus();
          win.print();
        } catch {
          // ignore
        }
      };
      win.addEventListener?.("load", tryPrint);
      setTimeout(tryPrint, 800);
      setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to print invoice");
    },
    onSettled: () => setActionLoading(null),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      return apiClient.duplicateInvoice(invoiceId);
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice duplicated");
      navigate(`/invoices/${created.id}`, { replace: true });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate invoice");
    },
    onSettled: () => setActionLoading(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      return apiClient.deleteInvoice(invoiceId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
      navigate("/invoices", { replace: true });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    },
    onSettled: () => setActionLoading(null),
  });

  const paidMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      return apiClient.markInvoicePaid(invoiceId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice marked as paid");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    },
    onSettled: () => setActionLoading(null),
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      return apiClient.downloadInvoicePdf(invoiceId);
    },
    onSuccess: async (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice?.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    },
    onSettled: () => setActionLoading(null),
  });

  const viewModel = useMemo(() => {
    if (!invoice) return null;
    const clientAddress = [
      invoice.client?.addressLine1,
      invoice.client?.addressLine2,
      [invoice.client?.city, invoice.client?.state].filter(Boolean).join(", "),
      [invoice.client?.country, invoice.client?.postalCode].filter(Boolean).join(" "),
    ]
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .join("\n");

    return {
      id: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: formatLongDate(invoice.invoiceDate),
      dueDate: formatLongDate(invoice.dueDate),
      paidDate: invoice.paidAt ? formatLongDate(invoice.paidAt) : undefined,
      client: {
        name: invoice.client?.name || "",
        email: invoice.client?.email || "",
        phone: invoice.client?.phone || "",
        address: clientAddress,
      },
      items: (invoice.items || []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
      })),
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      discount: invoice.discount,
      total: invoice.totalAmount,
      currency: invoice.currency,
      notes: invoice.notes,
      terms: invoice.terms,
      paymentHistory: (invoice.payments || []).map((p: unknown) => ({
        date: formatLongDate(getStringField(p, "paymentDate") || ""),
        amount: formatMoney(getNumberField(p, "amount") || 0, invoice.currency),
        method: getStringField(p, "paymentMethod") || "",
        status: getStringField(p, "status") || "",
      })),
      activity: (invoice.history || []).map((h: unknown) => ({
        date: formatLongDate(getStringField(h, "createdAt") || ""),
        action: getStringField(h, "description") || getStringField(h, "action") || "",
        user: getStringField(h, "performedBy") || "System",
      })),
    };
  }, [invoice]);

  return (
    <DashboardLayout>
      {isLoading && (
        <div className="p-6 text-sm text-muted-foreground">Loading...</div>
      )}
      {isError && (
        <div className="p-6 text-sm text-destructive">
          Failed to load invoice
        </div>
      )}
      {!isLoading && !isError && viewModel && (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/invoices">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  {viewModel.id}
                </h1>
                <span className={`status-badge status-${statusBadgeClass(viewModel.status)}`}>
                  {String(viewModel.status).replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-muted-foreground">
                Issued on {viewModel.issueDate}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActionLoading("print");
                printMutation.mutate();
              }}
              disabled={actionLoading !== null}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActionLoading("pdf");
                pdfMutation.mutate();
              }}
              disabled={actionLoading !== null}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setActionLoading("send");
                    sendMutation.mutate();
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Invoice
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/invoices/${invoiceId}/edit`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={duplicateMutation.isPending}
                  onSelect={(e) => {
                    e.preventDefault();
                    setActionLoading("duplicate");
                    duplicateMutation.mutate();
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setActionLoading("paid");
                    paidMutation.mutate();
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Paid
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={deleteMutation.isPending}
                  onSelect={(e) => {
                    e.preventDefault();
                    const ok = window.confirm("Delete this invoice?");
                    if (!ok) return;
                    setActionLoading("delete");
                    deleteMutation.mutate();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Invoice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <Card className="premium-card overflow-hidden">
              {/* Invoice Header */}
              <div className="bg-primary p-6 lg:p-8">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-primary-foreground">
                        Invoicy
                      </h2>
                      <p className="text-primary-foreground/70 text-sm">
                        Invoice Management
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-foreground">
                      INVOICE
                    </p>
                    <p className="text-primary-foreground/70">{viewModel.id}</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 lg:p-8 space-y-8">
                {/* Dates & Client */}
                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Bill To
                      </p>
                      <p className="font-semibold text-foreground text-lg">
                        {viewModel.client.name}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {viewModel.client.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {viewModel.client.phone || "-"}
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5" />
                        <span className="whitespace-pre-line">
                          {viewModel.client.address || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Date</span>
                      <span className="font-medium text-foreground">
                        {viewModel.issueDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due Date</span>
                      <span className="font-medium text-foreground">
                        {viewModel.dueDate}
                      </span>
                    </div>
                    {viewModel.paidDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid Date</span>
                        <span className="font-medium text-success">
                          {viewModel.paidDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-border">
                        <th className="text-left text-sm font-semibold text-foreground py-3">
                          Description
                        </th>
                        <th className="text-center text-sm font-semibold text-foreground py-3">
                          Qty
                        </th>
                        <th className="text-right text-sm font-semibold text-foreground py-3">
                          Rate
                        </th>
                        <th className="text-right text-sm font-semibold text-foreground py-3">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModel.items.map((item, index) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-4 text-foreground">
                            {item.description}
                          </td>
                          <td className="py-4 text-center text-muted-foreground">
                            {item.quantity}
                          </td>
                          <td className="py-4 text-right text-muted-foreground">
                            ${item.rate.toFixed(2)}
                          </td>
                          <td className="py-4 text-right font-medium text-foreground">
                            ${(Number(item.quantity) * Number(item.rate)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-64 space-y-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatMoney(viewModel.subtotal, viewModel.currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax ({viewModel.taxRate}%)</span>
                      <span>{formatMoney(viewModel.taxAmount, viewModel.currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount</span>
                      <span>-{formatMoney(viewModel.discount, viewModel.currency)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-accent">{formatMoney(viewModel.total, viewModel.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Terms */}
                {(viewModel.notes || viewModel.terms) && (
                  <div className="space-y-4 pt-6 border-t border-border">
                    {viewModel.notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Notes
                        </p>
                        <p className="text-foreground">{viewModel.notes}</p>
                      </div>
                    )}
                    {viewModel.terms && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Terms & Conditions
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {viewModel.terms}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle className="text-lg">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {viewModel.paymentHistory.length > 0 ? (
                    <div className="space-y-4">
                      {viewModel.paymentHistory.map((payment, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {payment.amount}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {payment.method}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No payments recorded yet
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle className="text-lg">Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {viewModel.activity.map((activity, index) => (
                      <div key={index} className="flex gap-3 relative">
                        {index < viewModel.activity.length - 1 && (
                          <div className="absolute left-[7px] top-5 w-0.5 h-full bg-border" />
                        )}
                        <div className="w-4 h-4 rounded-full bg-muted border-2 border-background z-10 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.date} • {activity.user}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}
