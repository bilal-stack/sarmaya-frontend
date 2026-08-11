'use client';

/**
 * Preparing a payment run.
 *
 * The list offered here is already filtered to what may legitimately be paid:
 * approved invoices not already claimed by an open or released run. That is
 * the double-payment rule made visible up front rather than delivered as a
 * refusal after someone has built a run.
 *
 * Amounts are not editable. Each invoice is settled at its own approved total,
 * so a run cannot quietly pay a different figure from the one that went
 * through approval — the server computes the same way regardless of what is
 * shown here.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { PayableInvoice } from '@/types/payment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Banknote, Lock, Info } from 'lucide-react';
import { format } from 'date-fns';

const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NewPaymentPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<PayableInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    try {
      const response = await apiFetch(
        API_ENDPOINTS.PAYMENTS.PAYABLE, {}, user.access_token
      );
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setInvoices(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const total = invoices
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  const prepare = async () => {
    if (!user?.access_token || selected.size === 0) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.PAYMENTS.PREPARE,
        {
          method: 'POST',
          body: JSON.stringify({
            invoice_ids: Array.from(selected),
            reference: reference || null,
          }),
        },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === 'string' ? err.detail : 'Could not prepare this run'
        );
      }
      const created = await response.json();
      toast({
        title: `${created.payment_number} prepared`,
        description: 'It stays a draft until you send it for release.',
      });
      router.push(`/ai-tools/payments/${created.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not prepared', description: error.message });
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

  if (denied) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Not permitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                Preparing a payment run is a separate authority from releasing one.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/ai-tools/payments')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Payments
      </Button>

      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <Banknote className="h-7 w-7 text-primary" />
          Prepare a payment run
        </h1>
        <p className="text-muted-foreground mt-1">
          Saved as a draft. Someone else releases it, and nothing reaches a bank until
          they do.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices ready to pay</CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Approved invoices that are not already on another run — an invoice cannot be
            paid twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              Nothing is waiting to be paid. Invoices appear here once they are approved.
            </p>
          ) : (
            invoices.map((invoice) => (
              <label
                key={invoice.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Checkbox
                  checked={selected.has(invoice.id)}
                  onCheckedChange={() => toggle(invoice.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{invoice.invoice_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {invoice.vendor_name} ·{' '}
                    {format(parseApiDate(invoice.invoice_date), 'dd MMM yyyy')}
                  </p>
                </div>
                <span className="text-sm font-medium shrink-0">
                  {money(invoice.total_amount)}
                </span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ref">Reference (optional)</Label>
              <Input
                id="ref"
                placeholder="Weekly run 2026-W32"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selected.size} invoice(s) selected
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each is settled at its approved total; amounts are not editable.
                </p>
              </div>
              <p className="text-lg font-semibold">{money(total)}</p>
            </div>

            <Button onClick={prepare} disabled={selected.size === 0 || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4 mr-2" />
              )}
              Prepare run
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
