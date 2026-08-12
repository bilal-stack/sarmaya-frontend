'use client';

/**
 * Tenders.
 *
 * Closed-but-unawarded leads the list: quoting has finished, the vendors are
 * waiting, and the decision is sitting with someone. Nothing else in the system
 * chases it.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { RFQSummary, RFQState } from '@/types/sourcing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Gavel, Lock, ArrowRight, Clock, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<RFQState, string> = {
  draft: 'border-muted text-muted-foreground',
  issued: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  closed: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  awarded: 'border-green-500/50 bg-green-500/10 text-green-600',
  cancelled: 'border-muted text-muted-foreground',
};

const label = (s: string) => s.replace(/_/g, ' ');

export default function RFQsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [rfqs, setRfqs] = useState<RFQSummary[]>([]);
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
      const response = await apiFetch(API_ENDPOINTS.RFQS.LIST, {}, user.access_token);
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setRfqs(await response.json());
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
                You do not have permission to view tenders.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaitingDecision = rfqs.filter((r) => r.current_state === 'closed');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-7 w-7 text-primary" />
            Tenders
          </h1>
          <p className="text-muted-foreground mt-1">
            Who was asked, what they offered, and why one of them won.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/ai-tools/requisitions">
            <ClipboardList className="h-4 w-4 mr-2" />
            From a requisition
          </Link>
        </Button>
      </div>

      {awaitingDecision.length > 0 && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {awaitingDecision.length} closed, awaiting an award
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quoting has finished and the vendors are waiting. Nothing else in
                the system chases this.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All tenders</CardTitle>
          <CardDescription>{rfqs.length} RFQ(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rfqs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No tenders yet. One is opened from an approved requisition — going to
              market on an unapproved need commits the company&apos;s name to a
              purchase nobody authorised.
            </p>
          ) : (
            rfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/ai-tools/rfqs/${rfq.id}`}
                className="block rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{rfq.rfq_number}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATE_STYLE[rfq.current_state]}`}
                      >
                        {label(rfq.current_state)}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{rfq.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rfq.issued_date
                        ? `issued ${format(parseApiDate(rfq.issued_date), 'dd MMM yyyy')}`
                        : 'not yet issued'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
