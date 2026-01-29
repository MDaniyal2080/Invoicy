import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import apiClient from "@/lib/api-client";

export default function AdminMaintenancePage() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "backup-status"],
    queryFn: () => apiClient.adminGetBackupStatus(),
  });

  useEffect(() => {
    if (data) setEnabled(!!data.maintenanceMode);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => apiClient.adminSetMaintenance(enabled),
    onSuccess: async (res) => {
      toast.success(res.maintenanceMode ? "Maintenance mode enabled" : "Maintenance mode disabled");
      await queryClient.invalidateQueries({ queryKey: ["admin", "backup-status"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to update maintenance");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Maintenance</h1>
            <p className="text-muted-foreground mt-1">Enable or disable maintenance mode</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load maintenance status"}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>Users will see a maintenance notice when enabled.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input
                  id="maintenanceMode"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <label htmlFor="maintenanceMode" className="text-sm">
                  Enable maintenance mode
                </label>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
