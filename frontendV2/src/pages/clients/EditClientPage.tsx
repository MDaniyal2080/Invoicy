import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export default function EditClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clientId = id || "";

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId,
    queryFn: async () => apiClient.getClient(clientId),
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    taxNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    if (!client) return;
    setForm({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      companyName: client.companyName || "",
      taxNumber: client.taxNumber || "",
      addressLine1: client.addressLine1 || "",
      addressLine2: client.addressLine2 || "",
      city: client.city || "",
      state: client.state || "",
      country: client.country || "",
      postalCode: client.postalCode || "",
      notes: client.notes || "",
      isActive: client.isActive ?? true,
    });
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Missing client id");
      if (!form.name.trim()) throw new Error("Client name is required");
      if (!form.email.trim()) throw new Error("Client email is required");

      return apiClient.updateClient(clientId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        addressLine1: form.addressLine1.trim() || undefined,
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Client updated");
      navigate(`/clients/${updated.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update client");
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={clientId ? `/clients/${clientId}` : "/clients"}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Edit Client</h1>
            <p className="text-muted-foreground">Update client information</p>
          </div>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {isError && <div className="text-sm text-destructive">Failed to load client.</div>}

        {!isLoading && !isError && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Client Details</CardTitle>
                <CardDescription>Keep details accurate for invoices and communication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      className="input-focus"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      className="input-focus"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      className="input-focus"
                      value={form.phone}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      className="input-focus"
                      value={form.companyName}
                      onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Number</Label>
                    <Input
                      className="input-focus"
                      value={form.taxNumber}
                      onChange={(e) => setForm((s) => ({ ...s, taxNumber: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2 flex items-end justify-between">
                    <div className="space-y-1">
                      <Label>Active</Label>
                      <p className="text-xs text-muted-foreground">Inactive clients are hidden in selection lists</p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm((s) => ({ ...s, isActive: checked }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Address Line 1</Label>
                    <Input
                      className="input-focus"
                      value={form.addressLine1}
                      onChange={(e) => setForm((s) => ({ ...s, addressLine1: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Address Line 2</Label>
                    <Input
                      className="input-focus"
                      value={form.addressLine2}
                      onChange={(e) => setForm((s) => ({ ...s, addressLine2: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      className="input-focus"
                      value={form.city}
                      onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      className="input-focus"
                      value={form.state}
                      onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      className="input-focus"
                      value={form.country}
                      onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      className="input-focus"
                      value={form.postalCode}
                      onChange={(e) => setForm((s) => ({ ...s, postalCode: e.target.value }))}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Link to={clientId ? `/clients/${clientId}` : "/clients"}>
                    <Button variant="outline" disabled={updateMutation.isPending}>
                      Cancel
                    </Button>
                  </Link>
                  <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
