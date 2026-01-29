import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import apiClient from "@/lib/api-client";

function formatDateTime(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export default function AdminBackupPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "backup-status"],
    queryFn: () => apiClient.adminGetBackupStatus(),
  });

  const runMutation = useMutation({
    mutationFn: () => apiClient.adminRunBackup(),
    onSuccess: async (res) => {
      toast.success(`Backup started (ID: ${res.backupId})`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "backup-status"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Backups</h1>
            <p className="text-muted-foreground mt-1">Trigger a manual backup and view the most recent backup metadata.</p>
          </div>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            {runMutation.isPending ? "Running…" : "Run Backup Now"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading backup status...</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load backup status"}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Backup Status</CardTitle>
              <CardDescription>Latest backup metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  Last backup: <span className="font-medium text-foreground">{formatDateTime(data?.lastBackupAt ?? null)}</span>
                </div>
                <div>
                  Backup ID: <span className="font-mono text-foreground">{data?.lastBackupId || "—"}</span>
                </div>
                <div>
                  File: <span className="font-mono text-foreground">{data?.lastBackupFile || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
