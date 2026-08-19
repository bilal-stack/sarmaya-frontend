'use client';

/**
 * The Executive Control Room, and the six dashboards behind it.
 *
 * Build Book: *"what is stuck, why it is stuck, and cash impact."* The order of
 * that sentence is the design. The page opens with one number — the money not
 * moving — because "48 items pending" and "4.2M pending" prompt different
 * conversations, and only the second one gets a meeting.
 *
 * Everything below it answers "why", and every row links to the place the work
 * actually happens. A dashboard that can only be looked at is a report; the
 * point of this one is that each line is a route to the thing that would clear
 * it.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { DashboardOverview, AgeBucket } from '@/types/dashboards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, RefreshCw, ArrowRight, AlertTriangle, Timer, ShieldAlert,
  Landmark, Bot, FileWarning, TrendingUp, Gauge,
} from 'lucide-react';

const money = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Longest bar in a set, for scaling. Never zero, so a lone value still shows. */
const peak = (values: number[]) => Math.max(1, ...values);

export default function ControlRoomPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.DASHBOARD.OVERVIEW, {}, user.access_token
      );
      if (!response.ok) throw new Error('Could not load the dashboards');
      setData(await response.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || (isLoading && !data)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || !data) return null;

  const { control_room, approval_bottlenecks, exceptions, policy_overrides,
          evidence, reconciliation, autopilot } = data;

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
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* The one number. */}
      <Card className={control_room.total_amount_stuck > 0 ? 'border-primary/40' : undefined}>
        <CardContent className="py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Not moving</p>
              <p className="text-4xl font-bold mt-1">
                {money(control_room.total_amount_stuck)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                across {control_room.total_items_stuck} item
                {control_room.total_items_stuck === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                <TrendingUp className="h-4 w-4" />
                Paid, last 30 days
              </p>
              <p className="text-2xl font-semibold mt-1">
                {money(control_room.paid_last_30_days.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {control_room.paid_last_30_days.runs} run
                {control_room.paid_last_30_days.runs === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Why. */}
      <div className="mt-6 space-y-2">
        {control_room.blocked.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">Nothing is stuck</p>
              <p className="text-sm text-muted-foreground mt-1">
                No invoice, vendor or payment run is waiting on anybody.
              </p>
            </CardContent>
          </Card>
        ) : (
          control_room.blocked.map((row) => {
            const share =
              (row.amount / Math.max(control_room.total_amount_stuck, 1)) * 100;
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
          })
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-8">
        {/* Bottlenecks */}
        <Panel
          icon={<Timer className="h-5 w-5 text-primary" />}
          title="Approval bottlenecks"
          description={`Cycle time by role, last ${approval_bottlenecks.window_days} days.`}
        >
          {approval_bottlenecks.by_role.length === 0 ? (
            <Empty>No decisions in this window.</Empty>
          ) : (
            <div className="space-y-3">
              {approval_bottlenecks.by_role.map((row) => (
                <div key={row.role}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.role}</span>
                    <span className="text-muted-foreground">
                      {row.median_hours}h median · {row.decisions} decisions
                    </span>
                  </div>
                  <Progress
                    value={(row.median_hours / peak(
                      approval_bottlenecks.by_role.map((r) => r.median_hours)
                    )) * 100}
                    className="h-1.5 mt-1"
                  />
                  {row.average_hours > row.median_hours * 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Average {row.average_hours}h — a few very slow cases, not a
                      slow queue.
                    </p>
                  )}
                </div>
              ))}
              <Separator />
              <p className="text-xs text-muted-foreground">Still waiting</p>
              <Buckets buckets={approval_bottlenecks.still_waiting} />
            </div>
          )}
        </Panel>

        {/* Exceptions */}
        <Panel
          icon={<ShieldAlert className="h-5 w-5 text-primary" />}
          title="Exceptions"
          description={`What was refused, last ${exceptions.window_days} days.`}
        >
          {exceptions.total === 0 ? (
            <Empty>Nothing was blocked.</Empty>
          ) : (
            <div className="space-y-3">
              {exceptions.by_reason.slice(0, 5).map((row) => (
                <div key={row.reason} className="flex items-center justify-between text-sm">
                  <span className="truncate">{row.reason.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{row.count}</Badge>
                </div>
              ))}
              {exceptions.by_vendor.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">Most affected vendors</p>
                  {exceptions.by_vendor.slice(0, 3).map((row) => (
                    <div key={row.vendor} className="flex items-center justify-between text-sm">
                      <span className="truncate">{row.vendor}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Panel>

        {/* Reconciliation */}
        <Panel
          icon={<Landmark className="h-5 w-5 text-primary" />}
          title="Reconciliation health"
          description="Money that left with nothing accounting for it."
        >
          <div className="flex items-baseline gap-3">
            <p className={`text-2xl font-semibold ${
              reconciliation.unexplained_count > 0 ? 'text-red-500' : ''
            }`}>
              {money(reconciliation.unexplained_amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              {reconciliation.unexplained_count} unexplained
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {reconciliation.match_rate_pct}% of bank lines matched to a payment run.
          </p>
          <div className="mt-3">
            <Buckets buckets={reconciliation.aging} />
          </div>
          {reconciliation.unexplained_count > 0 && (
            <Button
              variant="ghost" size="sm" className="mt-2 -ml-2"
              onClick={() => router.push('/ai-tools/reconciliation')}
            >
              Investigate
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </Panel>

        {/* Evidence */}
        <Panel
          icon={<FileWarning className="h-5 w-5 text-primary" />}
          title="Evidence completeness"
          description="What would fail an audit right now."
        >
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-semibold">{evidence.completeness_pct}%</p>
            <p className="text-sm text-muted-foreground">complete</p>
          </div>
          <Progress value={evidence.completeness_pct} className="h-1.5 mt-2" />
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <Stat label="No document" value={evidence.missing_document} warn />
            <Stat label="Late approvals" value={evidence.breached_sla} warn />
            <Stat label="Unreviewed alerts" value={evidence.unreviewed_watchlist_alerts} warn />
          </div>
        </Panel>

        {/* Overrides */}
        <Panel
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
          title="Policy overrides"
          description={`Controls set aside, last ${policy_overrides.window_days} days.`}
        >
          {policy_overrides.total === 0 ? (
            <Empty>No overrides.</Empty>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Overrides are legitimate and always carry a reason. One person
                holding most of them is the thing to look at.
              </p>
              {policy_overrides.by_person.map((row) => (
                <div key={row.who} className="flex items-center justify-between text-sm">
                  <span className="truncate">{row.who}</span>
                  <span className="text-muted-foreground">
                    {row.count} · {money(row.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Autopilot */}
        <Panel
          icon={<Bot className="h-5 w-5 text-primary" />}
          title="Autopilot health"
          description={`Machine decisions, last ${autopilot.window_days} days.`}
        >
          {autopilot.auto_approved === 0 ? (
            <Empty>Autopilot has approved nothing in this window.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Approved" value={autopilot.auto_approved} />
                <Stat label="Reverted" value={autopilot.reverted} warn />
                <Stat
                  label="Reversal rate"
                  value={`${autopilot.reversal_rate_pct}%`}
                  warn={autopilot.reversal_rate_pct > 5}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Approving a lot is only good news while the reversal rate stays
                near zero — read them together.
              </p>
              {autopilot.schema_failures > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {autopilot.schema_failures} AI response(s) failed validation and
                  fell back. That is the validator working, but a rising share
                  means a prompt or model has drifted.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
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
