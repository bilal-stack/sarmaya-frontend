'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { DecisionInbox, DecisionInboxItem, EscalationResult } from '@/types/governance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Inbox, AlertTriangle, Clock, ShieldAlert, Copy, BadgeCheck,
  ArrowRight, RefreshCw, BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
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
  approval: {
    label: 'Approval',
    icon: <BadgeCheck className="h-4 w-4" />,
    tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  },
};

export default function DecisionInboxPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [inbox, setInbox] = useState<DecisionInbox | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (overdueOnly) params.append('overdue_only', 'true');

      const response = await apiFetch(
        `${API_ENDPOINTS.INBOX.LIST}?${params.toString()}`,
        {},
        user.access_token
      );
      if (!response.ok) throw new Error('Failed to load the decision inbox');
      setInbox(await response.json());
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not load your inbox',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, overdueOnly, router, toast]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

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
      fetchInbox();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Escalation failed', description: error.message });
    } finally {
      setIsEscalating(false);
    }
  };

  if (authLoading || (isLoading && !inbox)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const items = inbox?.items ?? [];

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

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <SummaryTile label="Waiting on you" value={inbox?.total ?? 0} />
        <SummaryTile
          label="SLA breached"
          value={inbox?.overdue_count ?? 0}
          tone={(inbox?.overdue_count ?? 0) > 0 ? 'text-red-500' : undefined}
        />
        {Object.entries(inbox?.counts ?? {}).slice(0, 2).map(([key, count]) => (
          <SummaryTile key={key} label={CATEGORY_META[key]?.label ?? key} value={count} />
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

      {items.length === 0 ? (
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
            <InboxCard key={item.invoice_id} item={item} router={router} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone ?? ''}`}>{value}</p>
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
              {item.invoice_number ?? 'Invoice'}
              <span className="text-muted-foreground font-normal">
                · {item.vendor_name ?? 'Unknown vendor'}
              </span>
            </CardTitle>
            <CardDescription className="mt-1">{item.reason}</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold">
              {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
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
              due {formatDistanceToNow(new Date(item.sla_due_at), { addSuffix: true })}
            </span>
          )}
        </div>

        <Separator className="mb-3" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{item.action}</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/ai-tools/invoices/${item.invoice_id}?tab=audit`)}
            >
              Audit trail
            </Button>
            <Button size="sm" onClick={() => router.push(`/ai-tools/invoices/${item.invoice_id}`)}>
              Open
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
