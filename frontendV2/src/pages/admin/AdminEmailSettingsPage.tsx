import { useEffect, useMemo, useState } from "react";
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
import apiClient, { EmailTemplatePreview, EmailTemplateType } from "@/lib/api-client";

export default function AdminEmailSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [testTo, setTestTo] = useState("");
  const [previewType, setPreviewType] = useState<EmailTemplateType>("welcome");
  const [preview, setPreview] = useState<EmailTemplatePreview | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiClient.getSystemSettings(),
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const isBrevoHost = useMemo(() => {
    return /brevo|sendinblue|smtp-relay\./i.test(String(settings?.EMAIL_HOST || ""));
  }, [settings?.EMAIL_HOST]);

  function update(key: string, value: any) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const buildOverrides = useMemo(() => {
    const s = settings || {};
    const keys = [
      "EMAIL_PROVIDER",
      "SENDGRID_API_KEY",
      "BREVO_API_KEY",
      "EMAIL_TRACK_OPENS",
      "EMAIL_TRACK_CLICKS",
      "EMAIL_HOST",
      "EMAIL_PORT",
      "EMAIL_SECURE",
      "EMAIL_USER",
      "EMAIL_PASSWORD",
      "EMAIL_FROM",
      "EMAIL_CONNECTION_TIMEOUT_MS",
      "EMAIL_GREETING_TIMEOUT_MS",
      "EMAIL_SOCKET_TIMEOUT_MS",
    ] as const;
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = s[k];
    return o;
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Settings not loaded");
      return apiClient.updateSystemSettings(settings);
    },
    onSuccess: async (res) => {
      setSettings(res);
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Email settings updated");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Update failed");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => apiClient.testSmtp(buildOverrides),
    onSuccess: async (res) => {
      if (res?.success) {
        toast.success("SMTP connection successful");
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings);
            setSettings(saved);
            await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
            toast.success("Email settings saved");
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Auto-save failed");
          }
        }
      } else {
        toast.error(res?.error || "SMTP verification failed");
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "SMTP verification failed");
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const to = testTo.trim();
      if (!to) throw new Error("Recipient email is required");
      return apiClient.sendTestEmail(to, buildOverrides);
    },
    onSuccess: async (res) => {
      if (res?.success) {
        toast.success(`Test email sent${res.messageId ? ` (Message ID: ${res.messageId})` : ""}`);
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings);
            setSettings(saved);
            await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
          } catch {}
        }
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to send test email");
    },
  });

  const testInvoiceEmailMutation = useMutation({
    mutationFn: async () => {
      const to = testTo.trim();
      if (!to) throw new Error("Recipient email is required");
      return apiClient.sendTestInvoiceEmail(to, buildOverrides);
    },
    onSuccess: async (res) => {
      if (res?.success) {
        toast.success(
          `Test invoice email sent${res.messageId ? ` (Message ID: ${res.messageId})` : ""}`,
        );
        if (settings) {
          try {
            const saved = await apiClient.updateSystemSettings(settings);
            setSettings(saved);
            await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
          } catch {}
        }
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to send test invoice email");
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => apiClient.previewEmailTemplate(previewType),
    onSuccess: (res) => {
      setPreview(res);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to load preview");
    },
  });

  const saving = saveMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Email Configuration</h1>
            <p className="text-muted-foreground mt-1">Provider configuration, SMTP tests and template preview</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!settings || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load email settings"}
          </div>
        ) : settings ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email (Provider)</CardTitle>
                <CardDescription>Configure the outgoing email provider used system-wide.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="EMAIL_PROVIDER">Email Provider</Label>
                    <Select
                      value={String(settings.EMAIL_PROVIDER || "SMTP")}
                      onValueChange={(val) => update("EMAIL_PROVIDER", val)}
                    >
                      <SelectTrigger id="EMAIL_PROVIDER" className="mt-2 w-full" aria-label="Email Provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SMTP">SMTP</SelectItem>
                        <SelectItem value="SENDGRID">SendGrid</SelectItem>
                        <SelectItem value="BREVO">Brevo (API)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="EMAIL_FROM">From Email</Label>
                    <Input
                      id="EMAIL_FROM"
                      type="email"
                      value={String(settings.EMAIL_FROM || "")}
                      onChange={(e) => update("EMAIL_FROM", e.target.value)}
                      placeholder="noreply@invoicy.com"
                    />
                  </div>
                </div>

                {settings.EMAIL_PROVIDER === "SENDGRID" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <Label htmlFor="SENDGRID_API_KEY">SendGrid API Key</Label>
                      <Input
                        id="SENDGRID_API_KEY"
                        type="password"
                        value={String(settings.SENDGRID_API_KEY || "")}
                        onChange={(e) => update("SENDGRID_API_KEY", e.target.value)}
                        placeholder="SG.xxxxxx"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use the masked value "__SECRET__" to keep the existing key unchanged.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <input
                          id="EMAIL_TRACK_OPENS"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!settings.EMAIL_TRACK_OPENS}
                          onChange={(e) => update("EMAIL_TRACK_OPENS", e.target.checked)}
                        />
                        <Label htmlFor="EMAIL_TRACK_OPENS">Track Opens</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          id="EMAIL_TRACK_CLICKS"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!settings.EMAIL_TRACK_CLICKS}
                          onChange={(e) => update("EMAIL_TRACK_CLICKS", e.target.checked)}
                        />
                        <Label htmlFor="EMAIL_TRACK_CLICKS">Track Clicks</Label>
                      </div>
                    </div>
                  </div>
                )}

                {settings.EMAIL_PROVIDER === "BREVO" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <Label htmlFor="BREVO_API_KEY">Brevo API Key</Label>
                      <Input
                        id="BREVO_API_KEY"
                        type="password"
                        value={String(settings.BREVO_API_KEY || "")}
                        onChange={(e) => update("BREVO_API_KEY", e.target.value)}
                        placeholder="xkeysib_..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter "__SECRET__" to keep the current key unchanged.
                      </p>
                    </div>
                  </div>
                )}

                {settings.EMAIL_PROVIDER === "SMTP" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <Label htmlFor="EMAIL_HOST">SMTP Host</Label>
                      <Input
                        id="EMAIL_HOST"
                        value={String(settings.EMAIL_HOST || "")}
                        onChange={(e) => update("EMAIL_HOST", e.target.value)}
                        placeholder="smtp-relay.brevo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="EMAIL_PORT">SMTP Port</Label>
                      <Input
                        id="EMAIL_PORT"
                        type="number"
                        step="1"
                        value={Number(settings.EMAIL_PORT ?? 587)}
                        onChange={(e) => update("EMAIL_PORT", parseInt(e.target.value || "0"))}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="EMAIL_SECURE"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!settings.EMAIL_SECURE}
                        onChange={(e) => update("EMAIL_SECURE", e.target.checked)}
                      />
                      <Label htmlFor="EMAIL_SECURE">Use TLS/SSL (secure)</Label>
                    </div>

                    {isBrevoHost ? (
                      <>
                        <div>
                          <Label htmlFor="EMAIL_USER">Username</Label>
                          <Input
                            id="EMAIL_USER"
                            value={String(settings.EMAIL_USER || "")}
                            onChange={(e) => update("EMAIL_USER", e.target.value)}
                            placeholder="apikey or your@email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="BREVO_API_KEY">Brevo API Key</Label>
                          <Input
                            id="BREVO_API_KEY"
                            type="password"
                            value={String(settings.BREVO_API_KEY || "")}
                            onChange={(e) => update("BREVO_API_KEY", e.target.value)}
                            placeholder="xkeysib_..."
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Used as the SMTP password. Enter "__SECRET__" to keep the existing value unchanged.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="EMAIL_USER">Username</Label>
                          <Input
                            id="EMAIL_USER"
                            value={String(settings.EMAIL_USER || "")}
                            onChange={(e) => update("EMAIL_USER", e.target.value)}
                            placeholder="your@email.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="EMAIL_PASSWORD">Password</Label>
                          <Input
                            id="EMAIL_PASSWORD"
                            type="password"
                            value={String(settings.EMAIL_PASSWORD || "")}
                            onChange={(e) => update("EMAIL_PASSWORD", e.target.value)}
                            placeholder="SMTP password"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter "__SECRET__" to keep the existing value unchanged.
                          </p>
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="EMAIL_CONNECTION_TIMEOUT_MS">Connection Timeout (ms)</Label>
                      <Input
                        id="EMAIL_CONNECTION_TIMEOUT_MS"
                        type="number"
                        step="1"
                        value={Number(settings.EMAIL_CONNECTION_TIMEOUT_MS ?? 10000)}
                        onChange={(e) => update("EMAIL_CONNECTION_TIMEOUT_MS", parseInt(e.target.value || "0"))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="EMAIL_GREETING_TIMEOUT_MS">Greeting Timeout (ms)</Label>
                      <Input
                        id="EMAIL_GREETING_TIMEOUT_MS"
                        type="number"
                        step="1"
                        value={Number(settings.EMAIL_GREETING_TIMEOUT_MS ?? 10000)}
                        onChange={(e) => update("EMAIL_GREETING_TIMEOUT_MS", parseInt(e.target.value || "0"))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="EMAIL_SOCKET_TIMEOUT_MS">Socket Timeout (ms)</Label>
                      <Input
                        id="EMAIL_SOCKET_TIMEOUT_MS"
                        type="number"
                        step="1"
                        value={Number(settings.EMAIL_SOCKET_TIMEOUT_MS ?? 20000)}
                        onChange={(e) => update("EMAIL_SOCKET_TIMEOUT_MS", parseInt(e.target.value || "0"))}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test SMTP</CardTitle>
                <CardDescription>Verify connection or send a test email without saving changes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div className="md:col-span-2">
                    <Label htmlFor="TEST_TO">Test Recipient Email</Label>
                    <Input
                      id="TEST_TO"
                      type="email"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={verifyMutation.isPending || saving || settings.EMAIL_PROVIDER !== "SMTP"}
                      onClick={() => verifyMutation.mutate()}
                    >
                      {verifyMutation.isPending ? "Verifying…" : "Test SMTP Connection"}
                    </Button>
                    <Button
                      type="button"
                      disabled={testEmailMutation.isPending || saving}
                      onClick={() => testEmailMutation.mutate()}
                    >
                      {testEmailMutation.isPending ? "Sending…" : "Send Test Email"}
                    </Button>
                    <Button
                      type="button"
                      disabled={testInvoiceEmailMutation.isPending || saving}
                      onClick={() => testInvoiceEmailMutation.mutate()}
                    >
                      {testInvoiceEmailMutation.isPending ? "Sending…" : "Send Test Invoice Email"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Template Preview</CardTitle>
                <CardDescription>Preview built-in email templates without sending.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div>
                    <Label htmlFor="PREVIEW_TYPE">Template</Label>
                    <Select value={previewType} onValueChange={(val) => setPreviewType(val as EmailTemplateType)}>
                      <SelectTrigger id="PREVIEW_TYPE" className="mt-2 w-full" aria-label="Email Template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="invoice">Invoice Sent</SelectItem>
                        <SelectItem value="payment-reminder">Payment Reminder</SelectItem>
                        <SelectItem value="payment-received">Payment Received</SelectItem>
                        <SelectItem value="password-reset">Password Reset</SelectItem>
                        <SelectItem value="verify-email">Verify Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                      {previewMutation.isPending ? "Loading…" : "Preview"}
                    </Button>
                    {preview && (
                      <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {preview && (
                  <div className="mt-6">
                    <div className="mb-2 text-sm text-muted-foreground">
                      Subject: <span className="font-medium">{preview.subject}</span>
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <iframe title="Email Preview" className="w-full h-[600px] bg-white" srcDoc={preview.html} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
