'use client';

/**
 * Raising a purchase order.
 *
 * Two things the form makes explicit because they are governance, not UI
 * preference:
 *
 *   - The vendor is chosen from the master record, never typed freehand. An
 *     invoice upload may create a vendor from a scanned document; an order is
 *     a deliberate decision about who to buy from, so it names an existing one.
 *   - The total is derived from the lines and shown live rather than entered.
 *     The server computes it the same way, so the header can never disagree
 *     with what was ordered — the three-way match compares against it later.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, Trash2, ShoppingCart, Info } from 'lucide-react';

interface VendorOption {
  id: string;
  legal_name: string;
  status: string;
}

interface LineDraft {
  description: string;
  product_code: string;
  quantity: string;
  unit_price: string;
}

const emptyLine = (): LineDraft => ({
  description: '', product_code: '', quantity: '', unit_price: '',
});

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [description, setDescription] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    try {
      const response = await apiFetch(
        `${API_ENDPOINTS.VENDORS.LIST}/`, {}, user.access_token
      );
      if (response.ok) setVendors(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0
  );
  const total = subtotal + (Number(taxAmount) || 0);

  const usableLines = lines.filter(
    (l) => l.description.trim() && Number(l.quantity) > 0
  );
  const canSave = !!vendorId && usableLines.length > 0;

  const save = async () => {
    if (!user?.access_token || !canSave) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.PURCHASE_ORDERS.CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            vendor_id: vendorId,
            expected_date: expectedDate || null,
            description: description || null,
            tax_amount: Number(taxAmount) || 0,
            lines: usableLines.map((l) => ({
              description: l.description.trim(),
              product_code: l.product_code.trim() || null,
              quantity: Number(l.quantity),
              unit_price: Number(l.unit_price) || 0,
            })),
          }),
        },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === 'string' ? err.detail : 'Could not raise this order'
        );
      }
      const created = await response.json();
      toast({
        title: `${created.po_number} raised`,
        description: 'It stays a draft until you submit it for approval.',
      });
      router.push(`/ai-tools/purchase-orders/${created.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not raised', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/ai-tools/purchase-orders')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Purchase orders
      </Button>

      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-7 w-7 text-primary" />
          Raise a purchase order
        </h1>
        <p className="text-muted-foreground mt-1">
          Saved as a draft. Nothing is committed until it is approved and issued.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger id="vendor">
                <SelectValue placeholder="Choose a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.legal_name}
                    {v.status !== 'active' && ` · ${v.status.replace(/_/g, ' ')}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              An order can be drafted against any vendor, but it cannot be issued until
              that vendor is verified.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expected">Expected date (optional)</Label>
              <Input
                id="expected"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax">Tax</Label>
              <Input
                id="tax"
                type="number"
                min={0}
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description (optional)</Label>
            <Input
              id="desc"
              placeholder="What this order is for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
          <CardDescription>
            Quantities matter beyond the total — the delivery is matched against them line
            by line when the invoice arrives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Line {index + 1}</span>
                {lines.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(index, { description: e.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Product code"
                  value={line.product_code}
                  onChange={(e) => updateLine(index, { product_code: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Quantity"
                  min={0}
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Unit price"
                  min={0}
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)).toLocaleString(
                  undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}
              </p>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
            <Plus className="h-4 w-4 mr-2" />
            Add a line
          </Button>

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>
                {(Number(taxAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1">
              <span>Total</span>
              <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Computed from the lines. The server recomputes it the same way, so the header
              can never disagree with what was ordered.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={!canSave || isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4 mr-2" />
          )}
          Save as draft
        </Button>
        <Button variant="outline" onClick={() => router.push('/ai-tools/purchase-orders')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
