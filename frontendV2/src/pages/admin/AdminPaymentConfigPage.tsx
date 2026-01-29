import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import apiClient from "@/lib/api-client";

export default function AdminPaymentConfigPage() {
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
      toast.success("Stripe settings updated");
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
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Payment Configuration</h1>
            <p className="text-muted-foreground mt-1">Configure Stripe keys, webhooks, and fees</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!settings || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load Stripe settings"}
          </div>
        ) : settings ? (
          <Card>
            <CardHeader>
              <CardTitle>Payments (Stripe)</CardTitle>
              <CardDescription>Stripe settings for subscriptions and invoice payments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="STRIPE_SECRET_KEY">Secret Key</Label>
                  <Input
                    id="STRIPE_SECRET_KEY"
                    type="password"
                    value={String(settings.STRIPE_SECRET_KEY || "")}
                    onChange={(e) => update("STRIPE_SECRET_KEY", e.target.value)}
                    placeholder="sk_test_... (use __SECRET__ to keep current)"
                  />
                </div>
                <div>
                  <Label htmlFor="STRIPE_WEBHOOK_SECRET">Webhook Secret</Label>
                  <Input
                    id="STRIPE_WEBHOOK_SECRET"
                    type="password"
                    value={String(settings.STRIPE_WEBHOOK_SECRET || "")}
                    onChange={(e) => update("STRIPE_WEBHOOK_SECRET", e.target.value)}
                    placeholder="whsec_... (use __SECRET__ to keep current)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="STRIPE_PRICE_BASIC">Subscription Price ID (Basic)</Label>
                    <Input
                      id="STRIPE_PRICE_BASIC"
                      value={String(settings.STRIPE_PRICE_BASIC || "")}
                      onChange={(e) => update("STRIPE_PRICE_BASIC", e.target.value)}
                      placeholder="price_..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="STRIPE_PRICE_PREMIUM">Subscription Price ID (Premium)</Label>
                    <Input
                      id="STRIPE_PRICE_PREMIUM"
                      value={String(settings.STRIPE_PRICE_PREMIUM || "")}
                      onChange={(e) => update("STRIPE_PRICE_PREMIUM", e.target.value)}
                      placeholder="price_..."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="STRIPE_PLATFORM_FEE_BPS">Platform Fee (basis points)</Label>
                  <Input
                    id="STRIPE_PLATFORM_FEE_BPS"
                    type="number"
                    step="1"
                    value={Number(settings.STRIPE_PLATFORM_FEE_BPS ?? 0)}
                    onChange={(e) => update("STRIPE_PLATFORM_FEE_BPS", parseInt(e.target.value || "0"))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Example: 250 = 2.5% fee.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
