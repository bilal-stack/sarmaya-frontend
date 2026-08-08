'use client';

/**
 * Purchase orders.
 *
 * The commitment side of procurement: what the company has agreed to buy,
 * before any invoice exists. The list leads with state because that is what
 * decides who can act — a draft is the raiser's to edit, a pending order is
 * someone else's to approve, and only an issued order can be received against.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { PurchaseOrderSummary, PurchaseOrderState } from '@/types/procurement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, ShoppingCart, Plus, Lock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

/** State styling. Anything awaiting a person reads as attention. */
const STATE_STYLE: Record<PurchaseOrderState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_approval: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  approved: 'border-green-500/50 bg-green-500/10 text-green-600',
  issued: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  closed: 'border-muted text-muted-foreground',
  cancelled: 'border-muted text-muted-foreground',
};

const STATES: Array<PurchaseOrderState | 'all'> = [
  'all', 'draft', 'pending_approval', 'approved', 'issued', 'rejected', 'closed',
];

const money = (value: string) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });

const label = (state: string) => state.replace(/_/g, ' ');

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [state, setState] = useState<PurchaseOrderState | 'all'>('all');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const query = state === 'all' ? '' : `?state=${state}`;
      const response = await apiFetch(
        `${API_ENDPOINTS.PURCHASE_ORDERS.LIST}${query}`, {}, user.access_token
      );
      // Viewing orders needs purchase_orders.view; a 403 is an answer, not an error.
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setOrders(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, state]);

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
                You do not have permission to view purchase orders.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaitingApproval = orders.filter((o) => o.current_state === 'pending_approval').length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-primary" />
            Purchase orders
          </h1>
          <p className="text-muted-foreground mt-1">
            What the company has committed to buy — approved before it reaches the vendor.
          </p>
        </div>
        <Button asChild>
          <Link href="/ai-tools/purchase-orders/new">
            <Plus className="h-4 w-4 mr-2" />
            Raise an order
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Orders</CardTitle>
              <CardDescription>
                {orders.length} order(s)
                {awaitingApproval > 0 && (
                  <>
                    {' · '}
                    <span className="text-foreground font-medium">
                      {awaitingApproval} awaiting approval
                    </span>
                  </>
                )}
              </CardDescription>
            </div>
            <Select value={state} onValueChange={(v) => setState(v as PurchaseOrderState | 'all')}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'All states' : label(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {state === 'all'
                ? 'No purchase orders yet.'
                : `No orders in ${label(state)}.`}
            </p>
          ) : (
            orders.map((order) => (
              <Link
                key={order.id}
                href={`/ai-tools/purchase-orders/${order.id}`}
                className="block rounded-md border p-3 hover:border-primary/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{order.po_number}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATE_STYLE[order.current_state]}`}
                      >
                        {label(order.current_state)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.vendor_name} ·{' '}
                      {format(parseApiDate(order.order_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{money(order.total_amount)}</span>
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
