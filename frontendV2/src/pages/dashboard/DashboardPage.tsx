import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  FileText,
  Users,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MoreVertical,
  Eye,
  Send,
  Download,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { Invoice } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "@/components/ui/sonner";

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

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const ts = d.getTime();
  if (!Number.isFinite(ts)) return iso;

  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function monthKey(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short" });
}

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

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const sendInvoiceMutation = useMutation({
    mutationFn: async (args: { id: string }) => apiClient.sendInvoice(args.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-recent-invoices"] });
      toast.success("Invoice sent");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    },
  });

  const downloadInvoiceMutation = useMutation({
    mutationFn: async (args: { id: string; invoiceNumber?: string }) => {
      const blob = await apiClient.downloadInvoicePdf(args.id);
      return { blob, invoiceNumber: args.invoiceNumber, id: args.id };
    },
    onSuccess: async ({ blob, invoiceNumber, id }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber || `invoice-${id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["invoice-statistics"],
    queryFn: async () => apiClient.getInvoiceStatistics(),
  });

  const { data: recentInvoicesResp, isLoading: invoicesLoading } = useQuery({
    queryKey: ["dashboard-recent-invoices"],
    queryFn: async () =>
      apiClient.getInvoices({
        page: 1,
        limit: 50,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
  });

  const recentInvoices = useMemo(() => {
    const items = recentInvoicesResp?.items || [];
    return items.slice(0, 5);
  }, [recentInvoicesResp]);

  const recentActivity = useMemo(() => {
    type ActivityType = "payment" | "sent" | "created" | "reminder";
    type ActivityItem = {
      type: ActivityType;
      message: string;
      time: string;
      amount?: string;
      ts: number;
    };

    const all = recentInvoicesResp?.items || [];
    const events: ActivityItem[] = [];

    for (const inv of all) {
      const clientName = inv.client?.name || "client";

      if (inv.paidAt) {
        const ts = new Date(inv.paidAt).getTime();
        if (Number.isFinite(ts)) {
          events.push({
            type: "payment",
            message: `Payment received for ${inv.invoiceNumber} from ${clientName}`,
            time: formatRelativeTime(inv.paidAt),
            amount: formatMoney(inv.totalAmount, inv.currency),
            ts,
          });
        }
      }

      if (inv.sentAt) {
        const ts = new Date(inv.sentAt).getTime();
        if (Number.isFinite(ts)) {
          events.push({
            type: "sent",
            message: `Invoice ${inv.invoiceNumber} sent to ${clientName}`,
            time: formatRelativeTime(inv.sentAt),
            ts,
          });
        }
      }

      const createdAt = inv.createdAt || inv.invoiceDate;
      if (createdAt) {
        const ts = new Date(createdAt).getTime();
        if (Number.isFinite(ts)) {
          events.push({
            type: "created",
            message: `New invoice ${inv.invoiceNumber} created`,
            time: formatRelativeTime(createdAt),
            ts,
          });
        }
      }

      if (inv.status === "OVERDUE") {
        const overdueAt = inv.dueDate;
        const ts = new Date(overdueAt).getTime();
        if (Number.isFinite(ts)) {
          events.push({
            type: "reminder",
            message: `Invoice ${inv.invoiceNumber} is overdue (${clientName})`,
            time: formatRelativeTime(overdueAt),
            ts,
          });
        }
      }
    }

    events.sort((a, b) => b.ts - a.ts);
    return events.slice(0, 5);
  }, [recentInvoicesResp]);

  const currency = useMemo(() => {
    return recentInvoices[0]?.currency || "USD";
  }, [recentInvoices]);

  const revenueData = useMemo(() => {
    const now = new Date();
    const months: Array<{ name: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ name: monthKey(d), revenue: 0 });
    }

    const all = recentInvoicesResp?.items || [];
    for (const inv of all) {
      if (inv.status !== "PAID") continue;
      const d = new Date(inv.invoiceDate);
      const idx = months.findIndex(
        (m, j) =>
          monthKey(new Date(now.getFullYear(), now.getMonth() - (5 - j), 1)) ===
          monthKey(d),
      );
      if (idx >= 0) months[idx].revenue += inv.totalAmount;
    }

    return months;
  }, [recentInvoicesResp]);

  const invoiceStatusData = useMemo(() => {
    const total = stats?.total || 0;
    const paid = stats?.paid || 0;
    const overdue = stats?.overdue || 0;
    const draft = stats?.draft || 0;
    const pending = Math.max(0, total - paid - overdue - draft);

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return [
      { name: "Paid", value: pct(paid), color: "hsl(152, 60%, 40%)" },
      { name: "Pending", value: pct(pending), color: "hsl(38, 92%, 50%)" },
      { name: "Overdue", value: pct(overdue), color: "hsl(0, 72%, 51%)" },
      { name: "Draft", value: pct(draft), color: "hsl(210, 20%, 65%)" },
    ];
  }, [stats]);

  const statCards = useMemo(() => {
    const totalRevenue = stats?.totalRevenue ?? 0;
    const pendingAmount = stats?.pendingAmount ?? 0;
    const overdueCount = stats?.overdue ?? 0;
    const paidCount = stats?.paid ?? 0;
    const draftCount = stats?.draft ?? 0;

    return [
      {
        title: "Total Revenue",
        value: formatMoney(totalRevenue, currency),
        change: "-",
        changeType: "positive",
        icon: DollarSign,
        description: "Paid invoices",
      },
      {
        title: "Outstanding",
        value: formatMoney(pendingAmount, currency),
        change: "-",
        changeType: "negative",
        icon: FileText,
        description: `${Math.max(0, (stats?.total || 0) - paidCount - draftCount)} invoices`,
      },
      {
        title: "Paid",
        value: String(paidCount),
        change: "-",
        changeType: "positive",
        icon: TrendingUp,
        description: "Invoices",
      },
      {
        title: "Overdue",
        value: String(overdueCount),
        change: "-",
        changeType: "negative",
        icon: AlertCircle,
        description: "Invoices",
      },
    ];
  }, [stats, currency]);

  const greetingName = user?.firstName || user?.email || "";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back{greetingName ? `, ${greetingName}` : ""}! Here's your business overview.</p>
          </div>
          <Link to="/invoices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="stat-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {stat.title}
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground">
                        {statsLoading ? "..." : stat.value}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`flex items-center text-xs font-medium ${
                            stat.changeType === "positive"
                              ? "text-success"
                              : "text-destructive"
                          }`}
                        >
                          {stat.changeType === "positive" ? (
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 mr-0.5" />
                          )}
                          {stat.change}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stat.description}
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="premium-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Revenue Overview</CardTitle>
                <select className="text-sm bg-muted/50 rounded-lg px-3 py-1.5 border-0 focus:ring-2 focus:ring-accent">
                  <option>Last 6 months</option>
                  <option>Last year</option>
                  <option>All time</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => `$${value / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(175, 60%, 40%)"
                        strokeWidth={3}
                        dot={{ fill: "hsl(175, 60%, 40%)", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "hsl(175, 60%, 40%)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Invoice Status Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="premium-card h-full">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Invoice Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={invoiceStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {invoiceStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`${value}%`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {invoiceStatusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.name} ({item.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Invoices & Activity */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2"
          >
            <Card className="premium-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Recent Invoices</CardTitle>
                <Link to="/invoices">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Invoice
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Client
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Amount
                        </th>
                        <th className="text-left text-sm font-medium text-muted-foreground py-3">
                          Status
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
                      {recentInvoices.map((invoice: Invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-border/50 table-row-hover"
                        >
                          <td className="py-4">
                            <span className="font-medium text-foreground">
                              {invoice.invoiceNumber}
                            </span>
                          </td>
                          <td className="py-4 text-foreground">{invoice.client?.name || "-"}</td>
                          <td className="py-4 font-medium text-foreground">
                            {formatMoney(invoice.totalAmount, invoice.currency)}
                          </td>
                          <td className="py-4">
                            <span className={`status-badge status-${statusBadgeClass(invoice.status)}`}>
                              {String(invoice.status).replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-4 text-muted-foreground">{formatShortDate(invoice.invoiceDate)}</td>
                          <td className="py-4 text-right">
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
                                <DropdownMenuItem
                                  disabled={sendInvoiceMutation.isPending}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    sendInvoiceMutation.mutate({ id: invoice.id });
                                  }}
                                >
                                  <Send className="w-4 h-4 mr-2" />
                                  Send
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={downloadInvoiceMutation.isPending}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    downloadInvoiceMutation.mutate({
                                      id: invoice.id,
                                      invoiceNumber: invoice.invoiceNumber,
                                    });
                                  }}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invoicesLoading && (
                  <div className="pt-4 text-sm text-muted-foreground">Loading invoices...</div>
                )}
                {!invoicesLoading && recentInvoices.length === 0 && (
                  <div className="pt-4 text-sm text-muted-foreground">No invoices yet.</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="premium-card h-full">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={`${activity.type}-${activity.ts}-${index}`} className="flex gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 ${
                          activity.type === "payment"
                            ? "bg-success"
                            : activity.type === "sent"
                            ? "bg-accent"
                            : activity.type === "reminder"
                            ? "bg-warning"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.message}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {activity.time}
                          </span>
                          {activity.amount && (
                            <span className="text-xs font-medium text-success">
                              {activity.amount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {invoicesLoading && recentActivity.length === 0 && (
                    <div className="pt-2 text-sm text-muted-foreground">Loading activity...</div>
                  )}
                  {!invoicesLoading && recentActivity.length === 0 && (
                    <div className="pt-2 text-sm text-muted-foreground">No recent activity.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
