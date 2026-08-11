'use client';

/**
 * Bank reconciliation.
 *
 * Unexplained debits lead the page, ahead of outstanding payments. That is
 * deliberate: an outstanding payment is a chase, but a debit no instruction
 * explains cannot be produced by any mistake inside the workflow, and it is the
 * one item here worth waking someone up for. A screen that buries it under a
 * list of routine chases is a screen nobody reads it on.
 *
 * Nothing on this page matches anything by itself. A candidate is rendered as a
 * suggestion with its score, its confidence and the named reasons behind it,
 * next to a button a person presses. An automatic match that is wrong marks a
 * payment as cleared when it did not clear, and hides the unexplained debit
 * beside it by consuming it — so the confirm step is the whole design, not a
 * formality to be optimised away.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch, apiUpload } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type {
  ReconciliationSummary,
  UnexplainedDebit,
  OutstandingPayment,
  MatchCandidate,
  BankStatementSummary,
} from '@/types/bank-statement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Landmark, Upload, Lock, AlertTriangle, Clock, CheckCircle2,
  FileWarning, ArrowRight, Info,
} from 'lucide-react';
import { format } from 'date-fns';

const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'border-green-500/50 bg-green-500/10 text-green-600',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  low: 'border-muted text-muted-foreground',
};

const FORMAT_LABEL: Record<string, string> = {
  camt053: 'CAMT.053',
  mt940: 'MT940',
  csv: 'CSV',
};

export default function ReconciliationPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [statements, setStatements] = useState<BankStatementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [canImport, setCanImport] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.BANK_STATEMENTS.RECONCILIATION, {}, user.access_token),
        apiFetch(API_ENDPOINTS.BANK_STATEMENTS.LIST, {}, user.access_token),
      ]);
      if (summaryRes.status === 403) {
        setDenied(true);
        return;
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (listRes.ok) setStatements(await listRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    if (!user?.access_token) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await apiUpload(
        API_ENDPOINTS.BANK_STATEMENTS.UPLOAD, form, user.access_token
      );
      const body = await response.json().catch(() => ({}));

      if (response.status === 403) {
        setCanImport(false);
        toast({
          variant: 'destructive',
          title: 'Not permitted',
          description: 'You do not have permission to import bank statements.',
        });
        return;
      }
      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Statement not imported',
          description: body.detail ?? 'The file could not be read.',
        });
        return;
      }
      toast({
        title: `Imported ${body.statement_reference}`,
        description: `${body.lines?.length ?? 0} transaction(s) from a ${
          FORMAT_LABEL[body.source_format] ?? body.source_format
        } file.`,
      });
      await load();
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const confirmMatch = async (line: UnexplainedDebit, candidate: MatchCandidate) => {
    if (!user?.access_token) return;
    setConfirming(line.id);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.BANK_STATEMENTS.MATCH(line.id),
        { method: 'POST', body: JSON.stringify({ payment_id: candidate.payment_id }) },
        user.access_token
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          variant: 'destructive',
          // A 403 here is segregation of duties, not a missing permission: the
          // person who released a run may not be the one who certifies it
          // cleared. Showing the server's wording keeps that legible.
          title: response.status === 403 ? 'Refused' : 'Could not match',
          description: body.detail ?? 'The match was not recorded.',
        });
        return;
      }
      toast({
        title: `Matched to ${candidate.payment_number}`,
        description: 'Recorded against the payment, with the suggestion that was shown.',
      });
      await load();
    } finally {
      setConfirming(null);
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

  if (denied) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Not permitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                You do not have permission to view bank statements.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unexplained = summary?.cleared_not_instructed ?? [];
  const outstanding = summary?.instructed_not_cleared ?? [];
  // The subset with nothing that could explain them. Everything else on that
  // list is merely unreconciled; these are the findings.
  const unexplainable = unexplained.filter((line) => line.candidates.length === 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">
            What the bank actually did, against what was instructed.
          </p>
        </div>
        {canImport && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".xml,.txt,.sta,.csv,.940"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={isUploading}>
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import a statement
            </Button>
          </>
        )}
      </div>

      {unexplainable.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {unexplainable.length} debit(s) no payment run explains
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Money left the account and nothing in this system instructed it.
                Investigate before reconciling anything else.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unexplained debits lead: an outstanding payment is a chase, this is a
          finding. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-muted-foreground" />
            Cleared, not instructed
          </CardTitle>
          <CardDescription>
            Debits on the statement with no payment matched to them. Confirming a
            suggestion is a decision — the reasons behind each one are shown so you
            can disagree with it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unexplained.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Every debit on file is accounted for.
            </p>
          ) : (
            unexplained.map((line) => (
              <DebitRow
                key={line.id}
                line={line}
                busy={confirming === line.id}
                onConfirm={(candidate) => confirmMatch(line, candidate)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Instructed, not cleared
          </CardTitle>
          <CardDescription>
            Released runs the bank has not confirmed. Either the file was never
            uploaded, or the bank rejected it — the vendor is unpaid either way.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {outstanding.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Nothing released is waiting on the bank.
            </p>
          ) : (
            outstanding.map((payment) => (
              <OutstandingRow key={payment.id} payment={payment} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imported statements</CardTitle>
          <CardDescription>
            {statements.length} file(s). The same file cannot be imported twice —
            duplicating its transactions would make the reconciliation lie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {statements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No statements imported yet. CAMT.053, MT940 and CSV are all read; the
              format is detected from the file's contents.
            </p>
          ) : (
            statements.map((statement) => (
              <div
                key={statement.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* A CSV has no reference of its own, so every CSV import
                        reports the same one — the filename is the only thing
                        distinguishing two of them to whoever downloaded them. */}
                    <span className="text-sm font-medium">
                      {statement.original_filename ?? statement.statement_reference}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {FORMAT_LABEL[statement.source_format] ?? statement.source_format}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imported {format(parseApiDate(statement.created_at), 'dd MMM yyyy HH:mm')}
                    {statement.original_filename &&
                      ` · ${statement.statement_reference}`}
                    {statement.account_identifier && ` · ${statement.account_identifier}`}
                  </p>
                </div>
                {statement.closing_balance && (
                  <span className="text-sm text-muted-foreground">
                    closing {money(statement.closing_balance)}
                  </span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DebitRow({
  line,
  busy,
  onConfirm,
}: {
  line: UnexplainedDebit;
  busy: boolean;
  onConfirm: (candidate: MatchCandidate) => void;
}) {
  const dated = line.value_date ?? line.booking_date;
  const unexplainable = line.candidates.length === 0;

  return (
    <div
      className={`rounded-md border p-3 ${
        unexplainable ? 'border-destructive/40 bg-destructive/5' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {line.description || line.counterparty || 'Unlabelled debit'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {dated && format(parseApiDate(dated), 'dd MMM yyyy')}
            {line.counterparty && ` · ${line.counterparty}`}
            {line.bank_reference && ` · ref ${line.bank_reference}`}
            {line.statement_reference && ` · ${line.statement_reference}`}
          </p>
        </div>
        <span className="text-sm font-medium whitespace-nowrap">
          {money(line.amount)} {line.currency ?? ''}
        </span>
      </div>

      {unexplainable ? (
        <p className="text-xs text-destructive mt-3 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
          No released payment run could have produced this debit.
        </p>
      ) : (
        <>
          <Separator className="my-3" />
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Suggested — nothing is matched until you confirm it.
          </p>
          <div className="space-y-2">
            {line.candidates.map((candidate) => (
              <div
                key={candidate.payment_id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/40 p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/ai-tools/payments/${candidate.payment_id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {candidate.payment_number}
                    </Link>
                    <Badge
                      variant="outline"
                      className={`text-xs ${CONFIDENCE_STYLE[candidate.confidence]}`}
                    >
                      {candidate.confidence} · {candidate.score}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {money(candidate.total_amount)}
                    </span>
                  </div>
                  {/* The reasoning, not just the score. A number nobody can
                      interrogate makes confirmation a formality. */}
                  <ul className="mt-1.5 space-y-0.5">
                    {candidate.reasons.map((reason) => (
                      <li key={reason} className="text-xs text-muted-foreground">
                        · {reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onConfirm(candidate)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm match'}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OutstandingRow({ payment }: { payment: OutstandingPayment }) {
  return (
    <Link
      href={`/ai-tools/payments/${payment.id}`}
      className="block rounded-md border p-3 hover:border-primary/60 transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{payment.payment_number}</span>
            <Badge
              variant="outline"
              className="text-xs border-yellow-500/50 bg-yellow-500/10 text-yellow-600"
            >
              {payment.days_outstanding} day(s) outstanding
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Released {format(parseApiDate(payment.payment_date), 'dd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {money(payment.total_amount)} {payment.currency ?? ''}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
