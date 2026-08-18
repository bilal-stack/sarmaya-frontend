'use client';

/**
 * A payment run.
 *
 * Maker-checker is the point of this screen, so it is shown as a fact rather
 * than implied: who prepared it, who released it, and — while it is waiting —
 * that the releaser must be someone else. The API resolves both names, because
 * two UUIDs side by side prove nothing to a person and reading the user
 * directory needs a permission the clerks who prepare runs do not have.
 *
 * The bank file is a download. The system sends nothing: a treasury user
 * uploads it to their own portal, and the page says so, because a button
 * labelled only "export" invites the assumption that money has moved.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { Payment, PaymentState } from '@/types/payment';
import { AuditTimelineView } from '@/components/governance/audit-timeline';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, ArrowLeft, Banknote, Send, CheckCircle2, XCircle, Download,
  ShieldCheck, AlertTriangle, FileSearch,
} from 'lucide-react';
import { format } from 'date-fns';

const STATE_STYLE: Record<PaymentState, string> = {
  draft: 'border-muted text-muted-foreground',
  pending_release: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  released: 'border-green-500/50 bg-green-500/10 text-green-600',
  rejected: 'border-destructive/50 bg-destructive/10 text-destructive',
  cancelled: 'border-muted text-muted-foreground',
};

const money = (v: string | null) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (s: string) => s.replace(/_/g, ' ');

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const paymentId = params.id as string;

  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const paymentRes = await apiFetch(
        API_ENDPOINTS.PAYMENTS.DETAIL(paymentId), {}, user.access_token
      );
      if (!paymentRes.ok) {
        const err = await paymentRes.json().catch(() => ({}));
        setError(typeof err.detail === 'string' ? err.detail : 'Payment not found');
        return;
      }
      setPayment(await paymentRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, paymentId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Names come with the payment. The id is only a last resort. */
  const nameFor = (name: string | null, id: string | null) =>
    name || (id ? `${id.slice(0, 8)}…` : null);

  const act = async (name: string, url: string, body?: unknown) => {
    if (!user?.access_token) return false;
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
          typeof err.detail === 'string' ? err.detail : `Could not ${name} this run`
        );
      }
      toast({ title: `Run ${name}` });
      await load();
      return true;
    } catch (e: any) {
      // Governance refusals land here — self-release, an invoice paid
      // meanwhile, a vendor with no account. Shown verbatim: the server's
      // wording says what to do about it.
      toast({ variant: 'destructive', title: `Not ${name}`, description: e.message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const downloadBankFile = async () => {
    if (!user?.access_token || !payment) return;
    setBusy('exported');
    try {
      const response = await apiFetch(
        API_ENDPOINTS.PAYMENTS.BANK_FILE(payment.id), {}, user.access_token
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.slice(0, 200) || 'Could not generate the file');
      }
      const content = await response.text();
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${payment.payment_number}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'File downloaded',
        description: 'Upload it to your banking portal. Nothing has been sent from here.',
      });
      await load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Not generated', description: e.message });
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

  if (error || !payment) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-4">
        <Button variant="ghost" onClick={() => router.push('/ai-tools/payments')}>
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

  const state = payment.current_state;
  const preparedByMe = payment.prepared_by === user.id;
  const canSubmit = state === 'draft';
  const canDecide = state === 'pending_release';
  const canExport = state === 'released';

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/ai-tools/payments')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Payments
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-7 w-7 text-primary" />
            {payment.payment_number}
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(parseApiDate(payment.payment_date), 'dd MMM yyyy')}
            {payment.reference && ` · ${payment.reference}`}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className={`text-sm ${STATE_STYLE[state]}`}>
            {label(state)}
          </Badge>
          <p className="text-2xl font-semibold mt-2">
            {money(payment.total_amount)}
            {payment.currency && (
              <span className="text-sm text-muted-foreground ml-1.5">{payment.currency}</span>
            )}
          </p>
        </div>
      </div>

      {/* Maker-checker, stated rather than implied */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Authorisation
          </CardTitle>
          <CardDescription>
            A run must be released by someone other than whoever prepared it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prepared by</span>
            <span className="font-medium">
              {nameFor(payment.prepared_by_name, payment.prepared_by)}
              {preparedByMe && (
                <span className="text-xs text-muted-foreground font-normal"> (you)</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Released by</span>
            <span className="font-medium">
              {payment.released_by ? (
                <>
                  {nameFor(payment.released_by_name, payment.released_by)}
                  {payment.released_at && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {' · '}
                      {format(parseApiDate(payment.released_at), 'dd MMM yyyy, HH:mm')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground font-normal">Not yet released</span>
              )}
            </span>
          </div>

          {canDecide && preparedByMe && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 mt-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-600">
                You prepared this run, so you cannot release it — not even as an
                administrator. Someone else with release authority has to.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions the state permits */}
      {(canSubmit || canDecide || canExport) && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 py-4">
            {canSubmit && (
              <Button
                disabled={busy !== null}
                onClick={() => act('submitted', API_ENDPOINTS.PAYMENTS.SUBMIT(payment.id))}
              >
                {busy === 'submitted' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send for release
              </Button>
            )}
            {canDecide && (
              <>
                {/* Disabled for the preparer, matching the notice above.
                    Offering a button beside the sentence explaining why it
                    cannot be used is just an invitation to a 403. The server
                    refuses it regardless. */}
                <Button
                  disabled={busy !== null || preparedByMe}
                  title={preparedByMe ? 'You prepared this run' : undefined}
                  onClick={() => act('released', API_ENDPOINTS.PAYMENTS.RELEASE(payment.id))}
                >
                  {busy === 'released' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Release
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
            {canExport && (
              <Button variant="outline" disabled={busy !== null} onClick={downloadBankFile}>
                {busy === 'exported' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download bank file
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {canExport && (
        <p className="text-xs text-muted-foreground -mt-3">
          The file is downloaded for you to upload to your banking portal. Nothing is sent
          from here, and no money moves until your bank acts on it.
        </p>
      )}

      {payment.rejection_reason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-destructive">Rejected</p>
            <p className="text-sm text-muted-foreground mt-1">{payment.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices settled</CardTitle>
          <CardDescription>
            Bank details were copied when the run was prepared, so the instruction stays
            reconstructable even if a vendor's details change later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.lines.map((line) => {
                  const destination = line.iban || line.bank_account_number;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="text-sm">{line.vendor_name}</p>
                        {line.bank_name && (
                          <p className="text-xs text-muted-foreground">{line.bank_name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {destination ? (
                          <span className="text-xs font-mono">{destination}</span>
                        ) : (
                          <span className="text-xs text-orange-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No account on file
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money(line.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {payment.bank_details_visible === false && (
            <p className="text-xs text-muted-foreground mt-3">
              Destination accounts are shown by their last four digits only —
              your role can confirm which account was paid without being handed
              the number itself.
            </p>
          )}

          {state !== 'released' &&
            payment.lines.some((l) => !l.iban && !l.bank_account_number) && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 mt-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-600">
                A line has no destination account, so this run cannot be released. Add the
                vendor's bank details first — a bank rejects an instruction with nowhere
                to send the money.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence of what went to the bank */}
      {payment.bank_file_hash && (
        <Card>
          <CardContent className="py-4 space-y-1">
            <p className="text-sm font-medium">Bank file</p>
            <p className="text-xs text-muted-foreground">
              Generated{' '}
              {payment.bank_file_generated_at &&
                format(parseApiDate(payment.bank_file_generated_at), 'dd MMM yyyy, HH:mm')}
              . Re-downloading produces the same file; a different one would not match this
              hash.
            </p>
            <p className="text-xs font-mono break-all text-muted-foreground pt-1">
              {payment.bank_file_hash}
            </p>
          </CardContent>
        </Card>
      )}

      {payment.correlation_id && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Transaction chain</p>
              <p className="text-xs text-muted-foreground font-mono break-all mt-0.5">
                {payment.correlation_id}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/ai-tools/audit?correlation_id=${payment.correlation_id}`}>
                <FileSearch className="h-4 w-4 mr-2" />
                Evidence pack
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <AuditTimelineView objectType="payment" objectId={payment.id} />

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this run</DialogTitle>
            <DialogDescription>
              The reason is recorded in the audit trail and shown to whoever prepared it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Why is this being rejected?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy !== null}
              onClick={async () => {
                const ok = await act(
                  'rejected', API_ENDPOINTS.PAYMENTS.REJECT(payment.id),
                  { reason: reason.trim() }
                );
                if (ok) {
                  setShowReject(false);
                  setReason('');
                }
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
