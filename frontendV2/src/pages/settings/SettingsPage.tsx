import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Building2, Bell, FileText, CreditCard } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();
  const [searchParams] = useSearchParams();

  const validTabs = useMemo(
    () => ["profile", "company", "invoices", "notifications", "billing"],
    [],
  );
  const [activeTab, setActiveTab] = useState<string>("profile");

  useEffect(() => {
    const tabParam = (searchParams.get("tab") || "").toLowerCase();
    setActiveTab(validTabs.includes(tabParam) ? tabParam : "profile");
  }, [searchParams, validTabs]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => apiClient.getUserProfile(),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => apiClient.getUserSettings(),
  });

  const {
    data: connectStatus,
    refetch: refetchConnectStatus,
    isFetching: connectStatusLoading,
  } = useQuery({
    queryKey: ["stripe-connect-status"],
    queryFn: async () => apiClient.stripeGetConnectStatus(),
    retry: false,
  });

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
  });

  const [companyForm, setCompanyForm] = useState({
    companyName: "",
    companyPhone: "",
    taxNumber: "",
    companyAddress: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    invoicePrefix: "",
    invoiceStartNumber: "",
    paymentTerms: "",
    taxRate: "",
  });

  const [notificationsForm, setNotificationsForm] = useState({
    paymentReceived: true,
    invoiceOverdue: true,
    newClientAdded: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
    });
    setCompanyForm({
      companyName: profile.companyName || "",
      companyPhone: profile.companyPhone || "",
      taxNumber: profile.taxNumber || "",
      companyAddress: profile.companyAddress || "",
    });
  }, [profile]);

  useEffect(() => {
    if (!settings) return;
    setInvoiceForm({
      invoicePrefix: settings.invoicePrefix ? String(settings.invoicePrefix) : "",
      invoiceStartNumber:
        settings.invoiceStartNumber === null || settings.invoiceStartNumber === undefined
          ? ""
          : String(settings.invoiceStartNumber),
      paymentTerms:
        settings.paymentTerms === null || settings.paymentTerms === undefined
          ? ""
          : String(settings.paymentTerms),
      taxRate:
        settings.taxRate === null || settings.taxRate === undefined
          ? ""
          : String(settings.taxRate),
    });
    setNotificationsForm({
      paymentReceived: settings.emailNotifyPaymentReceived ?? true,
      invoiceOverdue: settings.emailNotifyInvoiceOverdue ?? true,
      newClientAdded: settings.emailNotifyNewClientAdded ?? true,
    });
  }, [settings]);

  const initials = useMemo(() => {
    const a = (profile?.firstName || "").trim().slice(0, 1).toUpperCase();
    const b = (profile?.lastName || "").trim().slice(0, 1).toUpperCase();
    const v = `${a}${b}`.trim();
    return v || "U";
  }, [profile?.firstName, profile?.lastName]);

  const updateProfile = useMutation({
    mutationFn: async (input: {
      firstName?: string;
      lastName?: string;
      companyName?: string;
      companyAddress?: string;
      companyPhone?: string;
      taxNumber?: string;
    }) => apiClient.updateUserProfile(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      await refreshMe();
      toast.success("Saved");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    },
  });

  const connectStripe = useMutation({
    mutationFn: async () => apiClient.stripeCreateConnectOnboarding(),
    onSuccess: (res: { url: string }) => {
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error("Could not start Stripe onboarding");
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to start Stripe onboarding";
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (activeTab !== "billing") return;
    const connect = searchParams.get("connect");
    if (!connect) return;
    void refetchConnectStatus();
  }, [activeTab, searchParams, refetchConnectStatus]);

  const updateSettings = useMutation({
    mutationFn: async (input: {
      invoicePrefix?: string;
      invoiceStartNumber?: number;
      paymentTerms?: number;
      taxRate?: number;
      emailNotifyPaymentReceived?: boolean;
      emailNotifyInvoiceOverdue?: boolean;
      emailNotifyNewClientAdded?: boolean;
    }) => apiClient.updateUserSettings(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Saved");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    },
  });

  const changePassword = useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) =>
      apiClient.changePassword(input.currentPassword, input.newPassword),
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg);
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile"><User className="w-4 h-4 mr-2 hidden sm:inline" />Profile</TabsTrigger>
            <TabsTrigger value="company"><Building2 className="w-4 h-4 mr-2 hidden sm:inline" />Company</TabsTrigger>
            <TabsTrigger value="invoices"><FileText className="w-4 h-4 mr-2 hidden sm:inline" />Invoices</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2 hidden sm:inline" />Alerts</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="w-4 h-4 mr-2 hidden sm:inline" />Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="premium-card">
                <CardHeader><CardTitle>Profile Information</CardTitle><CardDescription>Update your personal details</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20"><AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback></Avatar>
                    <div><Button variant="outline">Change Photo</Button><p className="text-xs text-muted-foreground mt-2">JPG, PNG up to 5MB</p></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>First Name</Label><Input value={profileForm.firstName} onChange={(e) => setProfileForm((s) => ({ ...s, firstName: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                    <div className="space-y-2"><Label>Last Name</Label><Input value={profileForm.lastName} onChange={(e) => setProfileForm((s) => ({ ...s, lastName: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                    <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={profile?.email || ""} className="input-focus" disabled /></div>
                  </div>
                  <Button
                    disabled={profileLoading || updateProfile.isPending}
                    onClick={() => updateProfile.mutate({ firstName: profileForm.firstName, lastName: profileForm.lastName })}
                  >
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
              <Card className="premium-card">
                <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Current Password</Label><Input type="password" className="input-focus" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((s) => ({ ...s, currentPassword: e.target.value }))} disabled={changePassword.isPending} /></div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>New Password</Label><Input type="password" className="input-focus" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((s) => ({ ...s, newPassword: e.target.value }))} disabled={changePassword.isPending} /></div>
                    <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" className="input-focus" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((s) => ({ ...s, confirmPassword: e.target.value }))} disabled={changePassword.isPending} /></div>
                  </div>
                  <Button
                    disabled={changePassword.isPending || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                    onClick={() => changePassword.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })}
                  >
                    Update Password
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="company">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="premium-card">
                <CardHeader><CardTitle>Company Details</CardTitle><CardDescription>Information displayed on invoices</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Company Name</Label><Input value={companyForm.companyName} onChange={(e) => setCompanyForm((s) => ({ ...s, companyName: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Phone</Label><Input value={companyForm.companyPhone} onChange={(e) => setCompanyForm((s) => ({ ...s, companyPhone: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                    <div className="space-y-2"><Label>Tax ID</Label><Input value={companyForm.taxNumber} onChange={(e) => setCompanyForm((s) => ({ ...s, taxNumber: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input value={companyForm.companyAddress} onChange={(e) => setCompanyForm((s) => ({ ...s, companyAddress: e.target.value }))} className="input-focus" disabled={profileLoading || updateProfile.isPending} /></div>
                  <Button
                    disabled={profileLoading || updateProfile.isPending}
                    onClick={() =>
                      updateProfile.mutate({
                        companyName: companyForm.companyName,
                        companyPhone: companyForm.companyPhone,
                        taxNumber: companyForm.taxNumber,
                        companyAddress: companyForm.companyAddress,
                      })
                    }
                  >
                    Save Company
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="invoices">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="premium-card">
                <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Invoice Prefix</Label><Input value={invoiceForm.invoicePrefix} onChange={(e) => setInvoiceForm((s) => ({ ...s, invoicePrefix: e.target.value }))} className="input-focus" disabled={settingsLoading || updateSettings.isPending} /></div>
                    <div className="space-y-2"><Label>Starting Number</Label><Input type="number" value={invoiceForm.invoiceStartNumber} onChange={(e) => setInvoiceForm((s) => ({ ...s, invoiceStartNumber: e.target.value }))} className="input-focus" disabled={settingsLoading || updateSettings.isPending} /></div>
                    <div className="space-y-2"><Label>Default Due Days</Label><Input type="number" value={invoiceForm.paymentTerms} onChange={(e) => setInvoiceForm((s) => ({ ...s, paymentTerms: e.target.value }))} className="input-focus" disabled={settingsLoading || updateSettings.isPending} /></div>
                    <div className="space-y-2"><Label>Default Tax Rate (%)</Label><Input type="number" value={invoiceForm.taxRate} onChange={(e) => setInvoiceForm((s) => ({ ...s, taxRate: e.target.value }))} className="input-focus" disabled={settingsLoading || updateSettings.isPending} /></div>
                  </div>
                  <Button
                    disabled={settingsLoading || updateSettings.isPending}
                    onClick={() => {
                      const invoiceStartNumber = Number(invoiceForm.invoiceStartNumber);
                      const paymentTerms = Number(invoiceForm.paymentTerms);
                      const taxRate = Number(invoiceForm.taxRate);
                      updateSettings.mutate({
                        invoicePrefix: invoiceForm.invoicePrefix || undefined,
                        invoiceStartNumber: Number.isFinite(invoiceStartNumber) ? invoiceStartNumber : undefined,
                        paymentTerms: Number.isFinite(paymentTerms) ? paymentTerms : undefined,
                        taxRate: Number.isFinite(taxRate) ? taxRate : undefined,
                      });
                    }}
                  >
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="premium-card">
                <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div><p className="font-medium text-foreground">Payment Received</p><p className="text-sm text-muted-foreground">Get notified when a payment is received</p></div>
                    <Switch
                      checked={notificationsForm.paymentReceived}
                      onCheckedChange={(checked) => {
                        setNotificationsForm((s) => ({ ...s, paymentReceived: checked }));
                        updateSettings.mutate({ emailNotifyPaymentReceived: checked });
                      }}
                      disabled={settingsLoading || updateSettings.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="font-medium text-foreground">Invoice Overdue</p><p className="text-sm text-muted-foreground">Alert when an invoice becomes overdue</p></div>
                    <Switch
                      checked={notificationsForm.invoiceOverdue}
                      onCheckedChange={(checked) => {
                        setNotificationsForm((s) => ({ ...s, invoiceOverdue: checked }));
                        updateSettings.mutate({ emailNotifyInvoiceOverdue: checked });
                      }}
                      disabled={settingsLoading || updateSettings.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="font-medium text-foreground">New Client</p><p className="text-sm text-muted-foreground">Notification for new client signups</p></div>
                    <Switch
                      checked={notificationsForm.newClientAdded}
                      onCheckedChange={(checked) => {
                        setNotificationsForm((s) => ({ ...s, newClientAdded: checked }));
                        updateSettings.mutate({ emailNotifyNewClientAdded: checked });
                      }}
                      disabled={settingsLoading || updateSettings.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="billing">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle>Payments</CardTitle>
                  <CardDescription>Connect Stripe to accept invoice payments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Stripe Connect</p>
                      <p className="text-sm text-muted-foreground">
                        {connectStatus?.connected
                          ? `Connected${connectStatus?.chargesEnabled ? " • Charges enabled" : " • Pending verification"}`
                          : "Not connected. Connect your Stripe account to accept invoice payments."}
                      </p>
                    </div>
                    <Button
                      variant={connectStatus?.connected ? "outline" : "default"}
                      disabled={connectStripe.isPending || connectStatusLoading}
                      onClick={() => connectStripe.mutate()}
                    >
                      {connectStripe.isPending
                        ? "Loading..."
                        : connectStatus?.connected
                          ? "Update details"
                          : "Connect Stripe"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
