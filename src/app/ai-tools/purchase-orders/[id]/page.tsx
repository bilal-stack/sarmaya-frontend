'use client';

/**
 * A purchase order: what was ordered, what has arrived, and what can be done next.
 *
 * The action bar offers only the transitions the order's current state allows,
 * because the workflow is configured server-side and a button that always
 * 500s teaches people to distrust the screen. Every action still fails safe —
 * the server re-checks permission, segregation of duties and the transition
 * guards regardless of what the UI showed.
 *
 * Lines carry delivery progress, since that is the leg of the three-way match
 * most likely to be short and the reason an invoice will later be refused.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type {
  PurchaseOrder, PurchaseOrderState, GoodsReceipt,
} from '@/types/procurement';
import { AuditTimelineView } from '@/components/governance/audit-timeline';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, ArrowLeft, ShoppingCart, Send, CheckCircle2, XCircle, Truck,
  PackageCheck, Archive, FileSearch,
} from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<PurchaseOrderState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_approval: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  approved: 'border-green-500/50 bg-green-500/10 text-green-600',
  issued: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  closed: 'border-muted text-muted-foreground',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string | null) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v: string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const orderId = params.id as string;

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [orderRes, receiptRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.PURCHASE_ORDERS.DETAIL(orderId), {}, user.access_token),
        apiFetch(API_ENDPOINTS.PURCHASE_ORDERS.RECEIPTS(orderId), {}, user.access_token),
      ]);
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        setError(err.detail || 'Purchase order not found');
        return;
      }
      setOrder(await orderRes.json());
      if (receiptRes.ok) setReceipts(await receiptRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Every lifecycle action goes through here, so one place reports failure. */
  const act = async (name: string, url: string, body?: unknown) => {
    if (!user?.access_token) return;
    setBusy(name);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === 'string' ? err.detail : `Could not ${name} this order`
        );
      }
      toast({ title: `Order ${name}` });
      await load();
      return true;
    } catch (e: any) {
      // Governance refusals arrive here — segregation of duties, an unverified
      // vendor, an order with no lines. They are shown verbatim because the
      // server's wording explains what to do about it.
      toast({ variant: 'destructive', title: `Not ${name}`, description: e.message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const recordReceipt = async () => {
    if (!order) return;
    const lines = order.lines
      .map((line) => ({
        purchase_order_line_id: line.id,
        quantity_received: Number(quantities[line.id] ?? 0),
      }))
      .filter((l) => l.quantity_received !== 0);

    if (lines.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to record',
        description: 'Enter the quantity that arrived for at least one line.',
      });
      return;
    }
    const ok = await act('received', API_ENDPOINTS.PURCHASE_ORDERS.RECEIPTS(order.id), {
      delivery_note: deliveryNote || null,
      lines,
    });
    if (ok) {
      setShowReceive(false);
      setQuantities({});
      setDeliveryNote('');
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

  if (error || !order) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-4">
        <Button variant="ghost" onClick={() => router.push('/ai-tools/purchase-orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{error ?? 'Not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = order.current_state;
  // Mirrors the seeded purchase_order workflow. The server is the authority;
  // this only decides which buttons are worth offering.
  const canSubmit = state === 'draft';
  const canDecide = state === 'pending_approval';
  const canIssue = state === 'approved';
  const canReceive = state === 'issued';
  const canClose = state === 'issued';

  const ordered = order.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
  const received = order.lines.reduce((sum, l) => sum + Number(l.received_quantity), 0);
  const deliveryPct = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/ai-tools/purchase-orders')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Purchase orders
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-primary" />
            {order.po_number}
          </h1>
          <p className="text-muted-foreground mt-1">
            {order.vendor_name} · {format(parseApiDate(order.order_date), 'dd MMM yyyy')}
          </p>
        </div>
        <Badge variant="outline" className={`text-sm ${STATE_STYLE[state]}`}>
          {label(state)}
        </Badge>
      </div>

      {/* Actions the current state actually permits */}
      {(canSubmit || canDecide || canIssue || canReceive || canClose) && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 py-4">
            {canSubmit && (
              <Button
                disabled={busy !== null}
                onClick={() => act('submitted', API_ENDPOINTS.PURCHASE_ORDERS.SUBMIT(order.id))}
              >
                {busy === 'submitted' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for approval
              </Button>
            )}
            {canDecide && (
              <>
                <Button
                  disabled={busy !== null}
                  onClick={() => act('approved', API_ENDPOINTS.PURCHASE_ORDERS.APPROVE(order.id))}
                >
                  {busy === 'approved' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => setShowReject(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {canIssue && (
              <Button
                disabled={busy !== null}
                onClick={() => act('issued', API_ENDPOINTS.PURCHASE_ORDERS.ISSUE(order.id))}
              >
                {busy === 'issued' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4 mr-2" />
                )}
                Issue to vendor
              </Button>
            )}
            {canReceive && (
              <Button variant="outline" disabled={busy !== null} onClick={() => setShowReceive(true)}>
                <PackageCheck className="h-4 w-4 mr-2" />
                Record delivery
              </Button>
            )}
            {canClose && (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => act('closed', API_ENDPOINTS.PURCHASE_ORDERS.CLOSE(order.id))}
              >
                <Archive className="h-4 w-4 mr-2" />
                Close
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {state === 'approved' && (
        <p className="text-xs text-muted-foreground -mt-3">
          Issuing sends the order to the vendor — the point after which goods may arrive.
          It is refused if the vendor is not verified.
        </p>
      )}

      {order.rejection_reason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-destructive">Rejected</p>
            <p className="text-sm text-muted-foreground mt-1">{order.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines with delivery progress */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Lines</CardTitle>
              <CardDescription>
                Delivery is tracked per line — a short line is what makes an invoice fail
                the three-way match.
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{money(order.total_amount)}</p>
              <p className="text-xs text-muted-foreground">{order.currency}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {received > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Delivered</span>
                <span>
                  {qty(String(received))} of {qty(String(ordered))} units
                </span>
              </div>
              <Progress value={deliveryPct} />
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => {
                  const short = Number(line.received_quantity) < Number(line.quantity);
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{line.line_number}</TableCell>
                      <TableCell>
                        {line.description}
                        {line.product_code && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {line.product_code}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{qty(line.quantity)}</TableCell>
                      <TableCell
                        className={`text-right ${short ? 'text-orange-600 font-medium' : ''}`}
                      >
                        {qty(line.received_quantity)}
                      </TableCell>
                      <TableCell className="text-right">{money(line.unit_price)}</TableCell>
                      <TableCell className="text-right">{money(line.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliveries</CardTitle>
          <CardDescription>
            Each receipt is recorded, never edited — a return is a further receipt with a
            negative quantity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nothing received yet.</p>
          ) : (
            receipts.map((receipt) => (
              <div key={receipt.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{receipt.grn_number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseApiDate(receipt.received_date), 'dd MMM yyyy')}
                      {receipt.delivery_note && ` · note ${receipt.delivery_note}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {receipt.lines.length} line(s)
                  </span>
                </div>
                <div className="mt-2 space-y-0.5">
                  {receipt.lines.map((line) => {
                    const source = order.lines.find(
                      (l) => l.id === line.purchase_order_line_id
                    );
                    const amount = Number(line.quantity_received);
                    return (
                      <p key={line.id} className="text-xs text-muted-foreground">
                        {source?.description ?? 'Line'}:{' '}
                        <span className={amount < 0 ? 'text-orange-600' : ''}>
                          {amount > 0 ? '+' : ''}
                          {qty(line.quantity_received)}
                        </span>
                        {amount < 0 && ' (returned)'}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* The chain this order opened */}
      {order.correlation_id && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Transaction chain</p>
              <p className="text-xs text-muted-foreground font-mono break-all mt-0.5">
                {order.correlation_id}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/ai-tools/audit?correlation_id=${order.correlation_id}`}>
                <FileSearch className="h-4 w-4 mr-2" />
                Evidence pack
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <AuditTimelineView objectType="purchase_order" objectId={order.id} />

      {/* Reject */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this order</DialogTitle>
            <DialogDescription>
              The reason is recorded in the audit trail and shown to whoever raised it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Why is this being rejected?"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || busy !== null}
              onClick={async () => {
                const ok = await act(
                  'rejected',
                  API_ENDPOINTS.PURCHASE_ORDERS.REJECT(order.id),
                  { reason: rejectReason.trim() }
                );
                if (ok) {
                  setShowReject(false);
                  setRejectReason('');
                }
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record a delivery */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a delivery</DialogTitle>
            <DialogDescription>
              Enter what actually arrived. Leave a line blank if nothing came for it; use a
              negative number to record a return.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dn">Delivery note (optional)</Label>
              <Input
                id="dn"
                placeholder="DN-1234"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
            </div>
            <Separator />
            {order.lines.map((line) => {
              const outstanding = Number(line.quantity) - Number(line.received_quantity);
              return (
                <div key={line.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{line.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {qty(line.received_quantity)} of {qty(line.quantity)} received
                      {outstanding > 0 && ` · ${qty(String(outstanding))} outstanding`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    className="w-28"
                    placeholder="0"
                    value={quantities[line.id] ?? ''}
                    onChange={(e) =>
                      setQuantities({ ...quantities, [line.id]: e.target.value })
                    }
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceive(false)}>
              Cancel
            </Button>
            <Button disabled={busy !== null} onClick={recordReceipt}>
              {busy === 'received' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4 mr-2" />
              )}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
