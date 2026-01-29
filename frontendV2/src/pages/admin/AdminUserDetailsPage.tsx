import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import apiClient, { AdminUser } from "@/lib/api-client";

function toDateInputValue(v: string | null | undefined) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function fromDateInputValue(v: string) {
  if (!v) return null;
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

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

export default function AdminUserDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [edit, setEdit] = useState<{
    role: string;
    subscriptionPlan: string;
    subscriptionEnd: string;
    invoiceLimit: string;
    emailVerified: boolean;
    isActive: boolean;
  } | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const userId = id || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => apiClient.getUserDetails(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!data?.user) return;
    setEdit({
      role: data.user.role,
      subscriptionPlan: String(data.user.subscriptionPlan || "FREE"),
      subscriptionEnd: toDateInputValue(data.user.subscriptionEnd),
      invoiceLimit: data.user.invoiceLimit === null || data.user.invoiceLimit === undefined ? "" : String(data.user.invoiceLimit),
      emailVerified: !!data.user.emailVerified,
      isActive: !!data.user.isActive,
    });
  }, [data?.user]);

  const statusBadge = useMemo(() => {
    const u = data?.user;
    if (!u) return null;

    if (!u.isActive) return <Badge variant="destructive">Suspended</Badge>;
    if (!u.emailVerified) return <Badge variant="secondary">Unverified</Badge>;
    return <Badge>Active</Badge>;
  }, [data?.user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!edit) throw new Error("Edit state not loaded");
      const payload: Partial<AdminUser> & {
        subscriptionEnd?: string | null;
        invoiceLimit?: number;
      } = {
        role: edit.role,
        subscriptionPlan: edit.subscriptionPlan || "FREE",
        subscriptionEnd: fromDateInputValue(edit.subscriptionEnd),
        emailVerified: edit.emailVerified,
        isActive: edit.isActive,
      };

      const invoiceLimitRaw = Number(edit.invoiceLimit);
      if (edit.invoiceLimit.trim() && Number.isFinite(invoiceLimitRaw) && invoiceLimitRaw >= 0) {
        payload.invoiceLimit = invoiceLimitRaw;
      }

      return apiClient.updateUser(userId, payload as any);
    },
    onSuccess: async () => {
      toast.success("User updated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Update failed");
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => apiClient.suspendUser(userId),
    onSuccess: async () => {
      toast.success("User suspended");
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Suspend failed"),
  });

  const activateMutation = useMutation({
    mutationFn: async () => apiClient.activateUser(userId),
    onSuccess: async () => {
      toast.success("User activated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Activate failed"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const pass = newPassword.trim();
      if (pass.length < 8) throw new Error("Password must be at least 8 characters");
      return apiClient.resetUserPassword(userId, pass);
    },
    onSuccess: async () => {
      toast.success("Password reset successfully");
      setNewPassword("");
      setResetOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Reset password failed"),
  });

  const saving = saveMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">User Details</h1>
              {statusBadge}
            </div>
            <p className="text-muted-foreground mt-1">Manage roles, plan, and account status.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/admin?tab=users")}>Back to users</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!edit || saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading user...</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load user"}
          </div>
        ) : data?.user && edit ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Profile</CardTitle>
                  <CardDescription>Basic identity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium text-foreground">{data.user.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    <span className="font-medium text-foreground">
                      {[data.user.firstName, data.user.lastName].filter(Boolean).join(" ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Company:</span>{" "}
                    <span className="font-medium text-foreground">{data.user.companyName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    <span className="font-medium text-foreground">
                      {new Date(data.user.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last login:</span>{" "}
                    <span className="font-medium text-foreground">
                      {data.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString() : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Stats</CardTitle>
                  <CardDescription>Usage summary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground">Total Revenue</div>
                      <div className="text-lg font-semibold text-foreground">{formatMoney(data.stats.totalRevenue || 0)}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground">Invoices</div>
                      <div className="text-lg font-semibold text-foreground">{data.stats.totalInvoices || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground">Clients</div>
                      <div className="text-lg font-semibold text-foreground">{data.stats.totalClients || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground">Paid</div>
                      <div className="text-lg font-semibold text-foreground">{data.stats.paidInvoices || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground">Pending</div>
                      <div className="text-lg font-semibold text-foreground">{data.stats.pendingInvoices || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Admin Controls</CardTitle>
                <CardDescription>Role, plan and account status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={edit.role} onValueChange={(val) => setEdit({ ...edit, role: val })}>
                      <SelectTrigger id="role" className="mt-2 w-full" aria-label="Role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">USER</SelectItem>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subscriptionPlan">Plan</Label>
                    <Select
                      value={edit.subscriptionPlan}
                      onValueChange={(val) =>
                        setEdit({
                          ...edit,
                          subscriptionPlan: val,
                          subscriptionEnd: val === "FREE" ? "" : edit.subscriptionEnd,
                        })
                      }
                    >
                      <SelectTrigger id="subscriptionPlan" className="mt-2 w-full" aria-label="Plan">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="BASIC">BASIC</SelectItem>
                        <SelectItem value="PREMIUM">PREMIUM</SelectItem>
                        <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subscriptionEnd">Plan End</Label>
                    <Input
                      id="subscriptionEnd"
                      className="mt-2"
                      type="date"
                      value={edit.subscriptionEnd}
                      onChange={(e) => setEdit({ ...edit, subscriptionEnd: e.target.value })}
                      disabled={edit.subscriptionPlan === "FREE"}
                    />
                  </div>

                  <div>
                    <Label htmlFor="invoiceLimit">Invoice Limit (0 = unlimited)</Label>
                    <Input
                      id="invoiceLimit"
                      className="mt-2"
                      type="number"
                      step="1"
                      value={edit.invoiceLimit}
                      onChange={(e) => setEdit({ ...edit, invoiceLimit: e.target.value })}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="emailVerified"
                      checked={edit.emailVerified}
                      onCheckedChange={(v) => setEdit({ ...edit, emailVerified: !!v })}
                    />
                    <Label htmlFor="emailVerified">Email Verified</Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="isActive"
                      checked={edit.isActive}
                      onCheckedChange={(v) => setEdit({ ...edit, isActive: !!v })}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {data.user.isActive ? (
                    <Button
                      variant="destructive"
                      disabled={suspendMutation.isPending}
                      onClick={() => suspendMutation.mutate()}
                    >
                      {suspendMutation.isPending ? "Suspending…" : "Suspend User"}
                    </Button>
                  ) : (
                    <Button disabled={activateMutation.isPending} onClick={() => activateMutation.mutate()}>
                      {activateMutation.isPending ? "Activating…" : "Activate User"}
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => setResetOpen(true)}>
                    Reset Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Password</DialogTitle>
                  <DialogDescription>Set a new password for this user.</DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setResetOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => resetPasswordMutation.mutate()}
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? "Resetting…" : "Reset"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
