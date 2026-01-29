import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Trash2, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { Invoice, InvoiceStatus } from "@/lib/api-client";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
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

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clientId = id || "";

  const {
    data: client,
    isLoading: clientLoading,
    isError: clientError,
  } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId,
    queryFn: async () => apiClient.getClient(clientId),
  });

  const {
    data: invoices,
    isLoading: invoicesLoading,
    isError: invoicesError,
  } = useQuery({
    queryKey: ["client-invoices", clientId],
    enabled: !!clientId,
    queryFn: async () => apiClient.getClientInvoices(clientId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Missing client id");
      return apiClient.deleteClient(clientId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
      navigate("/clients", { replace: true });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    },
  });

  const initials = useMemo(() => {
    return getInitials(client?.name || "");
  }, [client?.name]);

  const address = useMemo(() => {
    if (!client) return "";
    const parts = [
      client.addressLine1,
      client.addressLine2,
      [client.city, client.state].filter(Boolean).join(", "),
      [client.country, client.postalCode].filter(Boolean).join(" "),
    ]
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .join("\n");
    return parts;
  }, [client]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/clients">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                {clientLoading ? "Loading..." : client?.name || "Client"}
              </h1>
              <p className="text-muted-foreground">Client profile and invoices</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={clientId ? `/clients/${clientId}/edit` : "/clients"}>
              <Button variant="outline" disabled={!clientId || clientLoading}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !clientId || clientLoading}
              onClick={() => {
                const ok = window.confirm(
                  "Delete this client? This is not allowed if the client has invoices.",
                );
                if (!ok) return;
                deleteMutation.mutate();
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {clientError && (
          <div className="text-sm text-destructive">Failed to load client.</div>
        )}

        {!clientLoading && !clientError && client && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {initials || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-foreground font-medium">{client.email}</p>
                      <p className="text-sm text-muted-foreground mt-3">Phone</p>
                      <p className="text-foreground">{client.phone || "-"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="text-foreground">{client.companyName || "-"}</p>
                    <p className="text-sm text-muted-foreground mt-3">Address</p>
                    <pre className="text-sm text-foreground whitespace-pre-wrap leading-5">
                      {address || "-"}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="premium-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Invoices</CardTitle>
              <Link to="/invoices/new">
                <Button size="sm" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  New Invoice
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoicesLoading && (
                <div className="text-sm text-muted-foreground">Loading invoices...</div>
              )}
              {invoicesError && (
                <div className="text-sm text-destructive">Failed to load invoices.</div>
              )}

              {!invoicesLoading && !invoicesError && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Invoice
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Status
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Amount
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Date
                        </th>
                        <th className="text-right text-sm font-medium text-muted-foreground py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoices || []).slice(0, 10).map((inv: Invoice) => (
                        <tr key={inv.id} className="border-b border-border/50 table-row-hover">
                          <td className="py-4 font-medium text-foreground">{inv.invoiceNumber}</td>
                          <td className="py-4">
                            <span className={`status-badge status-${statusBadgeClass(inv.status)}`}>
                              {String(inv.status).replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-4 text-foreground">
                            {inv.totalAmount.toLocaleString(undefined, {
                              style: "currency",
                              currency: inv.currency,
                            })}
                          </td>
                          <td className="py-4 text-muted-foreground">{formatShortDate(inv.invoiceDate)}</td>
                          <td className="py-4 text-right">
                            <Link to={`/invoices/${inv.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!invoicesLoading && (invoices || []).length === 0 && (
                    <div className="pt-4 text-sm text-muted-foreground">
                      No invoices for this client yet.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
