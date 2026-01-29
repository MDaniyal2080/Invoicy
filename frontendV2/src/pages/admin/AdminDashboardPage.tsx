import { useMemo, useState } from "react";
import { Users, Activity, FileText, DollarSign, Shield } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiClient from "@/lib/api-client";

function formatMoney(amount: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function AdminDashboardPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tabParam = searchParams.get("tab");
  const TABS = ["overview", "users", "activity", "errors"] as const;
  type Tab = (typeof TABS)[number];
  const isTab = (t: string | null): t is Tab => !!t && (TABS as readonly string[]).includes(t);
  const selectedTab: Tab = isTab(tabParam) ? tabParam : "overview";

  const [usersSearch, setUsersSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(10);

  const [activitySearch, setActivitySearch] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit, setActivityLimit] = useState(10);

  const [errorsSearch, setErrorsSearch] = useState("");
  const [errorsPage, setErrorsPage] = useState(1);
  const [errorsLimit, setErrorsLimit] = useState(10);
  const [clearOlderThanDays, setClearOlderThanDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiClient.getAdminDashboardStats(),
    enabled: selectedTab === "overview",
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { usersSearch, usersPage, usersLimit }],
    queryFn: () =>
      apiClient.getUsers({
        search: usersSearch || undefined,
        page: usersPage,
        limit: usersLimit,
      }),
    enabled: selectedTab === "users",
  });

  const activityQuery = useQuery({
    queryKey: ["admin", "activity", { activitySearch, activityPage, activityLimit }],
    queryFn: () =>
      apiClient.getActivityLogs({
        action: activitySearch || undefined,
        page: activityPage,
        limit: activityLimit,
      }),
    enabled: selectedTab === "activity",
  });

  const errorsQuery = useQuery({
    queryKey: ["admin", "errors", { errorsSearch, errorsPage, errorsLimit }],
    queryFn: () =>
      apiClient.getErrorLogs({
        search: errorsSearch || undefined,
        page: errorsPage,
        limit: errorsLimit,
      }),
    enabled: selectedTab === "errors",
  });

  const deleteErrorMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteErrorLog(id),
    onSuccess: async () => {
      toast.success("Error log deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "errors"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete log");
    },
  });

  const clearErrorsMutation = useMutation({
    mutationFn: () => apiClient.clearErrorLogs(clearOlderThanDays),
    onSuccess: async () => {
      toast.success("Error logs cleared");
      await queryClient.invalidateQueries({ queryKey: ["admin", "errors"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to clear logs");
    },
  });

  const cards = useMemo(() => {
    const totalRevenue = data?.totalRevenue ?? 0;
    return [
      { title: "Total Users", value: String(data?.totalUsers ?? 0), icon: Users },
      { title: "Active Users", value: String(data?.activeUsers ?? 0), icon: Activity },
      { title: "Total Invoices", value: String(data?.totalInvoices ?? 0), icon: FileText },
      { title: "Total Revenue", value: formatMoney(totalRevenue), icon: DollarSign },
    ];
  }, [data]);

  const renderPagination = (opts: {
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
  }) => (
    <div className="flex items-center justify-between gap-2 pt-4">
      <div className="text-xs text-muted-foreground">
        Page {opts.page} / {opts.totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={opts.onPrev} disabled={opts.page <= 1}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={opts.onNext}
          disabled={opts.page >= opts.totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );

  const renderUserStatus = (u: { isActive: boolean; emailVerified: boolean }) => {
    if (!u.isActive) return <Badge variant="destructive">Suspended</Badge>;
    if (!u.emailVerified) return <Badge variant="secondary">Unverified</Badge>;
    return <Badge>Active</Badge>;
  };

  const renderErrorLevel = (level: string) => {
    const l = (level || "").toUpperCase();
    if (l === "ERROR") return <Badge variant="destructive">ERROR</Badge>;
    if (l === "WARN" || l === "WARNING") return <Badge variant="secondary">WARN</Badge>;
    return <Badge variant="outline">{l || "LOG"}</Badge>;
  };

  const formatDateTime = (v: string) => {
    try {
      return new Date(v).toLocaleString();
    } catch {
      return v;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-accent" />
              Admin Panel
            </h1>
            <p className="text-muted-foreground mt-1">
              System-wide overview and management.
            </p>
          </div>
        </div>

        {selectedTab === "overview" ? (
          isLoading ? (
            <div className="text-sm text-muted-foreground">Loading admin dashboard...</div>
          ) : error ? (
            <div className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load admin dashboard"}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((c) => (
                  <Card key={c.title} className="hover-lift">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {c.title}
                      </CardTitle>
                      <c.icon className="h-4 w-4 text-accent" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{c.value}</div>
                      {c.title === "Total Users" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Total clients: {String(data?.totalClients ?? 0)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )
        ) : selectedTab === "users" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between pb-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={usersSearch}
                    onChange={(e) => {
                      setUsersSearch(e.target.value);
                      setUsersPage(1);
                    }}
                    placeholder="Search users..."
                    className="w-full md:w-80"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="1"
                    min={5}
                    max={50}
                    value={usersLimit}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(50, Number(e.target.value || 10)));
                      setUsersLimit(v);
                      setUsersPage(1);
                    }}
                    className="w-24"
                  />
                </div>
              </div>

              {usersQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading users...</div>
              ) : usersQuery.error ? (
                <div className="text-sm text-destructive">
                  {usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users"}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(usersQuery.data?.users || []).map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-foreground">{u.email}</TableCell>
                          <TableCell>
                            {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{u.role}</Badge>
                          </TableCell>
                          <TableCell>{renderUserStatus(u)}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/admin/users/${encodeURIComponent(u.id)}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(usersQuery.data?.users || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {renderPagination({
                    page: usersQuery.data?.pagination?.page || usersPage,
                    totalPages: usersQuery.data?.pagination?.totalPages || 1,
                    onPrev: () => setUsersPage((p) => Math.max(1, p - 1)),
                    onNext: () =>
                      setUsersPage((p) =>
                        Math.min(usersQuery.data?.pagination?.totalPages || p + 1, p + 1),
                      ),
                  })}
                </>
              )}
            </CardContent>
          </Card>
        ) : selectedTab === "activity" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between pb-4">
                <Input
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                  placeholder="Filter by action (e.g. LOGIN, INVOICE_CREATED)"
                  className="w-full md:w-96"
                />
                <Input
                  type="number"
                  step="1"
                  min={5}
                  max={50}
                  value={activityLimit}
                  onChange={(e) => {
                    const v = Math.max(5, Math.min(50, Number(e.target.value || 10)));
                    setActivityLimit(v);
                    setActivityPage(1);
                  }}
                  className="w-24"
                />
              </div>

              {activityQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading activity logs...</div>
              ) : activityQuery.error ? (
                <div className="text-sm text-destructive">
                  {activityQuery.error instanceof Error
                    ? activityQuery.error.message
                    : "Failed to load activity logs"}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activityQuery.data?.logs || []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap">{formatDateTime(l.createdAt)}</TableCell>
                          <TableCell className="text-foreground">
                            {l.user?.email || l.userId}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{l.action}</Badge>
                          </TableCell>
                          <TableCell>
                            {l.entity}{l.entityId ? `:${l.entityId}` : ""}
                          </TableCell>
                          <TableCell className="max-w-[420px] truncate">{l.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(activityQuery.data?.logs || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                            No activity logs found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {renderPagination({
                    page: activityQuery.data?.pagination?.page || activityPage,
                    totalPages: activityQuery.data?.pagination?.totalPages || 1,
                    onPrev: () => setActivityPage((p) => Math.max(1, p - 1)),
                    onNext: () =>
                      setActivityPage((p) =>
                        Math.min(activityQuery.data?.pagination?.totalPages || p + 1, p + 1),
                      ),
                  })}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Error Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between pb-4">
                <Input
                  value={errorsSearch}
                  onChange={(e) => {
                    setErrorsSearch(e.target.value);
                    setErrorsPage(1);
                  }}
                  placeholder="Search errors..."
                  className="w-full lg:w-96"
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="1"
                      min={1}
                      max={365}
                      value={clearOlderThanDays}
                      onChange={(e) => setClearOlderThanDays(Number(e.target.value || 30))}
                      className="w-24"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clearErrorsMutation.mutate()}
                      disabled={clearErrorsMutation.isPending}
                    >
                      {clearErrorsMutation.isPending ? "Clearing…" : "Clear Older"}
                    </Button>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min={5}
                    max={50}
                    value={errorsLimit}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(50, Number(e.target.value || 10)));
                      setErrorsLimit(v);
                      setErrorsPage(1);
                    }}
                    className="w-24"
                  />
                </div>
              </div>

              {errorsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading error logs...</div>
              ) : errorsQuery.error ? (
                <div className="text-sm text-destructive">
                  {errorsQuery.error instanceof Error ? errorsQuery.error.message : "Failed to load error logs"}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Request</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(errorsQuery.data?.logs || []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap">{formatDateTime(l.createdAt)}</TableCell>
                          <TableCell>{renderErrorLevel(l.level)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {(l.method || "").toUpperCase()} {l.path || ""}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {l.statusCode ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[420px] truncate">{l.message}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteErrorMutation.mutate(l.id)}
                              disabled={deleteErrorMutation.isPending}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(errorsQuery.data?.logs || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            No error logs found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {renderPagination({
                    page: errorsQuery.data?.pagination?.page || errorsPage,
                    totalPages: errorsQuery.data?.pagination?.totalPages || 1,
                    onPrev: () => setErrorsPage((p) => Math.max(1, p - 1)),
                    onNext: () =>
                      setErrorsPage((p) =>
                        Math.min(errorsQuery.data?.pagination?.totalPages || p + 1, p + 1),
                      ),
                  })}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
