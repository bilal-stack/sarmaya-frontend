'use client';

/**
 * One tender: invite, quote, close, compare, award, convert.
 *
 * The comparison is the heart of this screen, because it is where the decision
 * is actually made. Three things it must show and does:
 *
 *   * which is the cheapest *compliant* offer — a cheaper bid for the wrong
 *     specification is a different quote, not a better one;
 *   * who was invited and never answered, since a tender answered by one of
 *     five invitees is a different decision from one answered by all five;
 *   * whether the market came back above what the approval covered.
 *
 * Awarding anything other than the cheapest compliant quote demands a reason
 * here rather than letting the server be the first to say no — being refused
 * after clicking teaches people the reason is a formality to get past, and it
 * is the opposite: it is the part an auditor reads.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { RFQ, RFQState, QuoteComparison } from '@/types/sourcing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, ArrowLeft, Gavel, Send, LockKeyhole, Plus, Trophy, AlertTriangle,
  Info, UserPlus, ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';

/** Only what the invite picker needs; there is no shared Vendor type. */
interface VendorOption {
  id: string;
  legal_name: string;
  status: string;
}

const STATE_STYLE: Record<RFQState, string> = {
  draft: 'border-muted text-muted-foreground',
  issued: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  closed: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  awarded: 'border-green-500/50 bg-green-500/10 text-green-600',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [comparison, setComparison] = useState<QuoteComparison | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [inviteVendorId, setInviteVendorId] = useState('');
  const [quoteVendorId, setQuoteVendorId] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteLeadTime, setQuoteLeadTime] = useState('');
  const [quoteTerms, setQuoteTerms] = useState('');
  const [quoteCompliant, setQuoteCompliant] = useState(true);
  const [quoteNonComplianceReason, setQuoteNonComplianceReason] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [awardReason, setAwardReason] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [detail, comp, vendorList] = await Promise.all([
        apiFetch(API_ENDPOINTS.RFQS.DETAIL(id), {}, user.access_token),
        apiFetch(API_ENDPOINTS.RFQS.COMPARISON(id), {}, user.access_token),
        apiFetch(`${API_ENDPOINTS.VENDORS.LIST}/`, {}, user.access_token),
      ]);
      if (detail.ok) setRfq(await detail.json());
      if (comp.ok) setComparison(await comp.json());
      if (vendorList.ok) setVendors(await vendorList.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, url: string, body?: unknown, title?: string) => {
    if (!user?.access_token) return null;
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
          // A 403 here is the separation between running a tender and awarding
          // it, not a missing login. The server's wording says which.
          title: response.status === 403 ? 'Refused' : 'Could not do that',
          description:
            typeof payload.detail === 'string' ? payload.detail : 'Nothing changed.',
        });
        return null;
      }
      if (title) toast({ title });
      await load();
      return payload;
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

  if (!rfq) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
        <Card>
          <CardContent className="py-6">
            <p className="font-medium">Not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              This tender does not exist, or belongs to another organisation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = rfq.current_state;
  const invitedIds = new Set(rfq.invited_vendors.map((v) => v.vendor_id));
  const uninvited = vendors.filter((v) => !invitedIds.has(v.id));
  const quotedIds = new Set(rfq.quotes.map((q) => q.vendor_id));
  const yetToQuote = rfq.invited_vendors.filter((v) => !quotedIds.has(v.vendor_id));

  const lowestId = comparison?.lowest_compliant_quote_id ?? null;
  const chosen = comparison?.quotes.find((q) => q.quote_id === selectedQuote) ?? null;
  // The reason is demanded here, not discovered at the server.
  const reasonRequired = Boolean(chosen && lowestId && chosen.quote_id !== lowestId);
  const canAward =
    Boolean(selectedQuote) &&
    Boolean(chosen?.is_compliant) &&
    (!reasonRequired || awardReason.trim().length > 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/ai-tools/rfqs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Tenders
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-7 w-7 text-primary" />
            {rfq.rfq_number}
          </h1>
          <Badge variant="outline" className={STATE_STYLE[state]}>
            {label(state)}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          {rfq.title}
          {' · '}
          <Link
            href={`/ai-tools/requisitions/${rfq.requisition_id}`}
            className="text-primary hover:underline"
          >
            from the requisition
          </Link>
        </p>
      </div>

      {/* Who was asked */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invited vendors</CardTitle>
          <CardDescription>
            An award is only competitive if the invitation list was. At least two
            are needed to issue — one quote is not a comparison.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rfq.invited_vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody invited yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rfq.invited_vendors.map((vendor) => (
                <Badge key={vendor.vendor_id} variant="outline" className="text-xs">
                  {vendor.vendor_name}
                  {quotedIds.has(vendor.vendor_id) ? ' · quoted' : ' · no reply'}
                </Badge>
              ))}
            </div>
          )}

          {state === 'draft' && (
            <>
              <Separator />
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[14rem] space-y-1.5">
                  <Label className="text-xs">Invite a vendor</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={inviteVendorId}
                    onChange={(e) => setInviteVendorId(e.target.value)}
                  >
                    <option value="">Choose a vendor…</option>
                    {uninvited.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.legal_name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  disabled={!inviteVendorId || busy !== null}
                  onClick={async () => {
                    await act(
                      'invite',
                      API_ENDPOINTS.RFQS.INVITE(id),
                      { vendor_id: inviteVendorId },
                      'Invited'
                    );
                    setInviteVendorId('');
                  }}
                >
                  {busy === 'invite' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Invite
                </Button>
              </div>

              <Button
                className="w-full sm:w-auto"
                disabled={rfq.invited_vendors.length < 2 || busy !== null}
                onClick={() => act('issue', API_ENDPOINTS.RFQS.ISSUE(id), {}, 'Issued')}
              >
                {busy === 'issue' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Issue the tender
              </Button>
              {rfq.invited_vendors.length < 2 && (
                <p className="text-xs text-muted-foreground">
                  Invite at least two vendors first. For a single source, raise the
                  order directly rather than dressing it as a tender.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Capturing quotes */}
      {state === 'issued' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record a quote</CardTitle>
            <CardDescription>
              Vendors do not log in, so you enter what they offered — and the record
              says you did. {yetToQuote.length > 0 && `Still waiting on ${yetToQuote
                .map((v) => v.vendor_name)
                .join(', ')}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={quoteVendorId}
                  onChange={(e) => setQuoteVendorId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {yetToQuote.map((v) => (
                    <option key={v.vendor_id} value={v.vendor_id}>
                      {v.vendor_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total quoted</Label>
                <Input
                  type="number"
                  min="0"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lead time (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={quoteLeadTime}
                  onChange={(e) => setQuoteLeadTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment terms</Label>
                <Input
                  value={quoteTerms}
                  onChange={(e) => setQuoteTerms(e.target.value)}
                  placeholder="30 days"
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="compliant"
                checked={quoteCompliant}
                onCheckedChange={(v) => setQuoteCompliant(v === true)}
              />
              <div>
                <Label htmlFor="compliant" className="text-sm">
                  Meets the requirement
                </Label>
                <p className="text-xs text-muted-foreground">
                  Untick if it does not. A cheaper bid for the wrong specification
                  is a different quote, not a better one — marking it keeps it from
                  setting the benchmark every other quote is judged against.
                </p>
              </div>
            </div>

            {!quoteCompliant && (
              <Input
                value={quoteNonComplianceReason}
                onChange={(e) => setQuoteNonComplianceReason(e.target.value)}
                placeholder="What it fails to meet"
              />
            )}

            <Button
              disabled={!quoteVendorId || Number(quoteAmount) <= 0 || busy !== null}
              onClick={async () => {
                await act(
                  'quote',
                  API_ENDPOINTS.RFQS.QUOTES(id),
                  {
                    vendor_id: quoteVendorId,
                    total_amount: Number(quoteAmount),
                    lead_time_days: quoteLeadTime ? Number(quoteLeadTime) : null,
                    payment_terms: quoteTerms.trim() || null,
                    is_compliant: quoteCompliant,
                    non_compliance_reason: quoteCompliant
                      ? null
                      : quoteNonComplianceReason.trim() || null,
                    lines: [],
                  },
                  'Quote recorded'
                );
                setQuoteVendorId('');
                setQuoteAmount('');
                setQuoteLeadTime('');
                setQuoteTerms('');
                setQuoteCompliant(true);
                setQuoteNonComplianceReason('');
              }}
            >
              {busy === 'quote' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Record it
            </Button>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground max-w-md">
                Closing ends quoting. After it nobody can add or change a quote,
                including you — which is what makes these evidence rather than a
                record of what was written down once the field was known.
              </p>
              <Button
                variant="outline"
                disabled={rfq.quotes.length === 0 || busy !== null}
                onClick={() =>
                  act('close', API_ENDPOINTS.RFQS.CLOSE(id), {}, 'Quoting closed')
                }
              >
                {busy === 'close' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LockKeyhole className="h-4 w-4 mr-2" />
                )}
                Close quoting
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* The comparison — where the decision is made */}
      {comparison && comparison.quotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison</CardTitle>
            <CardDescription>
              {comparison.quoted_count} of {comparison.invited_count} invited vendors
              quoted.
              {comparison.no_response_vendors.length > 0 &&
                ` No reply from ${comparison.no_response_vendors.join(', ')}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {comparison.lowest_exceeds_estimate && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Even the cheapest compliant quote is above the approved estimate of{' '}
                  {money(comparison.requisition_estimate ?? 0)}. An order cannot be
                  raised until the requisition is approved again at the real figure.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2 font-medium">Vendor</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium text-right">Lead time</th>
                    <th className="py-2 px-2 font-medium">Terms</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.quotes.map((row) => {
                    const isLowest = row.quote_id === lowestId;
                    return (
                      <tr
                        key={row.quote_id}
                        className={`border-b last:border-0 ${
                          selectedQuote === row.quote_id ? 'bg-primary/5' : ''
                        } ${state === 'closed' ? 'cursor-pointer' : ''}`}
                        onClick={() =>
                          state === 'closed' &&
                          row.is_compliant &&
                          setSelectedQuote(row.quote_id)
                        }
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {state === 'closed' && row.is_compliant && (
                              <input
                                type="radio"
                                readOnly
                                checked={selectedQuote === row.quote_id}
                                aria-label={`Award to ${row.vendor_name}`}
                              />
                            )}
                            <span>{row.vendor_name}</span>
                            {isLowest && (
                              <Badge
                                variant="outline"
                                className="text-xs border-green-500/50 bg-green-500/10 text-green-600"
                              >
                                cheapest compliant
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">
                          {money(row.total_amount)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-muted-foreground">
                          {row.lead_time_days != null ? `${row.lead_time_days}d` : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-muted-foreground">
                          {row.payment_terms || '—'}
                        </td>
                        <td className="py-2.5 pl-2">
                          {row.is_compliant ? (
                            <span className="text-xs text-muted-foreground">
                              {label(row.state)}
                            </span>
                          ) : (
                            <span
                              className="text-xs text-destructive"
                              title={row.non_compliance_reason ?? undefined}
                            >
                              non-compliant
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {state === 'closed' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                    Pick a row to award it. Running the tender and awarding it are
                    separate authorities, so this may be somebody else&apos;s call.
                  </p>

                  {reasonRequired && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Why not the cheapest compliant quote?
                      </Label>
                      <Textarea
                        rows={2}
                        value={awardReason}
                        onChange={(e) => setAwardReason(e.target.value)}
                        placeholder="Five-day delivery; the cheaper vendor quoted six weeks."
                      />
                      <p className="text-xs text-muted-foreground">
                        Recorded with the figure it beat. This is the decision an
                        auditor will always ask about.
                      </p>
                    </div>
                  )}

                  <Button
                    disabled={!canAward || busy !== null}
                    onClick={() =>
                      act(
                        'award',
                        API_ENDPOINTS.RFQS.AWARD(id),
                        {
                          quote_id: selectedQuote,
                          justification: awardReason.trim() || null,
                        },
                        'Awarded'
                      )
                    }
                  >
                    {busy === 'award' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trophy className="h-4 w-4 mr-2" />
                    )}
                    Award{chosen ? ` to ${chosen.vendor_name}` : ''}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Awarded */}
      {state === 'awarded' && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-green-600" />
              Awarded
            </CardTitle>
            {rfq.awarded_at && (
              <CardDescription>
                {format(parseApiDate(rfq.awarded_at), 'dd MMM yyyy HH:mm')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {rfq.award_justification ? (
              <div>
                <p className="text-xs text-muted-foreground">Reason recorded</p>
                <p className="text-sm mt-0.5">{rfq.award_justification}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The cheapest compliant quote, so no justification was required.
              </p>
            )}
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Awarding and raising the order are held by different people —
                  the manager decides, the buyer raises it — so this button is
                  often not for whoever just awarded. Saying so beats letting
                  them find out from a 403. The frontend does not re-implement
                  the permission map to hide it: that map would drift from the
                  server's, and a button that silently vanishes is harder to
                  diagnose than one that explains itself. */}
              <p className="text-xs text-muted-foreground max-w-md">
                Raising the order carries the chain through — the whole story from
                the original need reads as one. It is refused if the award exceeds
                what was approved. Whoever runs sourcing raises it, which may not
                be whoever awarded it.
              </p>
              <Button
                disabled={busy !== null}
                onClick={async () => {
                  const order = await act(
                    'convert', API_ENDPOINTS.RFQS.CONVERT(id), {}, 'Order raised'
                  );
                  if (order?.id) router.push(`/ai-tools/purchase-orders/${order.id}`);
                }}
              >
                {busy === 'convert' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-2" />
                )}
                Raise the order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
