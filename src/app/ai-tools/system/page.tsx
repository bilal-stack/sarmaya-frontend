'use client';

/**
 * System health — the admin console's error monitor.
 *
 * The failures this screen exists to catch are the quiet ones. A background
 * job that throws is already in the logs and already retried; a background job
 * that *stopped* produces nothing at all — no error, no alert, no growing
 * queue if the system happens to be idle — until somebody notices a week later
 * that no email has arrived since Tuesday.
 *
 * So the page leads with staleness rather than errors: when each scheduled job
 * last ran, and whether that is recent enough for its cadence. Everything
 * below is the evidence behind that headline.
 *
 * Deliberately quiet about deliberate configuration. Email delivery being off
 * is the documented default until SMTP is set up, so a queue sitting behind it
 * is shown as a note, not a fault — a monitor that shows red for a setting
 * somebody chose is a monitor people stop reading.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import { usePanel } from '@/hooks/use-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Mail, Bot,
  Info, ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Health = 'ok' | 'degraded' | 'down';

interface JobReading {
  job: string;
  status: Health;
  last_run_at: string | null;
  minutes_since: number | null;
  expected_every_minutes: number;
  last_error: string | null;
  items_processed: number;
  failures_in_window: number;
  detail: string;
}

interface HealthReport {
  status: Health;
  checked_at: string;
  jobs: JobReading[];
  notifications: {
    status: Health;
    pending: number;
    failed: number;
    stuck: number;
    oldest_pending_at: string | null;
    delivery_enabled: boolean;
    detail: string;
  };
  ai: {
    status: Health;
    window_hours: number;
    total: number;
    errors: number;
    schema_rejections: number;
    by_status: Record<string, number>;
    detail: string;
  };
  notes: string[];
}

/** What each job actually is, in the words somebody would use to ask about it. */
const JOB_META: Record<string, { label: string; blurb: string }> = {
  dispatch_notifications: {
    label: 'Notification dispatcher',
    blurb:
      'Sends what the app queued. Notifications are written in the same transaction as the action that caused them and delivered afterwards — this is the afterwards.',
  },
  run_workflow_timers: {
    label: 'Workflow timers',
    blurb:
      'Sends reminders before an SLA is breached and escalates the ones that are. A deadline nobody is watching is not a deadline.',
  },
};

const HEALTH_META: Record<Health, {
  label: string; icon: React.ReactNode; className: string; badge: string;
}> = {
  ok: {
    label: 'Healthy',
    icon: <CheckCircle2 className="h-5 w-5" />,
    className: 'text-emerald-600 dark:text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  degraded: {
    label: 'Degraded',
    icon: <AlertTriangle className="h-5 w-5" />,
    className: 'text-amber-600 dark:text-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  down: {
    label: 'Not running',
    icon: <XCircle className="h-5 w-5" />,
    className: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

function StatusBadge({ status }: { status: Health }) {
  const meta = HEALTH_META[status];
  return (
    <Badge variant="outline" className={meta.badge}>
      {meta.label}
    </Badge>
  );
}

function when(value: string | null): string {
  const parsed = value ? parseApiDate(value) : null;
  if (!parsed) return 'never';
  return formatDistanceToNow(parsed, { addSuffix: true });
}

export default function SystemHealthPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  // Redirect after render rather than instead of it: returning null while
  // unauthenticated turned this into a blank page once already.
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const { data, loading, error, status } = usePanel<HealthReport>(
    API_ENDPOINTS.SYSTEM.HEALTH, reloadKey,
  );

  const forbidden = status === 403;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System health</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Whether the scheduled work is actually running. A job that stops
            raises nothing anywhere, so the only signal is how long it has been
            since it last ran.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {forbidden && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Your role cannot see system health. It shows configuration and
            failure detail, so it is limited to the roles trusted with the audit
            trail.
          </AlertDescription>
        </Alert>
      )}

      {error && !forbidden && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      )}

      {data && (
        <>
          {/* The headline. One word, and it is the worst of the readings
              below — an average would hide an outage behind three greens. */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <span className={HEALTH_META[data.status].className}>
                {HEALTH_META[data.status].icon}
              </span>
              <div className="flex-1 min-w-[12rem]">
                <p className="text-xl font-semibold">
                  {data.status === 'ok'
                    ? 'Everything is running'
                    : data.status === 'degraded'
                      ? 'Running, with problems'
                      : 'Something has stopped'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Checked {when(data.checked_at)}
                </p>
              </div>
              <StatusBadge status={data.status} />
            </CardContent>
          </Card>

          {/* Scheduled jobs, first, because this is the failure nothing else
              would report. */}
          <div className="grid gap-4 md:grid-cols-2">
            {data.jobs.map((job) => {
              const meta = JOB_META[job.job] ?? {
                label: job.job, blurb: 'A scheduled job.',
              };
              return (
                <Card key={job.job}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${HEALTH_META[job.status].className}`} />
                        <CardTitle className="text-base">{meta.label}</CardTitle>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    <CardDescription>{meta.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last run</span>
                      <span className="font-medium">{when(job.last_run_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected every</span>
                      <span className="font-medium">
                        {job.expected_every_minutes === 1
                          ? 'minute'
                          : `${job.expected_every_minutes} minutes`}
                      </span>
                    </div>
                    {job.last_run_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Handled last run</span>
                        <span className="font-medium">{job.items_processed}</span>
                      </div>
                    )}
                    <p className="text-muted-foreground border-t pt-3">{job.detail}</p>
                    {job.last_error && (
                      <p className="font-mono text-xs text-destructive break-all">
                        {job.last_error}
                      </p>
                    )}
                    {job.status === 'down' && (
                      <div className="rounded-md bg-muted p-3 text-xs">
                        <p className="font-medium mb-1">Start it with</p>
                        <code className="break-all">
                          python -m scripts.
                          {job.job === 'dispatch_notifications'
                            ? 'dispatch_notifications'
                            : 'run_workflow_timers'}
                        </code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className={`h-4 w-4 ${HEALTH_META[data.notifications.status].className}`} />
                    <CardTitle className="text-base">Notification queue</CardTitle>
                  </div>
                  <StatusBadge status={data.notifications.status} />
                </div>
                <CardDescription>
                  What is waiting to be delivered, and what has been given up on.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-2xl font-semibold">{data.notifications.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-2xl font-semibold">{data.notifications.stuck}</p>
                    <p className="text-xs text-muted-foreground">Stuck</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className={`text-2xl font-semibold ${data.notifications.failed ? 'text-destructive' : ''}`}>
                      {data.notifications.failed}
                    </p>
                    <p className="text-xs text-muted-foreground">Gave up</p>
                  </div>
                </div>
                {data.notifications.oldest_pending_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Oldest waiting</span>
                    <span className="font-medium">
                      {when(data.notifications.oldest_pending_at)}
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground border-t pt-3">
                  {data.notifications.detail}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className={`h-4 w-4 ${HEALTH_META[data.ai.status].className}`} />
                    <CardTitle className="text-base">AI requests</CardTitle>
                  </div>
                  <StatusBadge status={data.ai.status} />
                </div>
                <CardDescription>
                  The last {data.ai.window_hours} hours. A refused response is
                  the schema guard working, not a fault.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-2xl font-semibold">{data.ai.total}</p>
                    <p className="text-xs text-muted-foreground">Requests</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-2xl font-semibold">{data.ai.schema_rejections}</p>
                    <p className="text-xs text-muted-foreground">Refused</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className={`text-2xl font-semibold ${data.ai.errors ? 'text-destructive' : ''}`}>
                      {data.ai.errors}
                    </p>
                    <p className="text-xs text-muted-foreground">Errored</p>
                  </div>
                </div>
                <p className="text-muted-foreground border-t pt-3">{data.ai.detail}</p>
              </CardContent>
            </Card>
          </div>

          {/* Configuration, stated rather than inferred — so nobody has to work
              out why a panel is green while nothing is being delivered. */}
          {data.notes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Configuration
                </CardTitle>
                <CardDescription>
                  Settings that change what the readings above mean. These are
                  choices, not faults.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.notes.map((note) => (
                  <p key={note} className="text-muted-foreground">
                    {note}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
