'use client';

/**
 * The dashboard.
 *
 * Replaces a "You have successfully logged in" card — which told you nothing
 * you did not already know from being able to see it.
 *
 * It leads with what is waiting on a person, not with totals. Totals are how a
 * dashboard looks busy; a queue is what makes someone act. Everything here is
 * a link, because a figure you cannot click is a figure you have to go and
 * find somewhere else.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Inbox, FileText, Building2, ArrowRight, Clock, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

interface Summary {
  pending_approvals: number;
  invoices_this_month: { count: number; total_amount: number };
  top_vendors: { vendor_name: string; total_amount: number }[];
}

interface PendingInvoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  total_amount: string | number;
  current_state: string;
}

const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [pending, setPending] = useState<PendingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.DASHBOARD.STATS, {}, user.access_token),
        apiFetch(API_ENDPOINTS.DASHBOARD.PENDING, {}, user.access_token),
      ]);
      if (statsRes.ok) setSummary(await statsRes.json());
      if (pendingRes.ok) setPending(await pendingRes.json());
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

  const waiting = summary?.pending_approvals ?? 0;
  const month = summary?.invoices_this_month;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">
          {user.full_name ? `Morning, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-muted-foreground mt-1">
          What is waiting, and what has moved this month.
        </p>
      </div>

      {/* The queue leads. A figure is only useful if it tells someone to act. */}
      {waiting > 0 ? (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {waiting} invoice{waiting === 1 ? '' : 's'} awaiting approval
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nothing outside this system chases them.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/ai-tools/inbox">
                <Inbox className="h-4 w-4 mr-2" />
                Open the inbox
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Inbox className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Nothing is waiting on an approval.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Invoices this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{month?.count ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {money(month?.total_amount ?? 0)} in total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Where the money goes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(summary?.top_vendors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No spend recorded yet.</p>
            ) : (
              summary!.top_vendors.slice(0, 4).map((vendor) => (
                <div
                  key={vendor.vendor_name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {vendor.vendor_name}
                  </span>
                  <span className="font-medium shrink-0">
                    {money(vendor.total_amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awaiting a decision</CardTitle>
          <CardDescription>
            The invoices themselves, so the number above is something you can act
            on rather than go looking for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nothing pending.</p>
          ) : (
            pending.slice(0, 8).map((invoice) => (
              <Link
                key={invoice.id}
                href={`/ai-tools/invoices/${invoice.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {invoice.invoice_number}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs border-yellow-500/50 bg-yellow-500/10 text-yellow-600"
                    >
                      pending approval
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {invoice.vendor_name}
                    {invoice.invoice_date &&
                      ` · ${format(parseApiDate(invoice.invoice_date), 'dd MMM yyyy')}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {money(invoice.total_amount)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
          {pending.length > 8 && (
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/ai-tools/invoices">
                See all {pending.length}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Start something
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" asChild>
            <Link href="/ai-tools/requisitions/new">Raise a request</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ai-tools/invoice-upload">Upload an invoice</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ai-tools">All tools</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
