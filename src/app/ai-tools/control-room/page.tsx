'use client';

/**
 * The Executive Control Room, and the six dashboards behind it.
 *
 * Build Book: *"what is stuck, why it is stuck, and cash impact."* The order of
 * that sentence is the design. The page opens with one number — the money not
 * moving — because "48 items pending" and "19.4M pending" prompt different
 * conversations, and only the second one gets a meeting.
 *
 * Everything below it answers "why", and every row links to the place the work
 * actually happens. A dashboard that can only be looked at is a report; the
 * point of this one is that each line is a route to the thing that would clear
 * it.
 *
 * **Each panel loads on its own.** The frame renders immediately and cards fill
 * as their answers arrive. That is better to look at, and it is also faster:
 * the combined endpoint runs its seven queries in sequence on the server
 * (~350ms over a year of volume) where in parallel the page is done when the
 * slowest lands (188ms). One panel failing costs one card, not the page.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import type {
  ControlRoom, Bottlenecks, ExceptionsHeatmap, PolicyOverrides, SodViolations,
  EvidenceCompleteness, ReconciliationHealth, AutopilotHealth, AgeBucket,
} from '@/types/dashboards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadWithAuth } from '@/lib/download';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, RefreshCw, ArrowRight, AlertTriangle, Timer, ShieldAlert,
  Landmark, Bot, FileWarning, TrendingUp, Gauge, Download,
} from 'lucide-react';

const money = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Longest bar in a set, for scaling. Never zero, so a lone value still shows. */
const peak = (values: number[]) => Math.max(1, ...values);

export default function ControlRoomPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  // The figures are recomputed server-side for the file rather than dumped
  // from what this page happens to be holding: a report somebody files should
  // not depend on how stale the tab was when they clicked.
  const download = async (format: 'csv' | 'html') => {
    if (!user?.access_token) return;
    setDownloading(true);
    try {
      await downloadWithAuth(
        API_ENDPOINTS.DASHBOARD.EXPORT('control-room', format),
        user.access_token,
        `control-room.${format}`,
      );
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not download',
        description: error.message,
      });
    } finally {
      setDownloading(false);
    }
  };

  // One counter, bumped by Refresh, that every panel watches. Each reloads
  // itself rather than the page re-mounting and blanking what is already there.
  const [reloadKey, setReloadKey] = useState(0);

  const controlRoom = usePanel<ControlRoom>(API_ENDPOINTS.DASHBOARD.CONTROL_ROOM, reloadKey);
  const bottlenecks = usePanel<Bottlenecks>(API_ENDPOINTS.DASHBOARD.BOTTLENECKS, reloadKey);
  const exceptions = usePanel<ExceptionsHeatmap>(API_ENDPOINTS.DASHBOARD.EXCEPTIONS, reloadKey);
  const overrides = usePanel<PolicyOverrides>(API_ENDPOINTS.DASHBOARD.POLICY_OVERRIDES, reloadKey);
  // 403s for ordinary roles on a page they can otherwise read — the panel
  // says so rather than offering a retry. See Panel's forbiddenNote.
  const sod = usePanel<SodViolations>(API_ENDPOINTS.DASHBOARD.SOD_VIOLATIONS, reloadKey);
  const evidence = usePanel<EvidenceCompleteness>(API_ENDPOINTS.DASHBOARD.EVIDENCE, reloadKey);
  const reconciliation = usePanel<ReconciliationHealth>(
    API_ENDPOINTS.DASHBOARD.RECONCILIATION_HEALTH, reloadKey
  );
  const autopilot = usePanel<AutopilotHealth>(API_ENDPOINTS.DASHBOARD.AUTOPILOT_HEALTH, reloadKey);

  const anyLoading = [
    controlRoom, bottlenecks, exceptions, overrides, sod, evidence,
    reconciliation, autopilot,
  ].some((p) => p.loading);

  // Send an unauthenticated visitor to sign in. Dropping this when the page
  // moved to per-panel loading turned "not signed in" into a blank screen —
  // the panels never load without a token, so nothing would ever appear.
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Deliberately no full-page spinner otherwise. The heading, the layout and
  // every card frame are correct before any request returns, so nothing jumps.
  if (!authLoading && !user) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Gauge className="h-7 w-7 text-primary" />
            Control room
          </h1>
          <p className="text-muted-foreground mt-1">
            What is stuck, why, and what it is worth.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={downloading}>
                {downloading
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Download className="h-4 w-4 mr-2" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Download this report</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => download('csv')}>
                <div>
                  <p className="font-medium">Spreadsheet (CSV)</p>
                  <p className="text-xs text-muted-foreground">
                    What is stuck, as rows.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => download('html')}>
                <div>
                  <p className="font-medium">Document</p>
                  <p className="text-xs text-muted-foreground">
                    The whole report. Print to PDF from your browser.
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline" size="sm"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={anyLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${anyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* The one number. */}
      <Card className={
        controlRoom.data && controlRoom.data.total_amount_stuck > 0
          ? 'border-primary/40' : undefined
      }>
        <CardContent className="py-6">
          {controlRoom.loading && !controlRoom.data ? (
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : controlRoom.error ? (
            <PanelError message={controlRoom.error} onRetry={controlRoom.reload} />
          ) : controlRoom.data && (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Not moving</p>
                <p className="text-4xl font-bold mt-1">
                  {money(controlRoom.data.total_amount_stuck)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  across {controlRoom.data.total_items_stuck} item
                  {controlRoom.data.total_items_stuck === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                  <TrendingUp className="h-4 w-4" />
                  Paid, last 30 days
                </p>
                <p className="text-2xl font-semibold mt-1">
                  {money(controlRoom.data.paid_last_30_days.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {controlRoom.data.paid_last_30_days.runs} run
                  {controlRoom.data.paid_last_30_days.runs === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Why. */}
      <div className="mt-6 space-y-2">
        {controlRoom.loading && !controlRoom.data ? (
          <>
            <StuckRowSkeleton />
            <StuckRowSkeleton />
            <StuckRowSkeleton />
          </>
        ) : controlRoom.data && controlRoom.data.blocked.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">Nothing is stuck</p>
              <p className="text-sm text-muted-foreground mt-1">
                No invoice, vendor or payment run is waiting on anybody.
              </p>
            </CardContent>
          </Card>
        ) : controlRoom.data?.blocked.map((row) => {
          const share =
            (row.amount / Math.max(controlRoom.data!.total_amount_stuck, 1)) * 100;
          return (
            <Card key={row.reason}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{row.reason}</p>
                      <Badge variant="outline">{row.count}</Badge>
                      {row.oldest_days > 30 && (
                        <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-600 gap-1">
                          <Timer className="h-3 w-3" />
                          oldest {Math.round(row.oldest_days)}d
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{row.note}</p>
                    <Progress value={share} className="h-1.5 mt-3" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-semibold">{money(row.amount)}</p>
                    <Button
                      variant="ghost" size="sm" className="mt-1"
                      onClick={() => router.push(row.link)}
                    >
                      Open
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-8">
        <Panel
          icon={<Timer className="h-5 w-5 text-primary" />}
          title="Approval bottlenecks"
          description={
            bottlenecks.data
              ? `Cycle time by role, last ${bottlenecks.data.window_days} days.`
              : 'Cycle time by role.'
          }
          state={bottlenecks}
        >
          {bottlenecks.data && (
            bottlenecks.data.by_role.length === 0 ? (
              <Empty>No decisions in this window.</Empty>
            ) : (
              <div className="space-y-3">
                {bottlenecks.data.by_role.map((row) => (
                  <div key={row.role}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{row.role}</span>
                      <span className="text-muted-foreground">
                        {row.median_hours}h median · {row.decisions} decisions
                      </span>
                    </div>
                    <Progress
                      value={(row.median_hours / peak(
                        bottlenecks.data!.by_role.map((r) => r.median_hours)
                      )) * 100}
                      className="h-1.5 mt-1"
                    />
                    {row.average_hours > row.median_hours * 2 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Average {row.average_hours}h — a few very slow cases, not
                        a slow queue.
                      </p>
                    )}
                  </div>
                ))}
                <Separator />
                <p className="text-xs text-muted-foreground">Still waiting</p>
                <Buckets buckets={bottlenecks.data.still_waiting} />
              </div>
            )
          )}
        </Panel>

        <Panel
          icon={<ShieldAlert className="h-5 w-5 text-primary" />}
          title="Exceptions"
          description={
            exceptions.data
              ? `What was refused, last ${exceptions.data.window_days} days.`
              : 'What was refused.'
          }
          state={exceptions}
        >
          {exceptions.data && (
            exceptions.data.total === 0 ? (
              <Empty>Nothing was blocked.</Empty>
            ) : (
              <div className="space-y-3">
                {exceptions.data.by_reason.slice(0, 5).map((row) => (
                  <div key={row.reason} className="flex items-center justify-between text-sm">
                    <span className="truncate">{row.reason.replace(/_/g, ' ')}</span>
                    <Badge variant="outline">{row.count}</Badge>
                  </div>
                ))}
                {exceptions.data.by_vendor.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs text-muted-foreground">Most affected vendors</p>
                    {exceptions.data.by_vendor.slice(0, 3).map((row) => (
                      <div key={row.vendor} className="flex items-center justify-between text-sm">
                        <span className="truncate">{row.vendor}</span>
                        <span className="text-muted-foreground">{row.count}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          )}
        </Panel>

        <Panel
          icon={<Landmark className="h-5 w-5 text-primary" />}
          title="Reconciliation health"
          description="Money that left with nothing accounting for it."
          state={reconciliation}
        >
          {reconciliation.data && (
            <>
              <div className="flex items-baseline gap-3">
                <p className={`text-2xl font-semibold ${
                  reconciliation.data.unexplained_count > 0 ? 'text-red-500' : ''
                }`}>
                  {money(reconciliation.data.unexplained_amount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {reconciliation.data.unexplained_count} unexplained
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {reconciliation.data.match_rate_pct}% of bank lines matched to a
                payment run.
              </p>
              <div className="mt-3">
                <Buckets buckets={reconciliation.data.aging} />
              </div>
              {reconciliation.data.unexplained_count > 0 && (
                <Button
                  variant="ghost" size="sm" className="mt-2 -ml-2"
                  onClick={() => router.push('/ai-tools/reconciliation')}
                >
                  Investigate
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </Panel>

        <Panel
          icon={<FileWarning className="h-5 w-5 text-primary" />}
          title="Evidence completeness"
          description="What would fail an audit right now."
          state={evidence}
        >
          {evidence.data && (
            <>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-semibold">
                  {evidence.data.completeness_pct}%
                </p>
                <p className="text-sm text-muted-foreground">complete</p>
              </div>
              <Progress value={evidence.data.completeness_pct} className="h-1.5 mt-2" />
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Stat label="No document" value={evidence.data.missing_document} warn />
                <Stat label="Late approvals" value={evidence.data.breached_sla} warn />
                <Stat
                  label="Unreviewed alerts"
                  value={evidence.data.unreviewed_watchlist_alerts}
                  warn
                />
              </div>
            </>
          )}
        </Panel>

        <Panel
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
          title="Policy overrides"
          description={
            overrides.data
              ? `Controls set aside, last ${overrides.data.window_days} days.`
              : 'Controls set aside.'
          }
          state={overrides}
        >
          {overrides.data && (
            overrides.data.total === 0 ? (
              <Empty>No overrides.</Empty>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Overrides are legitimate and always carry a reason. One person
                  holding most of them is the thing to look at.
                </p>
                {overrides.data.by_person.map((row) => (
                  <div key={row.who} className="flex items-center justify-between text-sm">
                    <span className="truncate">{row.who}</span>
                    <span className="text-muted-foreground">
                      {row.count} · {money(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </Panel>

        <Panel
          icon={<ShieldAlert className="h-5 w-5 text-primary" />}
          title="Blocked attempts"
          description={
            sod.data
              ? `Refused by a control, last ${sod.data.window_days} days.`
              : 'Refused by a control.'
          }
          state={sod}
          forbiddenNote="Your role cannot see this. It names who was refused, so it reads with the audit permission rather than the dashboard one."
        >
          {sod.data && (
            sod.data.total_blocked === 0 ? (
              // Deliberately not the neutral "No results." A control that has
              // never fired looks, from outside, exactly like a control that
              // was never wired up, and this panel exists to tell them apart.
              <Empty>Nothing was refused. The controls held.</Empty>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-2xl font-semibold">{sod.data.sod_blocked}</div>
                    <div className="text-xs text-muted-foreground">
                      separation of duties
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-muted-foreground">
                      {sod.data.other_blocked}
                    </div>
                    <div className="text-xs text-muted-foreground">other gates</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Counted apart on purpose: someone trying to approve their own
                  invoice and someone approving one with no vendor linked are
                  both refusals, and only one is a segregation failure.
                </p>
                {sod.data.by_reason.slice(0, 4).map((row) => (
                  <div
                    key={row.reason}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">{row.label}</span>
                    <span className="text-muted-foreground shrink-0">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </Panel>

        <Panel
          icon={<Bot className="h-5 w-5 text-primary" />}
          title="Autopilot health"
          description={
            autopilot.data
              ? `Machine decisions, last ${autopilot.data.window_days} days.`
              : 'Machine decisions.'
          }
          state={autopilot}
        >
          {autopilot.data && (
            autopilot.data.auto_approved === 0 ? (
              <Empty>Autopilot has approved nothing in this window.</Empty>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Approved" value={autopilot.data.auto_approved} />
                  <Stat label="Reverted" value={autopilot.data.reverted} warn />
                  <Stat
                    label="Reversal rate"
                    value={`${autopilot.data.reversal_rate_pct}%`}
                    warn={autopilot.data.reversal_rate_pct > 5}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Approving a lot is only good news while the reversal rate stays
                  near zero — read them together.
                </p>
                {autopilot.data.schema_failures > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {autopilot.data.schema_failures} AI response(s) failed
                    validation and fell back. That is the validator working, but
                    a rising share means a prompt or model has drifted.
                  </p>
                )}
              </>
            )
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * A panel frame that owns its own loading and failure states.
 *
 * The title and description render immediately, so the page is readable and
 * correctly laid out before any answer arrives — the card fills, it does not
 * appear.
 */
function Panel({
  icon, title, description, state, children, forbiddenNote,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: {
    loading: boolean; error: string | null; data: unknown;
    reload: () => void; status?: number | null;
  };
  children: React.ReactNode;
  /** Shown instead of the error-and-retry when the answer is 403. Not every
   *  panel on this page reads with the same permission, and "you may not see
   *  this" is a fact rather than a failure — offering somebody a retry button
   *  for a permission they do not have makes a working page look broken. */
  forbiddenNote?: string;
}) {
  // Skeleton only when there is nothing to show yet. On a refresh the figures
  // stay put and the small header spinner does the talking — blanking numbers
  // somebody is reading, to replace them with the same numbers, is a flicker
  // that makes the page feel less trustworthy rather than more current.
  const firstLoad = state.loading && state.data === null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          {state.loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {firstLoad ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : state.status === 403 && forbiddenNote ? (
          <p className="py-2 text-sm text-muted-foreground">{forbiddenNote}</p>
        ) : state.error ? (
          <PanelError message={state.error} onRetry={state.reload} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="ghost" size="sm" className="mt-1" onClick={onRetry}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Try again
      </Button>
    </div>
  );
}

function StuckRowSkeleton() {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-1.5 w-full" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function Buckets({ buckets }: { buckets: AgeBucket[] }) {
  const top = peak(buckets.map((b) => b.count));
  return (
    <div className="space-y-1.5">
      {buckets.map((bucket) => (
        <div key={bucket.bucket} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-24 shrink-0">
            {bucket.bucket}
          </span>
          <Progress
            value={(bucket.count / top) * 100}
            className={`h-1.5 flex-1 ${
              bucket.bucket === 'over 30 days' && bucket.count > 0
                ? '[&>div]:bg-red-500' : ''
            }`}
          />
          <span className="text-xs tabular-nums w-8 text-right">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({
  label, value, warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  const isProblem = warn && (typeof value === 'number' ? value > 0 : true);
  return (
    <div>
      <p className={`text-lg font-semibold ${isProblem ? 'text-orange-500' : ''}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{children}</p>;
}
