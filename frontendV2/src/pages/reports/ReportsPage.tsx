import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ReportsPage() {
  const { data: invoiceStats, isLoading: invoiceLoading } = useQuery({
    queryKey: ["invoice-statistics"],
    queryFn: async () => apiClient.getInvoiceStatistics(),
  });

  const { data: paymentStats, isLoading: paymentLoading } = useQuery({
    queryKey: ["payment-statistics"],
    queryFn: async () => apiClient.getPaymentStatistics(),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">
            Summary insights based on your invoices and payments.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  {invoiceLoading ? "..." : formatMoney(invoiceStats?.totalRevenue ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-foreground">
                  {invoiceLoading ? "..." : formatMoney(invoiceStats?.pendingAmount ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Payments (Total)</p>
                <p className="text-2xl font-bold text-foreground">
                  {paymentLoading ? "..." : formatMoney(paymentStats?.totalReceived ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="premium-card">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Payments (This Month)</p>
                <p className="text-2xl font-bold text-foreground">
                  {paymentLoading ? "..." : formatMoney(paymentStats?.monthlyReceived ?? 0, "USD")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

      </div>
    </DashboardLayout>
  );
}
