import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Send,
  Download,
  Trash2,
  FileText,
  Calendar,
  ArrowUpDown,
  CheckSquare,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { Invoice, InvoiceStatus } from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "VIEWED", label: "Viewed" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

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

function statusBadgeClass(status: InvoiceStatus) {
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
    case "PARTIALLY_PAID":
    case "CANCELLED":
    default:
      return "pending";
  }
}

function statusLabel(status: InvoiceStatus) {
  return String(status).replace(/_/g, " ");
}

export default function InvoicesListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"invoiceDate" | "totalAmount" | "createdAt">(
    "createdAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const queryClient = useQueryClient();

  const statusParam = (statusFilter === "all" ? undefined : statusFilter) as
    | InvoiceStatus
    | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", searchQuery, statusParam, page, sortBy, sortDir],
    queryFn: async () => {
      return apiClient.getInvoices({
        search: searchQuery || undefined,
        status: statusParam,
        page,
        limit: 20,
        sortBy,
        sortDir,
      });
    },
  });

  const bulkSend = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      return apiClient.sendInvoicesBulk(ids);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoices sent");
      setSelectedInvoices([]);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invoices");
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => apiClient.deleteInvoice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    },
  });

  const sendInvoice = useMutation({
    mutationFn: async (id: string) => apiClient.sendInvoice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    },
  });

  const downloadInvoice = useMutation({
    mutationFn: async (id: string) => apiClient.downloadInvoicePdf(id),
    onSuccess: async (blob, id) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    },
  });

  const exportSelectedCsv = () => {
    const rows = invoices.filter((i) => selectedInvoices.includes(i.id));
    if (rows.length === 0) {
      toast.message("No invoices selected");
      return;
    }

    const header = ["Invoice", "Client", "Client Email", "Amount", "Status", "Issue Date", "Due Date"];
    const escape = (v: string) => {
      const s = String(v ?? "");
      return `"${s.replaceAll('"', '""')}"`;
    };
    const lines = [
      header.map(escape).join(","),
      ...rows.map((r) =>
        [
          r.invoiceNumber,
          r.client,
          r.clientEmail,
          String(r.amount),
          String(r.status),
          r.issueDate,
          r.dueDate,
        ]
          .map(escape)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const invoices: Array<{
    id: string;
    invoiceNumber: string;
    client: string;
    clientEmail: string;
    amount: number;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
  }> = (data?.items || []).map((inv: Invoice) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    client: inv.client?.name || "",
    clientEmail: inv.client?.email || "",
    amount: inv.totalAmount,
    status: inv.status,
    issueDate: formatShortDate(inv.invoiceDate),
    dueDate: formatShortDate(inv.dueDate),
  }));

  const toggleSelect = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map((i) => i.id));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground">
              Manage and track all your invoices
            </p>
          </div>
          <Link to="/invoices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="premium-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                    setSelectedInvoices([]);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                    setSelectedInvoices([]);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedInvoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-accent" />
              <span className="font-medium text-foreground">
                {selectedInvoices.length} invoice(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkSend.isPending}
                onClick={() => bulkSend.mutate(selectedInvoices)}
              >
                <Send className="w-4 h-4 mr-2" />
                {bulkSend.isPending ? "Sending..." : "Send"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportSelectedCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoices([])}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Invoices Table */}
        <Card className="premium-card overflow-hidden">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4">
                    <Checkbox
                      checked={
                        selectedInvoices.length === invoices.length &&
                        invoices.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-4 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => {
                        setSelectedInvoices([]);
                        setPage(1);
                        if (sortBy === "invoiceDate") {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortBy("invoiceDate");
                          setSortDir("desc");
                        }
                      }}
                    >
                      Invoice
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-4 px-4">
                    Client
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-4 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => {
                        setSelectedInvoices([]);
                        setPage(1);
                        if (sortBy === "totalAmount") {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortBy("totalAmount");
                          setSortDir("desc");
                        }
                      }}
                    >
                      Amount
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-4 px-4">
                    Status
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-4 px-4">
                    Due Date
                  </th>
                  <th className="text-right text-sm font-medium text-muted-foreground py-4 px-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-foreground">{invoice.client}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-foreground">${invoice.amount.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`status-badge status-${statusBadgeClass(invoice.status)}`}>
                        {statusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{invoice.issueDate}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{invoice.dueDate}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/invoices/${invoice.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/invoices/${invoice.id}/edit`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={sendInvoice.isPending}
                            onSelect={(e) => {
                              e.preventDefault();
                              sendInvoice.mutate(invoice.id);
                            }}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={downloadInvoice.isPending}
                            onSelect={(e) => {
                              e.preventDefault();
                              downloadInvoice.mutate(invoice.id);
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={deleteInvoice.isPending}
                            onSelect={(e) => {
                              e.preventDefault();
                              const ok = window.confirm("Delete this invoice?");
                              if (!ok) return;
                              deleteInvoice.mutate(invoice.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && invoices.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No invoices found.
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first invoice to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Link to="/invoices/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {invoices.length > 0 && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {invoices.length} of {total || invoices.length} invoices
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setSelectedInvoices([]);
                    setPage((p) => Math.max(1, p - 1));
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setSelectedInvoices([]);
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
