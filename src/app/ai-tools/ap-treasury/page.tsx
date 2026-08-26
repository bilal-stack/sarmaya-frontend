'use client';

/**
 * The AP/Treasury desk.
 *
 * Build Book, AP/Treasury persona: invoice throughput, payment run status,
 * duplicate/anomaly, and bank reconciliation breaks. The fourth already had a
 * home on the Control Room, so this page carries the other three.
 *
 * Its own page rather than three more Control Room panels, because the
 * audience is different. The Control Room answers "what is stuck and what is
 * it worth" for somebody deciding where to spend attention this week. This
 * answers "what is on my desk right now" for somebody clearing it, and the two
 * readers want the same facts ordered differently.
 *
 * **Two figures are shown as deliberately absent rather than as zero**, which
 * is the part of this page most worth preserving. Match rate cannot be
 * recovered, and a bank-side payment failure cannot be observed at all — and a
 * zero in either place would be read as good news rather than as no news. The
 * NotReported block says which it is.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { useToast } from '@/hooks/use-toast';
import { downloadWithAuth } from '@/lib/download';
import {
  Panel, Empty, Stat, NotReported, money,
} from '@/components/reports/panel';
import type {
  InvoiceThroughput, PaymentRunStatus, DuplicateAnomaly,
} from '@/types/dashboards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2, RefreshCw, Download, Banknote, Timer, CopyCheck, Wallet,
} from 'lucide-react';

/** Runs that need a person, in the order a treasury user would work them. */
const REPORTS = [
  { key: 'payment-run-status', label: 'Payment run status' },
  { key: 'invoice-throughput', label: 'Invoice throughput' },
  { key: 'duplicate-anomaly', label: 'Duplicates and anomalies' },
] as const;

function hours(value: number | null): string {
  if (value === null) return '—';
  if (value < 48) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

export default function ApTreasuryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  const throughput = usePanel<InvoiceThroughput>(
    API_ENDPOINTS.DASHBOARD.INVOICE_THROUGHPUT, reloadKey,
  );
  // 403s for a manager or an approver: they can open every invoice this
  // touches and cannot open a payment run. The panel says so rather than
  // offering a retry for a permission they will never have.
  const runs = usePanel<PaymentRunStatus>(
    API_ENDPOINTS.DASHBOARD.PAYMENT_RUN_STATUS, reloadKey,
  );
  const duplicates = usePanel<DuplicateAnomaly>(
    API_ENDPOINTS.DASHBOARD.DUPLICATE_ANOMALY, reloadKey,
  );

  const anyLoading = [throughput, runs, duplicates].some((p) => p.loading);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  const download = async (report: string, format: 'csv' | 'html') => {
    if (!user?.access_token) return;
    setDownloading(report);
    try {
      await downloadWithAuth(
        API_ENDPOINTS.DASHBOARD.EXPORT(report, format),
        user.access_token,
        `${report}.${format}`,
      );
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not download',
        description: error.message,
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            AP &amp; Treasury
          </h1>
          <p className="text-muted-foreground mt-1">
            What is on the desk: runs waiting on a person, how long invoices
            take, and what the duplicate check held back.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={downloading !== null}>
                {downloading
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Download className="h-4 w-4 mr-2" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Download a report</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {REPORTS.map((report) => (
                <DropdownMenuItem
                  key={report.key}
                  onClick={() => download(report.key, 'csv')}
                >
                  <div>
                    <p className="font-medium">{report.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Spreadsheet (CSV)
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline" size="sm"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={anyLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${anyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Payment runs first: it is the only thing here with money waiting on
          somebody, and the two lists under it are both "nobody has done the
          next step". */}
      <Card className="mb-6">
        <CardContent className="py-0">
          <Panel
            icon={<Banknote className="h-5 w-5 text-primary" />}
            title="Payment runs"
            description={
              runs.data
                ? `Last ${runs.data.window_days} days.`
                : 'Where every run is.'
            }
            state={runs}
            forbiddenNote="Your role cannot see payment runs. This reads with the payments permission rather than the dashboard one, the same as the runs themselves."
          >
            {runs.data && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  {runs.data.by_state.length === 0 ? (
                    <Empty>No runs in this window.</Empty>
                  ) : (
                    runs.data.by_state.map((row) => (
                      <div key={row.state}>
                        <p className="text-lg font-semibold">{money(row.value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.state.replace(/_/g, ' ')} · {row.count}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {runs.data.awaiting_bank_file.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium">
                        Released, no bank file yet
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Authorised, and nothing has been handed to the bank.
                      </p>
                      {runs.data.awaiting_bank_file.map((row) => (
                        <div
                          key={row.payment_number}
                          className="flex items-center justify-between text-sm py-0.5"
                        >
                          <span>{row.payment_number}</span>
                          <span className="text-muted-foreground">
                            {money(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {runs.data.unreconciled_after_release.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium">
                        Sent, never seen on a statement
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        The file went to the bank and the money has not appeared.
                        The closest this system can get to a failed transfer.
                      </p>
                      {runs.data.unreconciled_after_release.map((row) => (
                        <div
                          key={row.payment_number}
                          className="flex items-center justify-between text-sm py-0.5"
                        >
                          <span>{row.payment_number}</span>
                          <span className="text-muted-foreground">
                            {money(row.value)}
                            {row.age_days !== null && (
                              <Badge
                                variant="outline"
                                className={`ml-2 ${
                                  row.age_days > 7
                                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                                    : ''
                                }`}
                              >
                                {Math.round(row.age_days)}d
                              </Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator />
                <div className="grid gap-2 sm:grid-cols-2">
                  <NotReported label="Failed" why={runs.data.not_reported.failed} />
                  <NotReported label="Reissued" why={runs.data.not_reported.reissued} />
                </div>
              </div>
            )}
          </Panel>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          icon={<Timer className="h-5 w-5 text-primary" />}
          title="Invoice throughput"
          description={
            throughput.data
              ? `Capture to paid, last ${throughput.data.window_days} days.`
              : 'Capture to paid.'
          }
          state={throughput}
        >
          {throughput.data && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-6">
                <Stat
                  label="median capture to paid"
                  value={hours(throughput.data.capture_to_paid_hours.median)}
                />
                <Stat label="captured" value={throughput.data.captured} />
                <Stat label="settled" value={throughput.data.settled} />
                <Stat
                  label="rework rate"
                  value={`${throughput.data.rework_rate_pct}%`}
                  warn
                />
              </div>

              {throughput.data.rework_drivers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    What sent work backwards. A rejected, corrected and
                    re-approved invoice counts once in a state total and three
                    times in somebody&apos;s day.
                  </p>
                  {throughput.data.rework_drivers.slice(0, 5).map((row) => (
                    <div
                      key={row.reason}
                      className="flex items-center justify-between gap-2 text-sm py-0.5"
                    >
                      <span className="truncate">{row.reason}</span>
                      <span className="text-muted-foreground shrink-0">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {throughput.data.match_rate_pct === null && (
                <NotReported
                  label="Match rate"
                  why="Three-way match is recomputed on demand and never stored, so what an invoice matched when it was approved cannot be recovered."
                />
              )}
            </div>
          )}
        </Panel>

        <Panel
          icon={<CopyCheck className="h-5 w-5 text-primary" />}
          title="Duplicates and anomalies"
          description={
            duplicates.data
              ? `Flagged in the last ${duplicates.data.window_days} days.`
              : 'What the duplicate check caught.'
          }
          state={duplicates}
        >
          {duplicates.data && (
            <div className="space-y-3">
              {duplicates.data.flagged === 0 ? (
                <Empty>Nothing was flagged as a duplicate.</Empty>
              ) : (
                <>
                  <div className="flex flex-wrap gap-6">
                    <Stat label="flagged" value={duplicates.data.flagged} />
                    <Stat label="stopped" value={duplicates.data.stopped} />
                    <Stat label="still held" value={duplicates.data.still_held} />
                    <Stat
                      label="paid anyway"
                      value={duplicates.data.paid_anyway}
                      warn
                    />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {money(duplicates.data.value_held_back)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      held back by the flag — what it stopped, not a claim that
                      every one would have been paid twice
                    </p>
                  </div>
                </>
              )}

              {duplicates.data.watchlist.length > 0 && (
                <div>
                  <Separator className="my-2" />
                  <p className="text-xs text-muted-foreground mb-1">Watchlist</p>
                  {duplicates.data.watchlist.map((row) => (
                    <div
                      key={`${row.category}-${row.severity}`}
                      className="flex items-center justify-between gap-2 text-sm py-0.5"
                    >
                      <span className="truncate">
                        {row.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {row.open} open / {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
