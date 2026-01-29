import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, MoreVertical, Mail, Phone, FileText, DollarSign, Eye, Edit, Trash2, Grid3X3, List } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { Client } from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["clients", searchQuery],
    queryFn: async () => {
      return apiClient.getClients({ search: searchQuery || undefined });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      return apiClient.deleteClient(clientId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    },
  });

  const clients: Array<
    Client & { initials: string; totalInvoices: number; outstanding: number }
  > = (data || []).map((c) => ({
    ...c,
    initials: getInitials(c.name),
    totalInvoices: c._count?.invoices ?? 0,
    outstanding: 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground">Manage your client relationships</p>
          </div>
          <Button asChild>
            <Link to="/clients/new">
              <Plus className="w-4 h-4 mr-2" />Add Client
            </Link>
          </Button>
        </div>

        <Card className="premium-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}><Grid3X3 className="w-4 h-4" /></Button>
                <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={viewMode === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {isLoading && (
            <div className="text-sm text-muted-foreground">Loading...</div>
          )}
          {isError && (
            <div className="text-sm text-destructive">
              Failed to load clients{" "}
              <button
                className="underline"
                onClick={() => {
                  void refetch();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && clients.map((client, index) => (
            <motion.div key={client.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="premium-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{client.initials}</AvatarFallback></Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/clients/${client.id}`}>
                            <Eye className="w-4 h-4 mr-2" />View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/clients/${client.id}/edit`}>
                            <Edit className="w-4 h-4 mr-2" />Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={deleteClient.isPending}
                          onSelect={(e) => {
                            e.preventDefault();
                            const ok = window.confirm(
                              "Delete this client? This is not allowed if the client has invoices.",
                            );
                            if (!ok) return;
                            deleteClient.mutate(client.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{client.phone || "-"}</div>
                    <div className="flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4" />{client.totalInvoices} invoices</div>
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-muted-foreground" /><span className={client.outstanding > 0 ? "text-warning font-medium" : "text-success font-medium"}>{client.outstanding > 0 ? `$${client.outstanding.toLocaleString()} outstanding` : "No outstanding"}</span></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
