'use client';

/**
 * Change watchlist — what changed that nobody would have gone looking for.
 *
 * Vendor bank changes, vendor master data edits and approval policy changes
 * are all audited already, and that is not the same thing. An audit trail
 * answers "what happened to this record" for somebody who has already decided
 * to open that record. These three give nobody a reason to open anything: each
 * moves money, or moves the rule deciding who may send it, without touching a
 * single invoice. Someone watching invoices sees nothing at all.
 *
 * So the screen is built around one question — has a second person actually
 * looked at this — rather than around browsing history. Unreviewed alerts come
 * first, the note explains what was checked, and the person who made the
 * change cannot sign it off.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { WatchlistAlert, AlertCategory } from '@/types/watchlist';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Eye, RefreshCw, Landmark, Building2, Scale, CheckCircle2,
  ArrowRight, ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const CATEGORY_META: Record<AlertCategory, {
  label: string; icon: React.ReactNode; blurb: string;
}> = {
  vendor_bank_change: {
    label: 'Bank details',
    icon: <Landmark className="h-4 w-4" />,
    blurb: 'Where this vendor is paid has been proposed or changed.',
  },
  master_data_edit: {
    label: 'Master data',
    icon: <Building2 className="h-4 w-4" />,
    blurb: 'A vendor record was edited. A name or code can disguise a payee.',
  },
  policy_override: {
    label: 'Approval policy',
    icon: <Scale className="h-4 w-4" />,
    blurb: 'The rule deciding who may approve what has moved.',
  },
};

const FILTERS: Array<{ key: AlertCategory | 'all'; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'vendor_bank_change', label: 'Bank details' },
  { key: 'master_data_edit', label: 'Master data' },
  { key: 'policy_override', label: 'Policies' },
];

export default function WatchlistPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [openOnly, setOpenOnly] = useState(true);
  const [category, setCategory] = useState<AlertCategory | 'all'>('all');
  const [reviewing, setReviewing] = useState<WatchlistAlert | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (openOnly) params.append('open_only', 'true');
      if (category !== 'all') params.append('category', category);

      const response = await apiFetch(
        `${API_ENDPOINTS.WATCHLIST.LIST}?${params.toString()}`,
        {},
        user.access_token
      );
      if (response.status === 403) {
        // Oversight roles only. Say so rather than rendering an empty list,
        // which would read as "nothing has changed" — the opposite of true.
        setDenied(true);
        return;
      }
      if (!response.ok) throw new Error('Could not load the watchlist');
      const body = await response.json();
      setAlerts(body.items ?? []);
      setOpenCount(body.open_count ?? 0);
      setDenied(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, openOnly, category, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const acknowledge = async () => {
    if (!reviewing || !user?.access_token) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.WATCHLIST.ACKNOWLEDGE(reviewing.id),
        { method: 'POST', body: JSON.stringify({ note: note.trim() || null }) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not record the review');
      }
      toast({ title: 'Reviewed', description: 'Recorded against the change.' });
      setReviewing(null);
      setNote('');
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not permitted', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (isLoading && alerts.length === 0 && !denied)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (denied) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">The watchlist is an oversight surface</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              It goes to the roles that do not make these changes — an alert
              addressed to its own author is just a log line. Your role is the
              subject of the watchlist rather than its audience.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Eye className="h-7 w-7 text-primary" />
            Change watchlist
          </h1>
          <p className="text-muted-foreground mt-1">
            Changes that move money, or move the rules, without touching an
            invoice — so nothing else would surface them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={openOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOpenOnly((v) => !v)}
          >
            Unreviewed only
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Awaiting review</p>
            <p className={`text-2xl font-semibold mt-1 ${openCount > 0 ? 'text-yellow-600' : ''}`}>
              {openCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Showing</p>
            <p className="text-2xl font-semibold mt-1">{alerts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={category === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">
              {openOnly ? 'Everything has been reviewed' : 'Nothing on the watchlist'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {openOnly
                ? 'No bank change, master data edit or policy change is waiting on a second pair of eyes.'
                : 'No watched change has been recorded yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              mine={alert.actor_id === user.id}
              onReview={() => {
                setReviewing(alert);
                setNote('');
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={reviewing !== null}
        onOpenChange={(open) => !open && setReviewing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record your review</DialogTitle>
            <DialogDescription>{reviewing?.summary}</DialogDescription>
          </DialogHeader>
          <div>
            <Textarea
              placeholder="What did you check, and what did you conclude? e.g. Confirmed with procurement on the number we already had."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              A note is optional, but an acknowledgement without one records
              that somebody clicked — which is not the same as somebody checking.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={acknowledge}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark reviewed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertCard({
  alert, mine, onReview,
}: {
  alert: WatchlistAlert;
  mine: boolean;
  onReview: () => void;
}) {
  const meta = CATEGORY_META[alert.category] ?? {
    label: alert.category,
    icon: <Eye className="h-4 w-4" />,
    blurb: '',
  };
  const reviewed = alert.acknowledged_at !== null;
  const high = alert.severity === 'high';

  return (
    <Card className={!reviewed && high ? 'border-red-500/40' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{alert.summary}</CardTitle>
            <CardDescription className="mt-1">{meta.blurb}</CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`gap-1 ${
                high
                  ? 'border-red-500/50 bg-red-500/10 text-red-600'
                  : 'border-muted bg-muted/30 text-muted-foreground'
              }`}
            >
              {meta.icon}
              {meta.label}
            </Badge>
            {reviewed && (
              <Badge variant="outline" className="gap-1 border-green-500/50 bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <AlertDiff detail={alert.detail} />

        <Separator className="my-3" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseApiDate(alert.created_at), { addSuffix: true })}
            {mine && ' · by you'}
            {reviewed && alert.acknowledgement_note
              ? ` · reviewed: ${alert.acknowledgement_note}`
              : ''}
          </p>

          {!reviewed && (
            mine ? (
              // No button. The server refuses self-acknowledgement, and the
              // second pair of eyes is the entire purpose of the alert.
              <p className="text-xs text-muted-foreground italic">
                You made this change, so somebody else reviews it.
              </p>
            ) : (
              <Button size="sm" onClick={onReview}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Review
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The change itself, before beside after.
 *
 * The Build Book asks for inline diffs on exactly these three kinds of change,
 * and the reason is the one that shapes the bank-change screen too: the
 * substitution is what a reviewer is judging, and showing only the new value
 * gives them nothing to compare it against.
 */
function AlertDiff({ detail }: { detail: Record<string, any> | null }) {
  if (!detail) return null;

  // A bank change carries the two accounts directly, already masked.
  if (detail.old_iban !== undefined || detail.new_iban !== undefined) {
    return (
      <DiffRows
        rows={[{ label: 'IBAN', before: detail.old_iban, after: detail.new_iban }]}
      />
    );
  }

  const before = (detail.before ?? {}) as Record<string, any>;
  const after = (detail.after ?? {}) as Record<string, any>;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (keys.length === 0) return null;

  return (
    <DiffRows
      rows={keys.map((key) => ({
        label: key.replace(/_/g, ' '),
        before: before[key],
        after: after[key],
      }))}
    />
  );
}

function DiffRows({
  rows,
}: {
  rows: Array<{ label: string; before: any; after: any }>;
}) {
  const show = (v: any) =>
    v === null || v === undefined || v === '' ? '—' : String(v);

  return (
    <div className="rounded-md border divide-y">
      {rows.map((row) => {
        const changed = show(row.before) !== show(row.after);
        return (
          <div
            key={row.label}
            className="grid grid-cols-[8rem_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-xs"
          >
            <span className="text-muted-foreground capitalize">{row.label}</span>
            <span className={`font-mono truncate ${changed ? 'line-through text-muted-foreground' : ''}`}>
              {show(row.before)}
            </span>
            <ArrowRight className={`h-3 w-3 ${changed ? 'text-red-500' : 'text-muted-foreground/40'}`} />
            <span className={`font-mono truncate ${changed ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {show(row.after)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
