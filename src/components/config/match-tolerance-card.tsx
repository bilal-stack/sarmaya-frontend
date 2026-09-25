'use client';

/**
 * How far an invoice may differ from what arrived and still match.
 *
 * `get_match_tolerance` has said these values are "editable per tenant" since
 * the matching engine was written, and nothing routed to editing them — every
 * tenant ran on the defaults and the only way to move them was a database
 * write.
 *
 * **Why this screen argues with the person using it.** The tolerance is the
 * number that decides whether three-way matching refuses an invoice. Widen it
 * far enough and the control passes everything, which is a worse outcome than
 * having no control at all, because the page still says it is on. So the card
 * shows what a setting *means* in the units somebody buys things in — 5% of a
 * hundred boxes is five boxes — rather than presenting two abstract
 * percentages and leaving the reader to do it.
 *
 * The ceiling is enforced by the API, not here. A client-side limit is a
 * courtesy; the refusal has to come from the thing that owns the control.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { MatchTolerance } from '@/types/dashboards';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Scale, AlertTriangle, Save, RotateCcw } from 'lucide-react';

/** What a percentage means against something a person can picture. */
const EXAMPLE_BOXES = 100;
const EXAMPLE_AMOUNT = 10000;

export function MatchToleranceCard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<MatchTolerance | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    try {
      const res = await apiFetch(
        API_ENDPOINTS.CONFIG.MATCH_TOLERANCE, {}, user.access_token,
      );
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error('Could not load the tolerance.');
      const t: MatchTolerance = await res.json();
      setData(t);
      setAmount(String(t.amount_percent));
      setQuantity(String(t.quantity_percent));
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not load',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.access_token, toast]);

  useEffect(() => { load(); }, [load]);

  async function save(next?: { amount: string; quantity: string }) {
    if (!user?.access_token) return;
    setSaving(true);
    try {
      const res = await apiFetch(
        API_ENDPOINTS.CONFIG.MATCH_TOLERANCE,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount_percent: Number(next?.amount ?? amount),
            quantity_percent: Number(next?.quantity ?? quantity),
            reason: reason.trim() || null,
          }),
        },
        user.access_token,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not save.');
      setData(body);
      setAmount(String(body.amount_percent));
      setQuantity(String(body.quantity_percent));
      setReason('');
      toast({
        title: 'Tolerance updated',
        description: 'The change is versioned and on the audit trail.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Match tolerance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Changing this needs policies.manage. It decides whether three-way
            matching refuses an invoice, so it is not a general setting.
          </p>
        </CardContent>
      </Card>
    );
  }

  const amountNum = Number(amount);
  const quantityNum = Number(quantity);
  const dirty = !!data && (
    amountNum !== data.amount_percent || quantityNum !== data.quantity_percent
  );
  // Not a hard limit — the API owns that. This is the point at which somebody
  // should look at what they are typing.
  const loose = Number.isFinite(amountNum) && amountNum >= 10;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Match tolerance
          {data && (
            <Badge variant="outline" className="ml-auto font-normal">
              {data.is_default ? 'Default' : 'Configured'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          How far an invoice may differ from the goods actually received before
          three-way matching refuses it. Deliveries are short by a box and
          invoices differ by rounding; a match that fails on every trivial
          discrepancy gets switched off, and a control that is switched off
          protects nothing.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Nothing to show.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label htmlFor="tol-amount" className="text-sm font-medium">
                  Amount %
                </label>
                <Input
                  id="tol-amount"
                  className="w-28"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="tol-qty" className="text-sm font-medium">
                  Quantity %
                </label>
                <Input
                  id="tol-qty"
                  className="w-28"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            {/* The percentages in the units somebody buys things in. A reader
                should not have to do this arithmetic to know what they just
                agreed to accept. */}
            {Number.isFinite(amountNum) && Number.isFinite(quantityNum) && (
              <p className="text-xs text-muted-foreground">
                As it stands, an invoice for {EXAMPLE_AMOUNT.toLocaleString()}{' '}
                passes against a receipt as low as{' '}
                <span className="font-medium">
                  {(EXAMPLE_AMOUNT * (1 - amountNum / 100)).toLocaleString(
                    undefined, { maximumFractionDigits: 0 },
                  )}
                </span>
                , and {EXAMPLE_BOXES} boxes invoiced pass against{' '}
                <span className="font-medium">
                  {Math.floor(EXAMPLE_BOXES * (1 - quantityNum / 100))}
                </span>{' '}
                received.
              </p>
            )}

            {loose && (
              <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                At this width the match is forgiving discrepancies rather than
                rounding. The API refuses anything above {data.max_percent}%.
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="tol-reason" className="text-sm font-medium">
                Reason <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="tol-reason"
                placeholder="Why this is changing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Recorded on the version and the audit row. Loosening a control
                is the change somebody asks about six months later.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => save()} disabled={saving || !dirty}>
                {saving
                  ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  : <Save className="mr-2 h-3.5 w-3.5" />}
                Save
              </Button>
              {!data.is_default && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => save({
                    amount: String(data.defaults.amount_percent),
                    quantity: String(data.defaults.quantity_percent),
                  })}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Back to defaults ({data.defaults.amount_percent}% /{' '}
                  {data.defaults.quantity_percent}%)
                </Button>
              )}
            </div>

            <Separator />

            {/* Stated rather than implied by an absent control. */}
            <p className="text-xs text-muted-foreground">
              One pair of numbers applies to every line of every invoice. There
              is no per-category or per-vendor tolerance — the Build Book asks
              for a matrix here and the matching engine does not apply one, so
              this screen does not draw axes that nothing enforces.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
