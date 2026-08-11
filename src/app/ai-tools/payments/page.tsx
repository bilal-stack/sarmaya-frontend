'use client';

/**
 * Payment runs.
 *
 * The list leads with what is waiting on a second person, because that is the
 * control this module exists for: a run sitting in pending_release is money
 * that has been prepared but not yet authorised, and nobody should have to
 * hunt for it.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { PaymentSummary, PaymentState } from '@/types/payment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Banknote, Plus, Lock, ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<PaymentState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_release: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  released: 'border-green-500/50 bg-green-500/10 text-green-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string) =>
  Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [canPrepare, setCanPrepare] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [listRes, payableRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.PAYMENTS.LIST, {}, user.access_token),
        apiFetch(API_ENDPOINTS.PAYMENTS.PAYABLE, {}, user.access_token),
      ]);
      if (listRes.status === 403) {
        setDenied(true);
        return;
      }
      if (listRes.ok) setPayments(await listRes.json());
      // Preparing is a separate permission from viewing; a 403 here just means
      // this person releases rather than prepares.
      setCanPrepare(payableRes.ok);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Not permitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                You do not have permission to view payments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaiting = payments.filter((p) => p.current_state === 'pending_release');
  const awaitingValue = awaiting.reduce((sum, p) => sum + Number(p.total_amount), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-7 w-7 text-primary" />
            Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            Runs settling approved invoices. Prepared by one person, released by another.
          </p>
        </div>
        {canPrepare && (
          <Button asChild>
            <Link href="/ai-tools/payments/new">
              <Plus className="h-4 w-4 mr-2" />
              Prepare a run
            </Link>
          </Button>
        )}
      </div>

      {awaiting.length > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {awaiting.length} run(s) awaiting release · {money(String(awaitingValue))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prepared but not yet authorised. Releasing requires someone other than
                whoever prepared it.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runs</CardTitle>
          <CardDescription>{payments.length} payment run(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No payment runs yet.</p>
          ) : (
            payments.map((payment) => (
              <Link
                key={payment.id}
                href={`/ai-tools/payments/${payment.id}`}
                className="block rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{payment.payment_number}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATE_STYLE[payment.current_state]}`}
                      >
                        {label(payment.current_state)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseApiDate(payment.payment_date), 'dd MMM yyyy')}
                      {payment.released_by && ' · released'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{money(payment.total_amount)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
