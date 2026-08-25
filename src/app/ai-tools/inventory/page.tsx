'use client';

/**
 * Inventory — what is on hand, why it changed, and what is waiting on a
 * signature.
 *
 * The screen is built around the thing that makes this module different from
 * a stock list: **stock here is a ledger, not a number**. The balance is the
 * sum of every movement, so the movements tab is not a nice extra — it is the
 * only place that answers "why is it 37 when it should be 40", which is the
 * question anybody looking at inventory is actually asking.
 *
 * Adjustments get the most room because they are the fraud surface. Every
 * other movement has a lorry behind it; an adjustment has somebody's word, so
 * writing stock off is how a loss gets covered up. The screen says so, shows
 * who signed, and shows when a second signature is still outstanding.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Boxes, PackageMinus, Undo2, RefreshCw, Loader2, AlertTriangle, ShieldAlert,
  Plus, ArrowDownUp, CheckCircle2, TriangleAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseApiDate } from '@/lib/datetime';

interface StockRow {
  item_id: string;
  sku: string;
  name: string;
  uom: string;
  location_id: string;
  location: string;
  quantity: number;
  reorder_point: number | null;
  below_reorder_point: boolean;
  value: number | null;
  last_movement_at: string | null;
}

interface Movement {
  id: string;
  item_id: string;
  quantity: number;
  movement_type: string;
  reason_code: string | null;
  source_type: string | null;
  note: string | null;
  created_at: string;
}

interface Adjustment {
  id: string;
  adjustment_number: string;
  created_by?: string | null;
  reason_code: string;
  current_state: string;
  total_value: number;
  requires_dual_approval: boolean;
  approved_by: string | null;
  second_approved_by: string | null;
  created_at: string;
}

interface VendorReturn {
  id: string;
  return_number: string;
  reason_code: string;
  vendor_attributable: boolean;
  current_state: string;
  total_value: number;
  credit_note_reference: string | null;
}

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  is_stocked: boolean;
}

interface LocationRow {
  id: string;
  code: string;
  name: string;
}

const REASON_CODES = [
  'count_correction', 'damaged', 'shortage', 'overage', 'wrong_item',
  'quality_failure', 'expired', 'theft_or_loss',
];

/** Whether this person is barred from approving — because they raised it, or
 *  because they already gave the first of two signatures. Mirrors the server's
 *  SoD rules; the server is still the one that enforces them. */
function alreadySignedOrRaised(
  adjustment: { created_by?: string | null; approved_by: string | null },
  userId?: string,
): boolean {
  if (!userId) return false;
  return adjustment.created_by === userId || adjustment.approved_by === userId;
}

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pretty = (s: string) => s.replace(/_/g, ' ');

/** Colour by how much attention a state deserves, not by aesthetics. */
function stateBadge(state: string) {
  if (state === 'posted' || state === 'credited') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  }
  if (state === 'pending_approval') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
  }
  if (state === 'rejected' || state === 'cancelled') {
    return 'bg-destructive/10 text-destructive border-destructive/30';
  }
  return '';
}

export default function InventoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    location_id: '', reason_code: 'count_correction', item_id: '',
    quantity_change: '', reason_note: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const stock = usePanel<StockRow[]>(API_ENDPOINTS.INVENTORY.STOCK, reloadKey);
  const movements = usePanel<Movement[]>(API_ENDPOINTS.INVENTORY.MOVEMENTS, reloadKey);
  const adjustments = usePanel<Adjustment[]>(API_ENDPOINTS.INVENTORY.ADJUSTMENTS, reloadKey);
  const returns = usePanel<VendorReturn[]>(API_ENDPOINTS.INVENTORY.RETURNS, reloadKey);
  const items = usePanel<ItemRow[]>(API_ENDPOINTS.INVENTORY.ITEMS, reloadKey);
  const locations = usePanel<LocationRow[]>(API_ENDPOINTS.INVENTORY.LOCATIONS, reloadKey);
  const reconcile = usePanel<{ discrepancies: unknown[] }>(
    API_ENDPOINTS.INVENTORY.RECONCILE, reloadKey,
  );

  const forbidden = stock.status === 403;
  const rows = stock.data ?? [];
  const lowStock = rows.filter((r) => r.below_reorder_point);
  const totalValue = rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const drifted = (reconcile.data?.discrepancies ?? []).length;

  async function act(url: string, body?: unknown, successTitle = 'Done') {
    if (!user?.access_token) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        user.access_token,
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(
          typeof detail.detail === 'string' ? detail.detail : 'That did not work',
        );
      }
      toast({ title: successTitle });
      setReloadKey((k) => k + 1);
      return await response.json();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Refused', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function createAdjustment() {
    const created = await act(
      API_ENDPOINTS.INVENTORY.ADJUSTMENTS,
      {
        location_id: form.location_id,
        reason_code: form.reason_code,
        reason_note: form.reason_note || null,
        lines: [{ item_id: form.item_id, quantity_change: form.quantity_change }],
      },
      'Adjustment raised',
    );
    if (created) {
      setCreating(false);
      setForm({ ...form, item_id: '', quantity_change: '', reason_note: '' });
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" />
            Inventory
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            What is on hand, and why. Every balance here is the sum of its
            movements rather than a number somebody edited, so the history
            always explains the total.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating(true)} disabled={forbidden}>
            <Plus className="mr-2 h-4 w-4" />
            New adjustment
          </Button>
          <Button
            variant="outline"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={stock.loading}
          >
            <RefreshCw className={`h-4 w-4 ${stock.loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {forbidden && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Your role cannot view inventory.
          </AlertDescription>
        </Alert>
      )}

      {/* The ledger disagreeing with its own aggregate is a bug, not a
          data-entry problem — so it is shown loudly and never auto-corrected. */}
      {drifted > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            {drifted} balance{drifted === 1 ? '' : 's'} disagree with the
            movement ledger. Something wrote a balance without a movement — that
            is a bug worth reporting, not a count to correct.
          </AlertDescription>
        </Alert>
      )}

      {!forbidden && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Stock value</p>
              {stock.loading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-semibold">{money(totalValue)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Lines held</p>
              {stock.loading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-semibold">{rows.length}</p>
              )}
            </CardContent>
          </Card>
          <Card className={lowStock.length ? 'border-amber-500/40' : undefined}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Below reorder point</p>
              {stock.loading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className={`text-2xl font-semibold ${lowStock.length ? 'text-amber-600' : ''}`}>
                  {lowStock.length}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!forbidden && (
        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock" className="gap-1.5">
              <Boxes className="h-4 w-4" /> On hand
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-1.5">
              <ArrowDownUp className="h-4 w-4" /> Movements
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="gap-1.5">
              <PackageMinus className="h-4 w-4" /> Adjustments
            </TabsTrigger>
            <TabsTrigger value="returns" className="gap-1.5">
              <Undo2 className="h-4 w-4" /> Returns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What is on hand</CardTitle>
                <CardDescription>
                  By item and location. An item below its reorder point is at
                  stockout risk.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stock.loading && <Skeleton className="h-24 w-full" />}
                {!stock.loading && rows.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nothing held yet. Stock appears here once a receipt lands
                    against an item.
                  </p>
                )}
                {rows.map((row) => (
                  <div
                    key={`${row.item_id}-${row.location_id}`}
                    className="flex items-center justify-between gap-4 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        <span className="font-mono text-sm">{row.sku}</span>
                        <span className="text-muted-foreground"> — {row.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.location}
                        {row.last_movement_at && (
                          <> · last moved {formatDistanceToNow(
                            parseApiDate(row.last_movement_at) ?? new Date(),
                            { addSuffix: true },
                          )}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">
                        {row.quantity} <span className="text-xs font-normal text-muted-foreground">{row.uom}</span>
                      </p>
                      {row.below_reorder_point && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          below {row.reorder_point}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Why the balance is what it is</CardTitle>
                <CardDescription>
                  Append-only. Correcting a movement means posting an opposing
                  one, so nothing is ever edited away.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {movements.loading && <Skeleton className="h-24 w-full" />}
                {(movements.data ?? []).map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between gap-4 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium capitalize">
                        {pretty(movement.movement_type)}
                        {movement.reason_code && (
                          <span className="text-muted-foreground">
                            {' '}— {pretty(movement.reason_code)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {movement.note || movement.source_type || '—'}
                      </p>
                    </div>
                    <p className={`font-mono font-semibold shrink-0 ${
                      movement.quantity < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </p>
                  </div>
                ))}
                {!movements.loading && (movements.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No movements yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adjustments" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Adjustments</CardTitle>
                <CardDescription>
                  The only way stock changes with no delivery behind it, which
                  is why it needs a signature — and two above the limit. Whoever
                  raised it cannot approve it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {adjustments.loading && <Skeleton className="h-24 w-full" />}
                {(adjustments.data ?? []).map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{adjustment.adjustment_number}</span>
                        <span className="text-muted-foreground">
                          {' '}— {pretty(adjustment.reason_code)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(adjustment.total_value)}
                        {adjustment.requires_dual_approval && (
                          <> · needs two signatures
                            {adjustment.approved_by && !adjustment.second_approved_by
                              && ' · one so far'}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={stateBadge(adjustment.current_state)}>
                        {pretty(adjustment.current_state)}
                      </Badge>
                      {adjustment.current_state === 'draft' && (
                        <Button
                          size="sm" variant="outline" disabled={saving}
                          onClick={() => act(
                            API_ENDPOINTS.INVENTORY.ADJUSTMENT_ACTION(adjustment.id, 'submit'),
                            undefined, 'Submitted for approval',
                          )}
                        >
                          Submit
                        </Button>
                      )}
                      {/* Offered only to somebody who could actually use it.
                          The server refuses the raiser and refuses a second
                          signature from the first approver, so showing the
                          button to them is offering an action that always
                          fails — and a button that 403s teaches people the
                          screen is unreliable rather than that the control
                          worked. */}
                      {adjustment.current_state === 'pending_approval' && (
                        alreadySignedOrRaised(adjustment, user?.id) ? (
                          <span className="text-xs text-muted-foreground">
                            {adjustment.approved_by === user?.id
                              ? 'You signed this — it needs someone else'
                              : 'You raised this'}
                          </span>
                        ) : (
                          <Button
                            size="sm" disabled={saving}
                            onClick={() => act(
                              API_ENDPOINTS.INVENTORY.ADJUSTMENT_ACTION(adjustment.id, 'approve'),
                              undefined, 'Approved',
                            )}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
                {!adjustments.loading && (adjustments.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No adjustments raised.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Returns to vendors</CardTitle>
                <CardDescription>
                  Whether a return is the supplier&apos;s fault is decided from
                  its reason when it is raised and then fixed, so a scorecard
                  cannot rewrite last quarter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {returns.loading && <Skeleton className="h-24 w-full" />}
                {(returns.data ?? []).map((vendorReturn) => (
                  <div
                    key={vendorReturn.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{vendorReturn.return_number}</span>
                        <span className="text-muted-foreground">
                          {' '}— {pretty(vendorReturn.reason_code)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(vendorReturn.total_value)}
                        {vendorReturn.vendor_attributable && ' · vendor at fault'}
                        {vendorReturn.credit_note_reference
                          && ` · credit ${vendorReturn.credit_note_reference}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={stateBadge(vendorReturn.current_state)}>
                      {pretty(vendorReturn.current_state)}
                    </Badge>
                  </div>
                ))}
                {!returns.loading && (returns.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nothing going back to a vendor.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New adjustment</DialogTitle>
            <DialogDescription>
              Negative writes stock off, positive writes it on. Above the value
              limit this needs two different approvers, and you will not be one
              of them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={form.location_id}
                onValueChange={(v) => setForm({ ...form, location_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>
                  {(locations.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <Select
                value={form.item_id}
                onValueChange={(v) => setForm({ ...form, item_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Choose an item" /></SelectTrigger>
                <SelectContent>
                  {(items.data ?? []).filter((i) => i.is_stocked).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.sku} — {i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={form.reason_code}
                onValueChange={(v) => setForm({ ...form, reason_code: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASON_CODES.map((code) => (
                    <SelectItem key={code} value={code} className="capitalize">
                      {pretty(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Change</Label>
              <Input
                id="qty" placeholder="-3"
                value={form.quantity_change}
                onChange={(e) => setForm({ ...form, quantity_change: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note" placeholder="What was found, and how"
                value={form.reason_note}
                onChange={(e) => setForm({ ...form, reason_note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={createAdjustment}
              disabled={saving || !form.location_id || !form.item_id || !form.quantity_change}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Raise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
