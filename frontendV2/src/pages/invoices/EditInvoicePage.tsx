import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  CalendarDays,
  Building2,
  Mail,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { Client, DiscountType } from "@/lib/api-client";
import { toast } from "@/components/ui/sonner";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function EditInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invoiceId = id || "";

  const { data: invoice, isLoading: invoiceLoading, isError: invoiceError } = useQuery({
    queryKey: ["invoice", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => apiClient.getInvoice(invoiceId),
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => apiClient.getClients(),
  });

  const [selectedClient, setSelectedClient] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() => toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateInputValue(d);
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: String(Date.now()), description: "", quantity: 1, rate: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(10);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>("FIXED");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (!invoice) return;

    setSelectedClient(invoice.client?.id || "");
    setInvoiceNumber(invoice.invoiceNumber || "");

    try {
      setIssueDate(toDateInputValue(new Date(invoice.invoiceDate)));
    } catch {
      setIssueDate(invoice.invoiceDate);
    }

    try {
      setDueDate(toDateInputValue(new Date(invoice.dueDate)));
    } catch {
      setDueDate(invoice.dueDate);
    }

    const mapped = (invoice.items || []).map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      rate: it.rate,
    }));

    setLineItems(
      mapped.length > 0
        ? mapped
        : [{ id: String(Date.now()), description: "", quantity: 1, rate: 0 }],
    );

    setTaxRate(invoice.taxRate ?? 0);
    setDiscount(invoice.discount ?? 0);
    setDiscountType(invoice.discountType ?? "FIXED");
    setNotes(invoice.notes || "");
    setTerms(invoice.terms || "");
  }, [invoice]);

  const selectedClientObj = useMemo(() => {
    return (clients || []).find((c) => c.id === selectedClient);
  }, [clients, selectedClient]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), description: "", quantity: 1, rate: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const discountAmount =
    discountType === "PERCENTAGE" ? (subtotal * discount) / 100 : discount;
  const total = subtotal + taxAmount - discountAmount;

  const updateInvoiceMutation = useMutation({
    mutationFn: async (args: { send: boolean }) => {
      if (!invoiceId) throw new Error("Missing invoice id");
      if (!selectedClient) throw new Error("Please select a client");

      const items = lineItems
        .filter((i) => i.description.trim().length > 0)
        .map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          rate: Number(i.rate),
        }));

      if (items.length === 0) {
        throw new Error("Please add at least one invoice item");
      }

      const updated = await apiClient.updateInvoice(invoiceId, {
        clientId: selectedClient,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: issueDate,
        dueDate,
        items,
        taxRate,
        discount,
        discountType,
        currency: invoice?.currency || "USD",
        notes,
        terms,
      });

      if (args.send) {
        await apiClient.sendInvoice(invoiceId);
      }

      return updated;
    },
    onSuccess: async (_updated, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(variables.send ? "Invoice sent" : "Invoice updated");
      navigate(`/invoices/${invoiceId}`, { replace: true });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update invoice");
    },
  });

  const isSaving = updateInvoiceMutation.isPending;

  const handleSave = () => updateInvoiceMutation.mutate({ send: false });
  const handleSaveAndSend = () => updateInvoiceMutation.mutate({ send: true });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={invoiceId ? `/invoices/${invoiceId}` : "/invoices"}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Edit Invoice</h1>
              <p className="text-muted-foreground">Update invoice details</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/invoices/${invoiceId}`)} disabled={!invoiceId}>
              Cancel
            </Button>
          </div>
        </div>

        {invoiceLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {invoiceError && <div className="text-sm text-destructive">Failed to load invoice.</div>}

        {!invoiceLoading && !invoiceError && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoiceNumber">Invoice Number</Label>
                        <Input
                          id="invoiceNumber"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          className="input-focus"
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="issueDate">Issue Date</Label>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="issueDate"
                            type="date"
                            value={issueDate}
                            onChange={(e) => setIssueDate(e.target.value)}
                            className="pl-10 input-focus"
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="dueDate"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="pl-10 input-focus"
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Bill To</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Client</Label>
                      <div className="flex gap-2">
                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Choose a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientsLoading && (
                              <SelectItem value="__loading" disabled>
                                Loading...
                              </SelectItem>
                            )}
                            {(clients || []).map((client: Client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => navigate("/clients/new")}>
                          <Plus className="w-4 h-4 mr-2" />
                          New Client
                        </Button>
                      </div>
                    </div>

                    {selectedClient && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-4 bg-muted/30 rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-2 text-foreground">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {selectedClientObj?.name}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {selectedClientObj?.email}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Invoice Items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="hidden sm:grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b border-border">
                      <div className="col-span-5">Description</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-2 text-right">Rate</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-1"></div>
                    </div>

                    {lineItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="grid sm:grid-cols-12 gap-4 items-center"
                      >
                        <div className="sm:col-span-5">
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            className="input-focus"
                            disabled={isSaving}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                            className="text-center input-focus"
                            disabled={isSaving}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                              className="pl-7 text-right input-focus"
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-2 text-right font-medium text-foreground">
                          ${(item.quantity * item.rate).toFixed(2)}
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLineItem(item.id)}
                            disabled={lineItems.length === 1}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}

                    <Button variant="outline" onClick={addLineItem} className="w-full mt-4" disabled={isSaving}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Line Item
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Notes & Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional notes for your client..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="input-focus resize-none"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="terms">Terms & Conditions</Label>
                      <Textarea
                        id="terms"
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        rows={3}
                        className="input-focus resize-none"
                        disabled={isSaving}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="sticky top-24">
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="text-foreground font-medium">${subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Tax</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="w-20 text-right input-focus"
                          disabled={isSaving}
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax Amount</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Discount</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {discountType === "PERCENTAGE" ? "%" : "$"}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-24 pl-7 text-right input-focus"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-accent">${total.toFixed(2)}</span>
                    </div>

                    <div className="space-y-2 pt-4">
                      <Button className="w-full" onClick={handleSaveAndSend} disabled={isSaving}>
                        <Send className="w-4 h-4 mr-2" />
                        Save & Send
                      </Button>
                      <Button variant="outline" className="w-full" onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
