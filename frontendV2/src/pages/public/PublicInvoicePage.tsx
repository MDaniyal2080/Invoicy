import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import apiClient, { type Invoice } from "@/lib/api-client";

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

function formatDate(v: string) {
  try {
    return new Date(v).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return v;
  }
}

function statusBadgeClass(status: Invoice["status"]) {
  switch (status) {
    case "PAID":
      return "bg-emerald-600 text-white border-transparent";
    case "OVERDUE":
      return "bg-destructive text-destructive-foreground border-transparent";
    case "PARTIALLY_PAID":
      return "bg-amber-500 text-white border-transparent";
    case "SENT":
    case "VIEWED":
      return "bg-blue-600 text-white border-transparent";
    case "DRAFT":
      return "bg-muted text-foreground border-border";
    case "CANCELLED":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary text-primary-foreground border-transparent";
  }
}

export default function PublicInvoicePage() {
  const { shareId: shareIdParam } = useParams();
  const shareId = shareIdParam || "";
  const [searchParams] = useSearchParams();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isStripeRedirecting, setIsStripeRedirecting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [verifyingOnReturn, setVerifyingOnReturn] = useState(false);
  const [verifiedSessionId, setVerifiedSessionId] = useState<string | null>(null);

  const paid = searchParams.get("paid");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!shareId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getPublicInvoice(shareId);
        if (!mounted) return;
        setInvoice(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Invoice not found or no longer available.";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [shareId]);

  useEffect(() => {
    if (!shareId) return;
    if (paid !== "1" || !sessionId) return;
    if (sessionId === verifiedSessionId) return;

    let cancelled = false;
    (async () => {
      try {
        setStripeError(null);
        setVerifyingOnReturn(true);
        await apiClient.verifyPublicInvoiceStripeCheckout(shareId, sessionId);
        if (cancelled) return;
        setVerifiedSessionId(sessionId);
        const fresh = await apiClient.getPublicInvoice(shareId);
        if (!cancelled) setInvoice(fresh);
      } catch (e: unknown) {
        if (!cancelled) {
          setStripeError(e instanceof Error ? e.message : "We could not auto-verify your payment. Please refresh in a moment.");
        }
      } finally {
        if (!cancelled) setVerifyingOnReturn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paid, sessionId, shareId, verifiedSessionId]);

  const items = invoice?.items || [];

  const totals = useMemo(() => {
    const inv = invoice;
    if (!inv) return null;
    const currency = inv.currency || "USD";
    return {
      currency,
      subtotal: formatMoney(inv.subtotal || 0, currency),
      tax: formatMoney(inv.taxAmount || 0, currency),
      total: formatMoney(inv.totalAmount || 0, currency),
      paid: formatMoney(inv.paidAmount || 0, currency),
      balance: formatMoney(inv.balanceDue || 0, currency),
    };
  }, [invoice]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-sm text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invoice Unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error || "Invoice not found."}</p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => (window.location.href = "/")}>Return to Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canPay = invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (invoice.balanceDue || 0) > 0;

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Invoice {invoice.invoiceNumber}</h1>
              <Badge className={statusBadgeClass(invoice.status)}>{invoice.status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Issued: {formatDate(invoice.invoiceDate)}{invoice.dueDate ? ` • Due: ${formatDate(invoice.dueDate)}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
            {canPay && (
              <Button
                disabled={isStripeRedirecting || verifyingOnReturn}
                onClick={async () => {
                  try {
                    setStripeError(null);
                    setIsStripeRedirecting(true);
                    const res = await apiClient.createPublicInvoiceStripeCheckout(shareId);
                    if (res?.url) {
                      window.location.href = res.url;
                    } else {
                      setStripeError("Unable to start Stripe checkout.");
                    }
                  } catch (e: unknown) {
                    setStripeError(e instanceof Error ? e.message : "Stripe checkout is not available.");
                  } finally {
                    setIsStripeRedirecting(false);
                  }
                }}
              >
                {isStripeRedirecting ? "Redirecting..." : "Pay with Stripe"}
              </Button>
            )}
          </div>
        </div>

        {(verifyingOnReturn || stripeError) && (
          <Card>
            <CardContent className="pt-6">
              {verifyingOnReturn && <div className="text-sm text-muted-foreground">Verifying your payment...</div>}
              {stripeError && <div className="text-sm text-destructive">{stripeError}</div>}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">Description</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 break-words">{it.description}</td>
                        <td className="py-2 text-right">{it.quantity}</td>
                        <td className="py-2 text-right">{formatMoney(it.rate || 0, invoice.currency || "USD")}</td>
                        <td className="py-2 text-right">{formatMoney(it.amount || it.quantity * it.rate, invoice.currency || "USD")}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground">No items.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(invoice.notes || invoice.terms) && (
                <div className="mt-6 space-y-4">
                  {invoice.notes && (
                    <div>
                      <div className="text-sm font-medium">Notes</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</div>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <div className="text-sm font-medium">Terms</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{totals?.subtotal}</span>
              </div>
              {(invoice.taxAmount || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{totals?.tax}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{totals?.total}</span>
              </div>
              {(invoice.paidAmount || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium">{totals?.paid}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="font-semibold">{totals?.balance}</span>
              </div>

              {!canPay && invoice.status === "PAID" && (
                <div className="pt-2 text-sm text-emerald-700">This invoice is paid.</div>
              )}
              {!canPay && invoice.status === "CANCELLED" && (
                <div className="pt-2 text-sm text-muted-foreground">This invoice is cancelled.</div>
              )}
              {!canPay && invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <div className="pt-2 text-sm text-muted-foreground">No balance due.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by Invoicy
        </div>
      </div>
    </div>
  );
}
