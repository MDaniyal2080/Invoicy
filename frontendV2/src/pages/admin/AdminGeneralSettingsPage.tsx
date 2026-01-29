import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import apiClient from "@/lib/api-client";

function toNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminGeneralSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiClient.getSystemSettings(),
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Settings not loaded");
      return apiClient.updateSystemSettings(settings);
    },
    onSuccess: async (res) => {
      setSettings(res);
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings updated");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Update failed");
    },
  });

  function update(key: string, value: any) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const saving = saveMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">General Settings</h1>
            <p className="text-muted-foreground mt-1">Application base URL, defaults and preferences</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!settings || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load settings"}
          </div>
        ) : settings ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application</CardTitle>
                <CardDescription>Base URL used in email links and redirects.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="APP_URL">App Base URL</Label>
                    <Input
                      id="APP_URL"
                      value={String(settings.APP_URL || "")}
                      onChange={(e) => update("APP_URL", e.target.value)}
                      placeholder="https://app.yourdomain.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Include protocol (https://). Do not include a trailing path.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Defaults</CardTitle>
                <CardDescription>Default currency, tax rate, and payment terms used across the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="defaultCurrency">Default Currency</Label>
                    <Select
                      value={String(settings.defaultCurrency || "USD")}
                      onValueChange={(val) => update("defaultCurrency", val)}
                    >
                      <SelectTrigger id="defaultCurrency" className="mt-2 w-full" aria-label="Default Currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD"].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
                    <Input
                      id="defaultTaxRate"
                      type="number"
                      step="0.01"
                      value={toNumber(settings.defaultTaxRate, 0)}
                      onChange={(e) => update("defaultTaxRate", toNumber(e.target.value, 0))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="defaultPaymentTerms">Payment Terms (days)</Label>
                    <Input
                      id="defaultPaymentTerms"
                      type="number"
                      step="1"
                      value={toNumber(settings.defaultPaymentTerms, 30)}
                      onChange={(e) => update("defaultPaymentTerms", Math.floor(toNumber(e.target.value, 0)))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Email notifications and backups.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3">
                    <input
                      id="emailNotifications"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!settings.emailNotifications}
                      onChange={(e) => update("emailNotifications", e.target.checked)}
                    />
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="autoBackup"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!settings.autoBackup}
                      onChange={(e) => update("autoBackup", e.target.checked)}
                    />
                    <Label htmlFor="autoBackup">Automatic Backups</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
