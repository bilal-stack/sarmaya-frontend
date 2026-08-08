'use client';

/**
 * The three-way match verdict for an invoice.
 *
 * Shown on the invoice because that is where it is acted on. The endpoint is
 * advisory — it explains what approval *would* say, so a discrepancy can be
 * chased rather than discovered as a refusal after someone clicks Approve.
 *
 * A failing match is deliberately loud and lists every discrepancy: "does not
 * match" tells a reviewer nothing, while "ordered 100, received 60" tells them
 * who to call. The card renders nothing at all when no purchase order is
 * linked, since most invoices have none and an empty "not applicable" panel on
 * every invoice would train people to ignore the space.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { ThreeWayMatch } from '@/types/procurement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, AlertTriangle, ShoppingCart, ArrowRight,
} from 'lucide-react';

interface Props {
  invoiceId: string;
}

const TONE: Record<string, { badge: string; label: string }> = {
  matched: {
    badge: 'border-green-500/50 bg-green-500/10 text-green-600',
    label: 'Matched',
  },
  within_tolerance: {
    badge: 'border-green-500/50 bg-green-500/10 text-green-600',
    label: 'Within tolerance',
  },
  mismatched: {
    badge: 'border-destructive/50 bg-destructive/10 text-destructive',
    label: 'Does not match',
  },
  unmatched: {
    badge: 'border-muted text-muted-foreground',
    label: 'No purchase order',
  },
};

export function ThreeWayMatchCard({ invoiceId }: Props) {
  const { user } = useAuth();
  const [match, setMatch] = useState<ThreeWayMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.MATCH.INVOICE(invoiceId), {}, user.access_token
      );
      if (response.ok) setMatch(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking against the purchase order…
        </CardContent>
      </Card>
    );
  }

  // Most invoices have no order. Rendering nothing beats an empty panel that
  // people learn to skip past.
  if (!match || match.result === 'unmatched') return null;

  const tone = TONE[match.result] ?? TONE.unmatched;
  const failed = match.result === 'mismatched';

  return (
    <Card className={failed ? 'border-destructive/40' : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Three-way match
            </CardTitle>
            <CardDescription>Invoice against order and delivery.</CardDescription>
          </div>
          <Badge variant="outline" className={`gap-1 ${tone.badge}`}>
            {failed ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {tone.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className={`text-sm ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
          {match.reason}
        </p>

        {failed && match.discrepancies.length > 0 && (
          <div className="space-y-1.5">
            {match.discrepancies.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-destructive uppercase">{d.kind}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {failed && (
          <p className="text-xs text-muted-foreground">
            Approval is blocked while this stands. Record the missing delivery, or have the
            vendor correct the invoice.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {match.tolerance && (
            <p className="text-xs text-muted-foreground">
              Tolerance: {match.tolerance.amount_percent}% on value,{' '}
              {match.tolerance.quantity_percent}% on quantity.
            </p>
          )}
          {match.purchase_order_id && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/ai-tools/purchase-orders/${match.purchase_order_id}`}>
                {match.po_number ?? 'Purchase order'}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
