'use client';

/**
 * The notification queue.
 *
 * Notifications are written in the same transaction as the action that
 * produced them and delivered afterwards by a scheduler, so nothing is sent
 * from a request. The failure mode that creates is quiet: if nobody runs the
 * drain, or SMTP is switched off, the app looks perfectly healthy while
 * approval requests and SLA escalations go nowhere.
 *
 * So this screen leads with the one number that matters — how long the oldest
 * unsent message has been waiting — rather than with a list. A queue that is
 * moving needs no attention; a queue that is not needs it immediately, and the
 * difference should be visible without reading rows.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { QueuedMessage, QueueSummary, DispatchResult, QueueStatus } from '@/types/notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Mail, RefreshCw, Send, AlertTriangle, CheckCircle2,
  Clock, ShieldAlert, RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_TONE: Record<QueueStatus, string> = {
  pending: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  sent: 'border-green-500/50 bg-green-500/10 text-green-600',
  failed: 'border-red-500/50 bg-red-500/10 text-red-600',
};

const FILTERS: Array<{ key: QueueStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'pending', label: 'Waiting' },
  { key: 'failed', label: 'Gave up' },
  { key: 'sent', label: 'Sent' },
];

/** Anything unsent for longer than this means nothing is draining the queue. */
const STALE_HOURS = 1;

export default function NotificationQueuePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<QueuedMessage[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueStatus | 'all'>('all');
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);

      const [queueRes, summaryRes] = await Promise.all([
        apiFetch(`${API_ENDPOINTS.NOTIFICATIONS.QUEUE}?${params.toString()}`, {}, user.access_token),
        apiFetch(API_ENDPOINTS.NOTIFICATIONS.SUMMARY, {}, user.access_token),
      ]);
      if (queueRes.status === 403) {
        setDenied(true);
        return;
      }
      if (!queueRes.ok) throw new Error('Could not load the queue');
      setMessages(await queueRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
      setDenied(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, filter, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, url: string, describe: (body: any) => string) => {
    if (!user?.access_token) return;
    setBusy(key);
    try {
      const response = await apiFetch(url, { method: 'POST' }, user.access_token);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'The server refused this');
      }
      toast({ title: describe(await response.json()) });
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not permitted', description: error.message });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || (isLoading && messages.length === 0 && !denied)) {
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
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">This is an operations screen</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              The queue holds message bodies, which quote records and their
              amounts, so reading it needs the same authority as managing the
              workflow itself.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The headline: how long has the oldest unsent message been waiting? A count
  // alone cannot distinguish a queue draining every minute from one that
  // stopped draining a week ago.
  const waiting = messages.filter((m) => m.status === 'pending');
  const oldestWaiting = waiting.reduce<Date | null>((oldest, m) => {
    const created = parseApiDate(m.created_at);
    return !oldest || created < oldest ? created : oldest;
  }, null);
  const stalled =
    oldestWaiting !== null &&
    Date.now() - oldestWaiting.getTime() > STALE_HOURS * 3600_000;
  const gaveUp = summary?.failed ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Mail className="h-7 w-7 text-primary" />
            Notification queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Messages are queued with the action that produced them and sent by a
            scheduler, so no request ever waits on a mail server.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              act('dispatch', API_ENDPOINTS.NOTIFICATIONS.DISPATCH, (r: DispatchResult) =>
                r.held
                  ? `${r.held} held — SMTP is switched off`
                  : `${r.sent} sent, ${r.retrying} retrying, ${r.failed} gave up`
              )
            }
          >
            {busy === 'dispatch' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send now
          </Button>
        </div>
      </div>

      {stalled && (
        <Card className="mb-6 border-red-500/40 bg-red-500/[0.06]">
          <CardContent className="flex items-start gap-2 py-4">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-600">
                Nothing has been sent for{' '}
                {formatDistanceToNow(oldestWaiting!)} — approvals and
                escalations are going nowhere
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Either no scheduler is running the drain, or SMTP is switched
                off. Sending now will tell you which: messages are reported as
                <span className="font-medium"> held</span> when SMTP is off, and
                they keep their retries rather than expiring.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {gaveUp > 0 && (
        <Card className="mb-6 border-orange-500/40 bg-orange-500/[0.06]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-600">
                  {gaveUp} message(s) gave up after repeated failures
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fix the cause first — the error is on each row below. Requeuing
                  before then just spends the attempts again.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                act('retry', API_ENDPOINTS.NOTIFICATIONS.RETRY_FAILED,
                    (r: { requeued: number }) => `${r.requeued} requeued`)
              }
            >
              {busy === 'retry' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Requeue them
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Tile label="Waiting" value={summary?.pending ?? 0}
              tone={stalled ? 'text-red-500' : undefined} />
        <Tile label="Gave up" value={gaveUp}
              tone={gaveUp > 0 ? 'text-orange-500' : undefined} />
        <Tile label="Sent" value={summary?.sent ?? 0} />
        <Tile
          label="Oldest waiting"
          text={oldestWaiting ? formatDistanceToNow(oldestWaiting) : '—'}
          tone={stalled ? 'text-red-500' : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nothing here</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all'
                ? 'No notification has been queued yet.'
                : `No ${filter} messages.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  label, value, text, tone,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone ?? ''}`}>
          {text ?? value}
        </p>
      </CardContent>
    </Card>
  );
}

function MessageRow({ message }: { message: QueuedMessage }) {
  const failed = message.status === 'failed';
  return (
    <Card className={failed ? 'border-red-500/30' : undefined}>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm truncate">{message.subject}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {message.to_email}
              {message.category && ` · ${message.category.replace(/_/g, ' ')}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {message.attempts > 0 && (
              <span className="text-xs text-muted-foreground">
                {message.attempts} attempt{message.attempts === 1 ? '' : 's'}
              </span>
            )}
            <Badge variant="outline" className={STATUS_TONE[message.status]}>
              {message.status}
            </Badge>
          </div>
        </div>

        {message.last_error && (
          <>
            <Separator className="my-2" />
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
              {message.last_error}
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>
            queued {formatDistanceToNow(parseApiDate(message.created_at), { addSuffix: true })}
          </span>
          {message.status === 'pending' && message.next_attempt_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              next try{' '}
              {formatDistanceToNow(parseApiDate(message.next_attempt_at), { addSuffix: true })}
            </span>
          )}
          {message.sent_at && (
            <span>
              sent {formatDistanceToNow(parseApiDate(message.sent_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
