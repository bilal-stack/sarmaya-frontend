'use client';

/**
 * Procurement Leadership.
 *
 * Build Book, Standard Report Catalog: "RFQ cycle time, savings vs baseline."
 *
 * The cycle is drawn as four separate stages rather than one number, because
 * three of them are delays we own and one is a window we chose to give
 * vendors. A single average hides a fortnight of nobody deciding behind a
 * generous vendor window — and worse, it invites the wrong fix, since the only
 * lever that visibly shortens a blended average is cutting the time suppliers
 * get to respond. Each stage says which kind it is.
 *
 * Savings are two figures side by side, never one. Against the requisition
 * estimate is what somebody committed to before any vendor quoted; against the
 * highest compliant quote is the worst alternative actually on the table.
 * Awards with only one compliant quote are excluded from the second and
 * counted on their own, because an award with nothing to compare against did
 * not save anything — it just happened.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Panel, Empty, Stat, money, peak } from '@/components/reports/panel';
import type { RfqCycleTime } from '@/types/dashboards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, RefreshCw, Gavel, Timer, Users, PiggyBank, AlertTriangle,
} from 'lucide-react';

const FORBIDDEN =
  'These aggregate requisitions and the RFQs raised from them, so they read '
  + 'with requisitions.view. Your role does not have it.';

export default function ProcurementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(180);

  const rfq = usePanel<RfqCycleTime>(
    API_ENDPOINTS.DASHBOARD.RFQ_CYCLE_TIME(days), reloadKey + days,
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  const r = rfq.data;
  const noComparison = r?.savings.awards_with_no_comparison ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-7 w-7 text-primary" />
            Procurement
          </h1>
          <p className="text-muted-foreground mt-1">
            How long sourcing takes, whether anybody competed, and what it saved.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={rfq.loading}
        >
          {rfq.loading
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[90, 180, 365].map((d) => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? 'default' : 'outline'}
            onClick={() => setDays(d)}
          >
            {d === 90 ? '90 days' : d === 180 ? '6 months' : '1 year'}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        <Panel
          icon={<Timer className="h-4 w-4 text-primary" />}
          title="Cycle time"
          description="Four stages, because three are ours and one is not."
          state={rfq}
          forbiddenNote={FORBIDDEN}
        >
          {!r || r.rfq_count === 0 ? (
            <Empty>No RFQs in this window.</Empty>
          ) : (
            <div className="space-y-2">
              {r.stages.map((stage) => {
                const scale = peak(
                  r.stages.map((s) => s.median_days ?? 0),
                );
                // The vendor window is drawn in a different colour from the
                // three we own. Same bar, different meaning.
                const ours = stage.note.startsWith('Ours.');
                return (
                  <div key={stage.stage} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {stage.label}
                        {/* The audit actions this was measured between,
                            small and secondary — useful to somebody
                            reconciling against the trail, noise to everybody
                            else. */}
                        <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                          {stage.from} &rarr; {stage.to}
                        </span>
                      </span>
                      <span className="text-sm font-mono tabular-nums">
                        {stage.median_days === null
                          ? <span className="text-muted-foreground">not measured</span>
                          : `${stage.median_days}d median`}
                        {stage.worst_days !== null && (
                          <span className="text-muted-foreground text-xs ml-2">
                            worst {stage.worst_days}d
                          </span>
                        )}
                      </span>
                    </div>
                    {stage.median_days !== null && (
                      <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded ${ours ? 'bg-primary/70' : 'bg-muted-foreground/40'}`}
                          style={{ width: `${(stage.median_days / scale) * 100}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {stage.note}
                      {stage.count > 0 && (
                        <span className="ml-1">
                          ({stage.count} measured)
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          icon={<Users className="h-4 w-4 text-primary" />}
          title="Competition"
          description="A cycle time says how fast sourcing ran, not whether it did its job."
          state={rfq}
          forbiddenNote={FORBIDDEN}
        >
          {!r ? (
            <Empty>Nothing to show.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-6 sm:grid-cols-3">
                <Stat
                  label="Vendor response rate"
                  value={`${r.competition.response_rate_pct}%`}
                  hint={`${r.competition.quoted} quotes from ${r.competition.invited} invitations`}
                />
                <Stat
                  label="Contested awards"
                  value={String(r.competition.awarded_with_competition)}
                  hint="more than one compliant quote to choose from"
                />
                <Stat
                  label="Single-quote awards"
                  value={String(r.competition.single_quote_awards)}
                  warn
                  hint="sole supply is real, but it should be a decision"
                />
              </div>
              {r.competition.single_quote_awards > 0 && (
                <p className="text-xs text-muted-foreground">
                  An RFQ issued to one vendor who quoted once is a purchase
                  order with extra steps. Not necessarily wrong &mdash; but it
                  is the case somebody should be able to point at, which a
                  cycle-time average never surfaces.
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel
          icon={<PiggyBank className="h-4 w-4 text-primary" />}
          title="Savings"
          description="Two baselines, because neither alone is honest."
          state={rfq}
          forbiddenNote={FORBIDDEN}
        >
          {!r || r.savings.awarded_value === 0 ? (
            <Empty>Nothing awarded in this window.</Empty>
          ) : (
            <div className="space-y-4">
              <Stat label="Awarded value" value={money(r.savings.awarded_value)} />

              <Separator />

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">
                    {r.savings.vs_estimate === null
                      ? '—'
                      : money(r.savings.vs_estimate)}
                    {r.savings.vs_estimate_pct !== null && (
                      <Badge
                        variant="outline"
                        className={`ml-2 font-normal ${
                          r.savings.vs_estimate_pct >= 0
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'
                        }`}
                      >
                        {r.savings.vs_estimate_pct}%
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Against the estimate.</span>{' '}
                    What somebody put in writing on the requisition before any
                    vendor quoted, so it cannot be adjusted afterwards to
                    flatter the number. A negative figure means we spent more
                    than we expected to, and it is shown as such.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {r.savings.vs_highest_quote === null
                      ? '—'
                      : money(r.savings.vs_highest_quote)}
                    {r.savings.vs_highest_quote_pct !== null && (
                      <Badge
                        variant="outline"
                        className="ml-2 font-normal bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      >
                        {r.savings.vs_highest_quote_pct}%
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">
                      Against the worst alternative.
                    </span>{' '}
                    The highest <em>compliant</em> quote on the same RFQ &mdash;
                    a non-compliant quote is not an alternative anybody could
                    have bought, and measuring against one is the easiest way to
                    manufacture a savings figure.
                  </p>
                </div>
              </div>

              {noComparison > 0 && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {noComparison} award{noComparison === 1 ? '' : 's'} had a
                    single compliant quote and {noComparison === 1 ? 'is' : 'are'}{' '}
                    excluded from the second figure. There was nothing to save
                    against, and counting {noComparison === 1 ? 'it' : 'them'} at
                    zero would dilute the rate with awards that never had a
                    comparison.
                  </span>
                </p>
              )}
            </div>
          )}
        </Panel>

        {r && r.overdue_open.length > 0 && (
          <Panel
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            title="Past their close date"
            description="Issued, past the date it said it would close, still open."
            state={rfq}
            forbiddenNote={FORBIDDEN}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Nothing errors when this happens. The RFQ stays open and the
                requisition behind it stays unmet, which is why it needs a
                report to appear at all.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">RFQ</th>
                      <th className="py-2 font-medium text-right">Days past close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.overdue_open.map((row) => (
                      <tr key={row.rfq_id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">
                          {row.rfq_number}
                        </td>
                        <td className="py-2 text-right">
                          <Badge
                            variant="outline"
                            className="font-normal bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          >
                            {row.closed_days_ago}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
