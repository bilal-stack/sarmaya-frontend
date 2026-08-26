'use client';

/**
 * The shared furniture for a report page.
 *
 * Extracted from the Control Room when the AP/Treasury page became its second
 * consumer — not before, because a component pulled out for one caller is a
 * guess about what the second one will need, and this way the shape is decided
 * by two real pages instead of one and an assumption.
 */

import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface PanelState {
  loading: boolean;
  error: string | null;
  data: unknown;
  reload: () => void;
  status?: number | null;
}

export const money = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Longest bar in a set, for scaling. Never zero, so a lone value still shows. */
export const peak = (values: number[]) => Math.max(1, ...values);

export function Panel({
  icon, title, description, state, children, forbiddenNote,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: PanelState;
  children: React.ReactNode;
  /** Shown instead of the error-and-retry when the answer is 403. Report pages
   *  mix permissions — payment figures read with payments.view while the rest
   *  of the page reads with the dashboard one — and "you may not see this" is a
   *  fact rather than a failure. Offering somebody a retry button for a
   *  permission they will never have makes a working page look broken. */
  forbiddenNote?: string;
}) {
  // Skeleton only when there is nothing to show yet. On a refresh the figures
  // stay put and the small header spinner does the talking — blanking numbers
  // somebody is reading, to replace them with the same numbers, is a flicker
  // that makes the page feel less trustworthy rather than more current.
  const firstLoad = state.loading && state.data === null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          {state.loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {firstLoad ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : state.status === 403 && forbiddenNote ? (
          <p className="py-2 text-sm text-muted-foreground">{forbiddenNote}</p>
        ) : state.error ? (
          <PanelError message={state.error} onRetry={state.reload} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function PanelError({
  message, onRetry,
}: { message: string; onRetry: () => void }) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="ghost" size="sm" className="mt-1" onClick={onRetry}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Try again
      </Button>
    </div>
  );
}

export function Stat({
  label, value, warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  const isProblem = warn && (typeof value === 'number' ? value > 0 : true);
  return (
    <div>
      <p className={`text-lg font-semibold ${isProblem ? 'text-orange-500' : ''}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{children}</p>;
}

/** A figure the system deliberately does not report, shown as such.
 *
 *  The alternative is a zero, and a zero is read as "none" rather than "we
 *  cannot see" — which on a payment-failure count is the difference between
 *  a quiet quarter and a blind spot. */
export function NotReported({
  label, why,
}: { label: string; why: string }) {
  return (
    <div className="rounded-md border border-dashed p-2.5">
      <p className="text-xs font-medium">{label}: not reported</p>
      <p className="text-xs text-muted-foreground mt-0.5">{why}</p>
    </div>
  );
}
