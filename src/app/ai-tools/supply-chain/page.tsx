'use client';

/**
 * COO / Supply Chain.
 *
 * Build Book, Standard Report Catalog: "inventory turns, stockout risk, P2P
 * cycle." Two of the three are here; stockout risk needs demand forecasting
 * that this system does not do, and a "risk" built from a reorder point alone
 * would be a restatement of the reorder point.
 *
 * The purchase-to-pay panel is drawn as five separate hops rather than one
 * total. Each hop is a handover between two different teams, which is where
 * elapsed time actually accumulates — the work inside a step is rarely the
 * problem. An end-to-end figure is a number nobody owns, so the slow hop is
 * called out by name and the total is shown as the sum of the parts.
 *
 * Turns lead with how much of the warehouse the figure actually covers, not
 * with the ratio. A turns number computed over half a warehouse is not wrong,
 * but it is not the business either, and the reader has to know which before
 * the number means anything.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Panel, Empty, Stat, money, peak } from '@/components/reports/panel';
import type { InventoryTurns, P2PCycleTime } from '@/types/dashboards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, RefreshCw, Boxes, Repeat, Workflow, AlertTriangle,
} from 'lucide-react';

const TURNS_FORBIDDEN =
  'Stock figures read with inventory.view. Your role does not have it.';
const P2P_FORBIDDEN =
  'This aggregates records across five modules and reads with invoices.view.';

export default function SupplyChainPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [turnsDays, setTurnsDays] = useState(365);

  const turns = usePanel<InventoryTurns>(
    API_ENDPOINTS.DASHBOARD.INVENTORY_TURNS(turnsDays), reloadKey + turnsDays,
  );
  const p2p = usePanel<P2PCycleTime>(
    API_ENDPOINTS.DASHBOARD.P2P_CYCLE_TIME(), reloadKey,
  );
  const anyLoading = turns.loading || p2p.loading;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  const t = turns.data;
  const p = p2p.data;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" />
            Supply Chain
          </h1>
          <p className="text-muted-foreground mt-1">
            How fast stock moves, and how long a purchase takes end to end.
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

      <div className="space-y-6">
        <Panel
          icon={<Repeat className="h-4 w-4 text-primary" />}
          title="Inventory turns"
          description="Cost of goods issued over the average value held."
          state={turns}
          forbiddenNote={TURNS_FORBIDDEN}
        >
          {!t || t.turns_per_year === null ? (
            <Empty>
              No costed stock on hand, so there is nothing to turn over.
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {[90, 365, 730].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={turnsDays === d ? 'default' : 'outline'}
                    onClick={() => setTurnsDays(d)}
                  >
                    {d === 90 ? '90 days' : d === 365 ? '1 year' : '2 years'}
                  </Button>
                ))}
              </div>

              {/* Coverage first. A ratio computed over half a warehouse is not
                  wrong, but it is not the business either. */}
              {t.uncosted.item_count > 0 && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {t.uncosted.item_count} item
                    {t.uncosted.item_count === 1 ? '' : 's'} carrying{' '}
                    {t.uncosted.units_on_hand.toLocaleString()} units{' '}
                    {t.uncosted.item_count === 1 ? 'has' : 'have'} no standard
                    cost, so {t.uncosted.item_count === 1 ? 'it is' : 'they are'}{' '}
                    in none of the figures below.
                    Costing them at zero would give the identical ratio &mdash;
                    zero contributes nothing to either half &mdash; so this is
                    not a distorted number, it is a partial one. How partial is
                    the thing worth knowing before reading it.
                  </span>
                </p>
              )}

              <div className="grid gap-6 sm:grid-cols-3">
                <Stat
                  label="Turns per year"
                  value={t.turns_per_year}
                  hint={`annualised from a ${t.window_days}-day window`}
                />
                <Stat
                  label="Days of stock"
                  value={t.days_of_stock === null ? '—' : t.days_of_stock}
                  hint="at the current rate of issue"
                />
                <Stat
                  label="Cost of goods issued"
                  value={money(t.cogs)}
                  hint="issues only — transfers and receipts are not turnover"
                />
              </div>

              <Separator />

              <div className="grid gap-6 sm:grid-cols-3">
                <Stat
                  label="Opening value"
                  value={money(t.opening_value)}
                  hint="reconstructed from the movement ledger"
                />
                <Stat label="Closing value" value={money(t.closing_value)} />
                <Stat label="Average held" value={money(t.average_value)} />
              </div>

              <p className="text-xs text-muted-foreground">
                The opening balance is not estimated. It is the current balance
                minus the net of every movement in the window &mdash; exact,
                because the stock ledger is append-only and a correction is
                posted as an opposing movement rather than an edit. Using the
                closing value alone would flatter a business that had just run
                its stock down.
              </p>
            </div>
          )}
        </Panel>

        <Panel
          icon={<Workflow className="h-4 w-4 text-primary" />}
          title="Purchase to pay"
          description="Five handovers, from a requisition being approved to a supplier being paid."
          state={p2p}
          forbiddenNote={P2P_FORBIDDEN}
        >
          {!p || p.chains_seen === 0 ? (
            <Empty>No purchases with a complete trail in this window.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-6 sm:grid-cols-2">
                <Stat
                  label="Typical run"
                  value={
                    p.typical_total_days === null
                      ? '—'
                      : `${p.typical_total_days} days`
                  }
                  hint="the sum of the medians, not the median of the totals"
                />
                <Stat
                  label="Purchases followed"
                  value={String(p.chains_seen)}
                  hint="joined by correlation id across five modules"
                />
              </div>

              <div className="space-y-2">
                {p.steps.map((step) => {
                  const scale = peak(p.steps.map((s) => s.median_days ?? 0));
                  const slowest = step.step === p.slowest_step;
                  return (
                    <div
                      key={step.step}
                      className={`rounded-md border p-3 ${slowest ? 'border-amber-500/40' : ''}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">
                          {step.label}
                          {slowest && (
                            <Badge
                              variant="outline"
                              className="ml-2 font-normal bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            >
                              slowest hop
                            </Badge>
                          )}
                        </span>
                        <span className="text-sm font-mono tabular-nums">
                          {step.median_days === null
                            ? <span className="text-muted-foreground">not measured</span>
                            : `${step.median_days}d median`}
                          {step.worst_days !== null && (
                            <span className="text-muted-foreground text-xs ml-2">
                              worst {step.worst_days}d
                            </span>
                          )}
                        </span>
                      </div>
                      {step.median_days !== null && (
                        <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded ${slowest ? 'bg-amber-500/70' : 'bg-primary/60'}`}
                            style={{ width: `${(step.median_days / scale) * 100}%` }}
                          />
                        </div>
                      )}
                      <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                        {step.from} &rarr; {step.to}
                        <span className="ml-2 font-sans">
                          ({step.count} measured)
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                A purchase still in flight counts towards the hops it has
                completed and none after it. Treating a missing end as
                &ldquo;now&rdquo; would make every open purchase look like a
                delay, and the figure would climb whenever business picked up.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
