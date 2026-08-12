'use client';

/**
 * One requisition: what was asked, why, and what happened to it.
 *
 * The justification leads, because it is what the approver is deciding on —
 * an approve button next to an amount, with the reason buried below the fold,
 * invites a decision made on the number alone.
 *
 * Actions are shown by state rather than always-on-and-disabled: a button that
 * is permanently greyed teaches people to ignore buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { Requisition, RequisitionState, RFQSummary } from '@/types/sourcing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, ArrowLeft, ClipboardList, Send, Check, X, Gavel, Quote as QuoteIcon,
  Info, Link2,
} from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<RequisitionState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_approval: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  approved: 'border-green-500/50 bg-green-500/10 text-green-600',
  converted: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [rfqs, setRfqs] = useState<RFQSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [detail, rfqList] = await Promise.all([
        apiFetch(API_ENDPOINTS.REQUISITIONS.DETAIL(id), {}, user.access_token),
        apiFetch(API_ENDPOINTS.RFQS.LIST, {}, user.access_token),
      ]);
      if (detail.ok) setRequisition(await detail.json());
      if (rfqList.ok) setRfqs(await rfqList.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    action: string, url: string, body?: unknown, successTitle?: string
  ) => {
    if (!user?.access_token) return;
    setBusy(action);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', body: JSON.stringify(body ?? {}) },
        user.access_token
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          variant: 'destructive',
          // A 403 here is usually segregation of duties rather than a missing
          // permission — you cannot approve what you raised. The server's own
          // wording says which, so it is shown as-is.
          title: response.status === 403 ? 'Refused' : 'Could not do that',
          description:
            typeof payload.detail === 'string' ? payload.detail : 'Nothing changed.',
        });
        return;
      }
      toast({ title: successTitle ?? 'Done' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const startSourcing = async () => {
    if (!user?.access_token || !requisition) return;
    setBusy('sourcing');
    try {
      const response = await apiFetch(
        API_ENDPOINTS.RFQS.CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            requisition_id: requisition.id,
            title: requisition.title,
            vendor_ids: [],
          }),
        },
        user.access_token
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: response.status === 403 ? 'Not permitted' : 'Could not open a tender',
          description:
            typeof body.detail === 'string' ? body.detail : 'The RFQ was not created.',
        });
        return;
      }
      router.push(`/ai-tools/rfqs/${body.id}`);
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (!requisition) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
        <Card>
          <CardContent className="py-6">
            <p className="font-medium">Not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              This requisition does not exist, or belongs to another organisation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = requisition.current_state;
  const relatedRfqs = rfqs.filter((r) => r.title === requisition.title);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/ai-tools/requisitions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Requisitions
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            {requisition.requisition_number}
          </h1>
          <Badge variant="outline" className={`${STATE_STYLE[state]}`}>
            {label(state)}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">{requisition.title}</p>
      </div>

      {/* The justification leads: it is what the approver is deciding on. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this is needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm whitespace-pre-wrap">{requisition.justification}</p>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Estimate</p>
              <p className="font-medium">{money(requisition.estimated_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p>{requisition.department || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Budget code</p>
              <p>{requisition.budget_code || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Needed by</p>
              <p>
                {requisition.needed_by
                  ? format(parseApiDate(requisition.needed_by), 'dd MMM yyyy')
                  : '—'}
              </p>
            </div>
          </div>
          {requisition.rejection_reason && (
            <p className="text-sm text-destructive">
              Rejected: {requisition.rejection_reason}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>
            Estimated prices. The approval is granted against this total, and an
            order cannot later exceed it without being approved again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requisition.lines.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm">{line.description}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(line.quantity)} × {money(line.estimated_unit_price)}
                </p>
              </div>
              <span className="text-sm font-medium">{money(line.estimated_amount)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated total</span>
            <span className="font-semibold">{money(requisition.estimated_amount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Only the actions this state actually allows. */}
      {state === 'draft' && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              Not yet visible to an approver.
            </p>
            <Button
              onClick={() =>
                act('submit', API_ENDPOINTS.REQUISITIONS.SUBMIT(id), {}, 'Submitted for approval')
              }
              disabled={busy !== null}
            >
              {busy === 'submit' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for approval
            </Button>
          </CardContent>
        </Card>
      )}

      {state === 'pending_approval' && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
            <CardDescription>
              You cannot approve a request you raised yourself, and the approval
              matrix&apos;s amount limits apply — the same ones that govern invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  act('approve', API_ENDPOINTS.REQUISITIONS.APPROVE(id), {}, 'Approved')
                }
                disabled={busy !== null}
              >
                {busy === 'approve' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="reject" className="text-xs">
                Or reject, with a reason
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="reject"
                  className="flex-1 min-w-[14rem]"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why this is not going ahead"
                />
                <Button
                  variant="outline"
                  disabled={busy !== null || !rejectReason.trim()}
                  onClick={() =>
                    act(
                      'reject',
                      API_ENDPOINTS.REQUISITIONS.REJECT(id),
                      { reason: rejectReason.trim() },
                      'Rejected'
                    )
                  }
                >
                  {busy === 'reject' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state === 'approved' && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium">Approved — ready to source</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Take it to market. A tender needs at least two vendors; one quote
                is not a comparison.
              </p>
            </div>
            <Button onClick={startSourcing} disabled={busy !== null}>
              {busy === 'sourcing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QuoteIcon className="h-4 w-4 mr-2" />
              )}
              Open a tender
            </Button>
          </CardContent>
        </Card>
      )}

      {state === 'converted' && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Gavel className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Ordered</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                An order was raised against this request. One approval cannot cover
                a second one.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {relatedRfqs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relatedRfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/ai-tools/rfqs/${rfq.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{rfq.rfq_number}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {label(rfq.current_state)}
                  </Badge>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {requisition.correlation_id && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">This request starts a chain</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The tender, quotes, order, invoice and payment all carry the same
                id, so the whole story reads from the need rather than from the
                commitment.
              </p>
              <Link
                href={`/ai-tools/audit?chain=${requisition.correlation_id}`}
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                {requisition.correlation_id}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
