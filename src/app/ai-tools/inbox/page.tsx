'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { DecisionInbox, DecisionInboxItem, EscalationResult } from '@/types/governance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePanel } from '@/hooks/use-panel';
import {
  Loader2, Inbox, AlertTriangle, Clock, ShieldAlert, Copy, BadgeCheck,
  ArrowRight, RefreshCw, BellRing, Landmark, Banknote, ClipboardCheck,
  Gavel, FileQuestion,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  // Red is reserved for the two categories where money is already gone or is
  // being redirected. Everything else is ordinary queued work.
  unexplained_debit: {
    label: 'Unexplained debit',
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: 'border-red-500/50 bg-red-500/10 text-red-600',
  },
  vendor_bank_change: {
    label: 'Bank detail change',
    icon: <Landmark className="h-4 w-4" />,
    tone: 'border-red-500/50 bg-red-500/10 text-red-600',
  },
  duplicate_review: {
    label: 'Duplicate review',
    icon: <Copy className="h-4 w-4" />,
    tone: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  },
  vendor_verification: {
    label: 'Vendor verification',
    icon: <ShieldAlert className="h-4 w-4" />,
    tone: 'border-orange-500/50 bg-orange-500/10 text-orange-600',
  },
  payment_release: {
    label: 'Payment release',
    icon: <Banknote className="h-4 w-4" />,
    tone: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600',
  },
  approval: {
    label: 'Invoice approval',
    icon: <BadgeCheck className="h-4 w-4" />,
    tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  },
  purchase_order_approval: {
    label: 'Order approval',
    icon: <ClipboardCheck className="h-4 w-4" />,
    tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  },
  sourcing_award: {
    label: 'Award decision',
    icon: <Gavel className="h-4 w-4" />,
    tone: 'border-violet-500/50 bg-violet-500/10 text-violet-600',
  },
  requisition_approval: {
    label: 'Requisition approval',
    icon: <FileQuestion className="h-4 w-4" />,
    tone: 'border-slate-500/50 bg-slate-500/10 text-slate-600',
  },
};

/** The Build Book's grouping, used for the summary row. */
const WORK_TYPE_LABEL: Record<string, string> = {
  approval: 'Approvals',
  exception: 'Exceptions',
  review: 'AI reviews',
  reconciliation: 'Reconciliation',
  admin: 'Master data',
};

export default function DecisionInboxPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [overdueOnly, setOverdueOnly] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // The page frame renders before this answers, and the tiles and rows show
  // skeletons meanwhile. Changing the filter changes the url, which reloads on
  // its own — the previous list stays on screen until the new one arrives
  // rather than the page blanking.
  const {
    data: inbox, loading: isLoading, error, reload: fetchInbox,
  } = usePanel<DecisionInbox>(
    `${API_ENDPOINTS.INBOX.LIST}?${overdueOnly ? 'overdue_only=true' : ''}`,
    reloadKey
  );

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const escalateOverdue = async () => {
    if (!user?.access_token) return;
    setIsEscalating(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.INBOX.ESCALATE_OVERDUE,
        { method: 'POST' },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Escalation failed');
      }
      const result: EscalationResult = await response.json();
      toast({
        title: result.escalated_count > 0 ? 'Escalated' : 'Nothing to escalate',
        description:
          result.escalated_count > 0
            ? `${result.escalated_count} breached item(s) escalated and the approver notified.`
            : 'No SLA breaches are awaiting escalation.',
      });
      setReloadKey((k) => k + 1);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Escalation failed', description: error.message });
    } finally {
      setIsEscalating(false);
    }
  };

  // No full-page spinner. The heading, the filters and the tile frames are
  // correct before the request returns, so the page never jumps.
  if (!authLoading && !user) return null;

  const items = inbox?.items ?? [];
  const firstLoad = isLoading && !inbox;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Inbox className="h-7 w-7 text-primary" />
            Decision Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Everything waiting on you, reduced to its single most blocking next step.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInbox} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={overdueOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Overdue only
          </Button>
        </div>
      </div>

      {/* Summary. Broken down by work item type rather than by category: with
          nine categories the old two-of-N tiles showed an arbitrary pair. */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <SummaryTile label="Waiting on you" value={inbox?.total ?? 0} loading={firstLoad} />
        <SummaryTile
          label="SLA breached"
          value={inbox?.overdue_count ?? 0}
          tone={(inbox?.overdue_count ?? 0) > 0 ? 'text-red-500' : undefined}
          loading={firstLoad}
        />
        {Object.entries(inbox?.by_work_item_type ?? {})
          .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
          .slice(0, 2)
          .map(([key, count]) => (
            <SummaryTile key={key} label={WORK_TYPE_LABEL[key] ?? key} value={count ?? 0} />
          ))}
      </div>

      {(inbox?.overdue_count ?? 0) > 0 && (
        <Card className="mb-6 border-red-500/40 bg-red-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-500">
                  {inbox?.overdue_count} item(s) past their SLA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escalating notifies the configured approver and records an audit event.
                  It runs once per item, so it is safe to repeat.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={escalateOverdue} disabled={isEscalating}>
              {isEscalating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4 mr-2" />
              )}
              Escalate overdue
            </Button>
          </CardContent>
        </Card>
      )}

      {firstLoad ? (
        <div className="space-y-3">
          <InboxCardSkeleton />
          <InboxCardSkeleton />
          <InboxCardSkeleton />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">Could not load your inbox</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchInbox}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BadgeCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nothing needs your attention</p>
            <p className="text-sm text-muted-foreground mt-1">
              {overdueOnly
                ? 'No items have breached their SLA.'
                : 'Your queue is clear. Items appear here when they are blocked on you.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InboxCard
              key={`${item.object_type}:${item.object_id}`}
              item={item}
              router={router}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label, value, tone, loading,
}: {
  label: string;
  value: number;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-12 mt-1" />
        ) : (
          <p className={`text-2xl font-semibold mt-1 ${tone ?? ''}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** A stand-in with the same shape as a real row, so the list does not jump
 *  when the data lands. */
function InboxCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-5 w-32 mb-3" />
        <Separator className="mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function InboxCard({
  item,
  router,
}: {
  item: DecisionInboxItem;
  router: ReturnType<typeof useRouter>;
}) {
  const meta = CATEGORY_META[item.category] ?? {
    label: item.category,
    icon: <Inbox className="h-4 w-4" />,
    tone: 'border-muted bg-muted/30 text-muted-foreground',
  };

  return (
    <Card className={item.overdue ? 'border-red-500/40' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {item.reference ?? meta.label}
              {item.subtitle && (
                <span className="text-muted-foreground font-normal">· {item.subtitle}</span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{item.reason}</CardDescription>
          </div>
          <div className="text-right shrink-0">
            {/* Not every work item is about a sum. A bank change and a tender
                with no quotes yet both carry 0, and printing that reads as
                "zero money" rather than "no amount applies here". */}
            {item.amount > 0 && (
              <p className="font-semibold">
                {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            )}
            {item.required_role && (
              <p className="text-xs text-muted-foreground mt-0.5">
                needs {item.required_role.toUpperCase()}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </Badge>

          {item.overdue && (
            <Badge variant="outline" className="gap-1 border-red-500/50 bg-red-500/10 text-red-600">
              <Clock className="h-3 w-3" />
              Overdue
            </Badge>
          )}

          {item.escalated && (
            <Badge variant="outline" className="gap-1 border-purple-500/50 bg-purple-500/10 text-purple-600">
              <BellRing className="h-3 w-3" />
              Escalated to you
            </Badge>
          )}

          {item.sla_due_at && !item.overdue && (
            <span className="text-xs text-muted-foreground">
              due {formatDistanceToNow(parseApiDate(item.sla_due_at), { addSuffix: true })}
            </span>
          )}
        </div>

        <Separator className="mb-3" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{item.action}</p>
          <div className="flex gap-2">
            {/* Both links come from the item now. Building them here meant one
                route per category, and every new module silently sent the
                reader to an invoice page that did not exist. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`${item.detail_url}?tab=audit`)}
            >
              Audit trail
            </Button>
            <Button size="sm" onClick={() => router.push(item.detail_url)}>
              Open
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
