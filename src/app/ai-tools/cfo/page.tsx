'use client';

/**
 * CFO / Finance Director.
 *
 * Build Book, Standard Report Catalog. Two reports, and the order is the
 * argument: what we owe first, what we spent second. A CFO opening this wants
 * the liability before the analysis, because the liability is the thing with a
 * date on it.
 *
 * The page deliberately leads with the overdue share rather than the total
 * payable. A total payable is a fact about the business; an overdue balance is
 * a fact about us — it is the half somebody has to answer for, and putting the
 * comfortable number first would bury it.
 *
 * Two figures on this page are absences, and both are shown rather than
 * omitted: payables with no due date, and spend with no GL account or cost
 * centre. Each is the part nobody has had to justify, which is exactly why a
 * report that quietly dropped them would look cleaner and mean less.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Panel, Empty, Stat, money, peak } from '@/components/reports/panel';
import type { ApAging, SpendAnalytics } from '@/types/dashboards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, RefreshCw, Landmark, CalendarClock, PieChart,
  AlertTriangle, HelpCircle,
} from 'lucide-react';

const FORBIDDEN = 'Your role cannot read invoice records, so these totals are closed to it.';

export default function CfoPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [spendDays, setSpendDays] = useState(365);

  const aging = usePanel<ApAging>(API_ENDPOINTS.DASHBOARD.AP_AGING, reloadKey);
  const spend = usePanel<SpendAnalytics>(
    API_ENDPOINTS.DASHBOARD.SPEND_ANALYTICS(spendDays), reloadKey + spendDays,
  );
  const anyLoading = aging.loading || spend.loading;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  const a = aging.data;
  const s = spend.data;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            CFO &amp; Finance
          </h1>
          <p className="text-muted-foreground mt-1">
            What we owe and how late it is, then where the money went.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={anyLoading}
        >
          {anyLoading
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Overdue first, not the total. The total payable is a fact about the
          business; the overdue share is a fact about us. */}
      {a && (
        <Card className="mb-6">
          <CardContent className="pt-6 grid gap-6 sm:grid-cols-3">
            <Stat
              label="Overdue"
              value={money(a.total_overdue)}
              hint={`${a.overdue_pct}% of everything owed`}
            />
            <Stat label="Total payable" value={money(a.total_payable)} />
            <Stat
              label="No due date"
              value={money(a.no_due_date.amount)}
              hint={
                a.no_due_date.count > 0
                  ? `${a.no_due_date.count} invoice${a.no_due_date.count === 1 ? '' : 's'} nothing can chase`
                  : 'every payable has a date'
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Panel
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          title="AP aging"
          description="Aged against the due date, not against how long the record has been sitting."
          state={aging}
          forbiddenNote={FORBIDDEN}
        >
          {!a || a.total_payable === 0 ? (
            <Empty>Nothing outstanding.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {a.aging.map((bucket) => {
                  const scale = peak(a.aging.map((b) => b.amount));
                  const overdue = bucket.bucket !== 'not yet due';
                  return (
                    <div key={bucket.bucket} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs text-muted-foreground">
                        {bucket.bucket}
                      </span>
                      <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded ${overdue ? 'bg-destructive/70' : 'bg-primary/60'}`}
                          style={{ width: `${(bucket.amount / scale) * 100}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm font-mono tabular-nums">
                        {money(bucket.amount)}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                        {bucket.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {a.no_due_date.count > 0 && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {money(a.no_due_date.amount)} across {a.no_due_date.count}{' '}
                    invoice{a.no_due_date.count === 1 ? '' : 's'} carries no due
                    date, so it is neither current nor overdue &mdash; it is
                    unchaseable. Counted in the balance above, kept out of the
                    bands, because calling it current would be as wrong as
                    calling it late.
                  </span>
                </p>
              )}

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Where the balance is sitting
                </p>
                <div className="space-y-2">
                  {a.funnel.map((stage) => (
                    <div key={stage.stage} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{stage.label}</span>
                        <span className="font-mono tabular-nums text-sm">
                          {money(stage.amount)}
                          <span className="text-muted-foreground text-xs ml-2">
                            {stage.count} item{stage.count === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stage.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {a.most_overdue.length > 0 && (
                <>
                  <Separator />
                  <div className="overflow-x-auto">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Most overdue
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="py-2 pr-4 font-medium">Invoice</th>
                          <th className="py-2 pr-4 font-medium">Vendor</th>
                          <th className="py-2 pr-4 font-medium text-right">Amount</th>
                          <th className="py-2 font-medium text-right">Days late</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.most_overdue.map((row) => (
                          <tr key={row.invoice_id} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">
                              {row.invoice_number}
                            </td>
                            <td className="py-2 pr-4">{row.vendor ?? '—'}</td>
                            <td className="py-2 pr-4 text-right font-mono tabular-nums">
                              {money(row.amount)}
                            </td>
                            <td className="py-2 text-right">
                              <Badge
                                variant="outline"
                                className="font-normal bg-destructive/10 text-destructive border-destructive/30"
                              >
                                {row.days_overdue}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>

        <Panel
          icon={<PieChart className="h-4 w-4 text-primary" />}
          title="Spend analytics"
          description="Approved and paid spend by vendor, GL account and cost centre."
          state={spend}
          forbiddenNote={FORBIDDEN}
        >
          {!s || s.total_spend === 0 ? (
            <Empty>No approved spend in this window.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {[90, 365, 730].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={spendDays === d ? 'default' : 'outline'}
                    onClick={() => setSpendDays(d)}
                  >
                    {d === 365 ? '1 year' : d === 730 ? '2 years' : '90 days'}
                  </Button>
                ))}
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <Stat label="Total spend" value={money(s.total_spend)} />
                {/* Withheld below six vendors rather than shown as the 100%
                    it always is there. A headline 100% reads as an alarm about
                    exposure when the fact is only that the supplier list is
                    short — which the vendor count already says. */}
                <Stat
                  label="Top 5 vendor share"
                  value={
                    s.top_5_vendor_share_pct === null
                      ? '—'
                      : `${s.top_5_vendor_share_pct}%`
                  }
                  hint={
                    s.top_5_vendor_share_pct === null
                      ? `only ${s.vendor_count} vendor${s.vendor_count === 1 ? '' : 's'}, so concentration says nothing yet`
                      : `across ${s.vendor_count} vendors`
                  }
                />
                <Stat label="Invoices" value={String(s.invoice_count)} />
              </div>

              {(s.unclassified.no_gl_account > 0
                || s.unclassified.no_cost_centre > 0) && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {s.unclassified.no_gl_account_pct}% of this spend
                    ({money(s.unclassified.no_gl_account)}) carries no GL
                    account and {s.unclassified.no_cost_centre_pct}% no cost
                    centre. It is in the total above and absent from the
                    breakdowns below, so those two will not add up &mdash;
                    deliberately. The unclassified share is the part nobody has
                    had to justify.
                  </span>
                </p>
              )}

              <Separator />

              <SpendTable title="By vendor" rows={s.by_vendor} />
              <SpendTable
                title="By GL account"
                rows={s.by_gl_account}
                empty="No invoice in this window carries a GL account code."
              />
              <SpendTable
                title="By cost centre"
                rows={s.by_cost_centre}
                empty="No invoice in this window carries a cost centre."
              />

              <p className="text-xs text-muted-foreground">
                No breakdown by category. Invoices carry a GL account and a cost
                centre and no category, so charting one would mean inventing it
                here rather than measuring it.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** One spend dimension. Bars scale within the table, not across tables — the
 *  question is "which of these", never "is vendor spend bigger than GL spend",
 *  which is the same money counted twice. */
function SpendTable({
  title, rows, empty,
}: {
  title: string;
  rows: Array<{ key: string; count: number; amount: number }>;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
        <p className="text-xs text-muted-foreground">{empty ?? 'Nothing to show.'}</p>
      </div>
    );
  }
  const scale = peak(rows.map((r) => r.amount));
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.slice(0, 10).map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-xs" title={row.key}>
              {row.key}
            </span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div
                className="h-full rounded bg-primary/60"
                style={{ width: `${(row.amount / scale) * 100}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-sm font-mono tabular-nums">
              {money(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
