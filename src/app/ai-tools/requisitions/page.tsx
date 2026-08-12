'use client';

/**
 * Purchase requisitions.
 *
 * The list leads with what is waiting on an approver, because that is where a
 * requisition sits idle while somebody downstream waits for it — and unlike an
 * invoice, nothing external chases a request that nobody actioned.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { RequisitionSummary, RequisitionState } from '@/types/sourcing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, Plus, Lock, ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<RequisitionState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_approval: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  approved: 'border-green-500/50 bg-green-500/10 text-green-600',
  converted: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string) =>
  Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function RequisitionsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(API_ENDPOINTS.REQUISITIONS.LIST, {}, user.access_token);
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setRequisitions(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (denied) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Not permitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                You do not have permission to view requisitions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaiting = requisitions.filter((r) => r.current_state === 'pending_approval');
  const awaitingValue = awaiting.reduce((sum, r) => sum + Number(r.estimated_amount), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Requisitions
          </h1>
          <p className="text-muted-foreground mt-1">
            What was asked for, and why. Every order downstream traces back to one.
          </p>
        </div>
        <Button asChild>
          <Link href="/ai-tools/requisitions/new">
            <Plus className="h-4 w-4 mr-2" />
            Raise a request
          </Link>
        </Button>
      </div>

      {awaiting.length > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {awaiting.length} awaiting approval · {money(String(awaitingValue))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nothing external chases a request nobody actioned, so it sits here
                until someone decides.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests</CardTitle>
          <CardDescription>{requisitions.length} requisition(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requisitions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nothing requested yet. A requisition is where a purchase starts — it
              records who asked and why, which is the one question an order cannot
              answer on its own.
            </p>
          ) : (
            requisitions.map((requisition) => (
              <Link
                key={requisition.id}
                href={`/ai-tools/requisitions/${requisition.id}`}
                className="block rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {requisition.requisition_number}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATE_STYLE[requisition.current_state]}`}
                      >
                        {label(requisition.current_state)}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{requisition.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseApiDate(requisition.requested_date), 'dd MMM yyyy')}
                      {requisition.department && ` · ${requisition.department}`}
                      {requisition.needed_by &&
                        ` · needed by ${format(parseApiDate(requisition.needed_by), 'dd MMM')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {money(requisition.estimated_amount)}
                      </span>
                      <p className="text-xs text-muted-foreground">estimate</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
