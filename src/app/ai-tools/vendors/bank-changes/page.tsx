'use client';

/**
 * Vendor bank detail changes — the AP fraud control, made usable.
 *
 * The threat is specific, and every part of this screen is shaped by it. An
 * attacker does not need to forge an invoice. They need one line of a vendor
 * record changed, and then they wait: the next genuine invoice, properly
 * approved and properly released, pays them instead. Every downstream control
 * passes because nothing downstream is wrong.
 *
 * So the screen has to show the *substitution*, not the result — old account
 * beside new, which is the comparison an approver is actually making — and it
 * has to say out loud that the wait is deliberate, because a countdown with no
 * explanation reads as the system being slow rather than as the control
 * working.
 *
 * The server refuses the requester's own approval with no admin exemption, and
 * holds payments to the vendor while a change is open. Both are stated here so
 * neither arrives as an unexplained 403.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { BankChange, BankChangeState } from '@/types/vendor-bank';
import { OPEN_STATES } from '@/types/vendor-bank';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Landmark, RefreshCw, ShieldAlert, CheckCircle2, XCircle,
  Clock, ArrowRight, Plus, AlertTriangle, Undo2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VendorOption {
  id: string;
  legal_name: string;
  status: string;
}

const STATE_META: Record<BankChangeState, { label: string; tone: string }> = {
  pending_approval: {
    label: 'Awaiting approval',
    tone: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  },
  approved: {
    label: 'Cooling period',
    tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  },
  effective: {
    label: 'Applied',
    tone: 'border-green-500/50 bg-green-500/10 text-green-600',
  },
  rejected: {
    label: 'Rejected',
    tone: 'border-red-500/50 bg-red-500/10 text-red-600',
  },
  cancelled: {
    label: 'Withdrawn',
    tone: 'border-gray-500/50 bg-gray-500/10 text-gray-500',
  },
};

/** The fields that move through this flow, in the order a person reads them. */
const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'bank_account_name', label: 'Account name' },
  { key: 'bank_name', label: 'Bank' },
  { key: 'iban', label: 'IBAN' },
  { key: 'bank_account_number', label: 'Account number' },
  { key: 'swift_code', label: 'SWIFT' },
];

export default function BankChangesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [changes, setChanges] = useState<BankChange[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  const [showRequest, setShowRequest] = useState(false);
  const [rejecting, setRejecting] = useState<BankChange | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [changesRes, vendorsRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.VENDORS.BANK_CHANGES, {}, user.access_token),
        apiFetch(API_ENDPOINTS.VENDORS.LIST, {}, user.access_token),
      ]);
      if (!changesRes.ok) throw new Error('Could not load bank changes');
      setChanges(await changesRes.json());
      if (vendorsRes.ok) {
        const body = await vendorsRes.json();
        setVendors(Array.isArray(body) ? body : body.items ?? []);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    change: BankChange, url: string, successTitle: string, body?: object
  ) => {
    if (!user?.access_token) return false;
    setBusyId(change.id);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // A 403 here is almost always the control working — the requester
        // trying to approve their own change, or a role that deliberately
        // does not hold vendors.approve_bank_change. Show what the server
        // said rather than a generic failure.
        throw new Error(err.detail || 'The server refused this');
      }
      toast({ title: successTitle });
      load();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive', title: 'Not permitted', description: error.message,
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const vendorName = useMemo(() => {
    const byId = new Map(vendors.map((v) => [v.id, v.legal_name]));
    return (id: string) => byId.get(id) ?? 'this vendor';
  }, [vendors]);

  if (authLoading || (isLoading && changes.length === 0)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const visible = openOnly
    ? changes.filter((c) => OPEN_STATES.includes(c.current_state))
    : changes;
  const openCount = changes.filter((c) =>
    OPEN_STATES.includes(c.current_state)
  ).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            Vendor bank changes
          </h1>
          <p className="text-muted-foreground mt-1">
            Bank details cannot be edited directly. They move through a request
            someone else approves, then a cooling period, then an explicit apply.
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
            <Clock className="h-4 w-4 mr-2" />
            Open only
          </Button>
          <Button size="sm" onClick={() => setShowRequest(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request a change
          </Button>
        </div>
      </div>

      {openCount > 0 && (
        <Card className="mb-6 border-yellow-500/40 bg-yellow-500/[0.06]">
          <CardContent className="flex items-start gap-2 py-4">
            <ShieldAlert className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                {openCount} change{openCount === 1 ? '' : 's'} unresolved —
                payments to {openCount === 1 ? 'that vendor are' : 'those vendors are'} held
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Held to the old account as well as the new one. If the change is
                fraudulent the old account may already be compromised; if it is
                genuine the vendor is expecting the new one. Holding is the only
                answer that is right in both cases.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No bank changes</p>
            <p className="text-sm text-muted-foreground mt-1">
              {openOnly
                ? 'Nothing is currently unresolved.'
                : 'Nobody has proposed a change to a vendor’s bank details.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              vendorName={vendorName(change.vendor_id)}
              currentUserId={user.id}
              busy={busyId === change.id}
              onApprove={() =>
                act(change, API_ENDPOINTS.VENDORS.APPROVE_BANK_CHANGE(change.id),
                    'Approved — the cooling period has started')
              }
              onApply={() =>
                act(change, API_ENDPOINTS.VENDORS.APPLY_BANK_CHANGE(change.id),
                    'Applied to the vendor record')
              }
              onReject={() => {
                setRejecting(change);
                setRejectReason('');
              }}
              onCancel={() =>
                act(change, API_ENDPOINTS.VENDORS.CANCEL_BANK_CHANGE(change.id),
                    'Request withdrawn', { reason: 'Withdrawn by the requester.' })
              }
            />
          ))}
        </div>
      )}

      <RequestDialog
        open={showRequest}
        onOpenChange={setShowRequest}
        vendors={vendors}
        token={user.access_token}
        onDone={() => {
          setShowRequest(false);
          load();
        }}
        toast={toast}
      />

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this change</DialogTitle>
            <DialogDescription>
              The vendor keeps its current account. The reason is recorded and
              shown to whoever asked for the change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Rang the number we already had on file; they never asked for this."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || busyId !== null}
              onClick={async () => {
                if (!rejecting) return;
                const ok = await act(
                  rejecting,
                  API_ENDPOINTS.VENDORS.REJECT_BANK_CHANGE(rejecting.id),
                  'Rejected — the vendor keeps its current account',
                  { reason: rejectReason.trim() }
                );
                if (ok) setRejecting(null);
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

function ChangeCard({
  change, vendorName, currentUserId, busy,
  onApprove, onApply, onReject, onCancel,
}: {
  change: BankChange;
  vendorName: string;
  currentUserId: string;
  busy: boolean;
  onApprove: () => void;
  onApply: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const meta = STATE_META[change.current_state];
  const mine = change.requested_by === currentUserId;
  const coolingUntil = change.effective_at ? parseApiDate(change.effective_at) : null;
  const stillCooling = coolingUntil ? coolingUntil.getTime() > Date.now() : false;

  return (
    <Card className={OPEN_STATES.includes(change.current_state)
      ? 'border-yellow-500/40' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{vendorName}</CardTitle>
            <CardDescription className="mt-1">
              Reason given: {change.reason}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`gap-1 shrink-0 ${meta.tone}`}>
            {meta.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <FieldDiff change={change} />

        {!change.bank_details_visible && (
          <p className="text-xs text-muted-foreground mt-2">
            Account numbers are shown by their last four digits only — your role
            can confirm which account changed without being handed the number.
          </p>
        )}

        {change.current_state === 'approved' && (
          <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/[0.06] p-3 mt-3">
            <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {stillCooling && coolingUntil ? (
                <>
                  The cooling period ends{' '}
                  {formatDistanceToNow(coolingUntil, { addSuffix: true })}. The wait
                  is the control: it is the window in which the real vendor can tell
                  you they never asked for this.
                </>
              ) : (
                <>
                  The cooling period has passed. Applying writes the new details
                  onto the vendor and releases payments.
                </>
              )}
            </p>
          </div>
        )}

        {change.current_state === 'rejected' && change.rejection_reason && (
          <p className="text-xs text-muted-foreground mt-3">
            Rejected: {change.rejection_reason}
          </p>
        )}

        <Separator className="my-3" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Requested {formatDistanceToNow(parseApiDate(change.requested_at), {
              addSuffix: true,
            })}
            {mine && ' by you'}
          </p>

          <div className="flex gap-2">
            {change.current_state === 'pending_approval' && (
              <>
                {mine ? (
                  // No button for the requester. The server refuses this with no
                  // admin exemption, and offering a control that cannot work is
                  // just an invitation to a 403.
                  <p className="text-xs text-muted-foreground italic">
                    You asked for this change, so somebody else approves it.
                  </p>
                ) : (
                  <>
                    <Button variant="outline" size="sm" disabled={busy}
                            onClick={onReject}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" disabled={busy} onClick={onApprove}>
                      {busy ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                  </>
                )}
                {mine && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
                    <Undo2 className="h-4 w-4 mr-1" />
                    Withdraw
                  </Button>
                )}
              </>
            )}

            {change.current_state === 'approved' && (
              <Button
                size="sm"
                disabled={busy || stillCooling}
                title={stillCooling ? 'The cooling period is still running' : undefined}
                onClick={onApply}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-1" />
                )}
                Apply to vendor
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Old beside new. The substitution is the thing being judged — an approver
 *  shown only the new account has nothing to compare it against. */
function FieldDiff({ change }: { change: BankChange }) {
  const rows = FIELDS.map(({ key, label }) => ({
    label,
    before: (change as any)[`old_${key}`] as string | null,
    after: (change as any)[`new_${key}`] as string | null,
  })).filter((r) => r.after !== null || r.before !== null);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border divide-y">
      {rows.map((row) => {
        const changed = row.after !== null && row.after !== row.before;
        return (
          <div
            key={row.label}
            className="grid grid-cols-[7rem_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-xs"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`font-mono truncate ${changed ? 'line-through text-muted-foreground' : ''}`}>
              {row.before ?? '—'}
            </span>
            <ArrowRight className={`h-3 w-3 ${changed ? 'text-red-500' : 'text-muted-foreground/40'}`} />
            <span className={`font-mono truncate ${changed ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {row.after ?? (row.before ?? '—')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RequestDialog({
  open, onOpenChange, vendors, token, onDone, toast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: VendorOption[];
  token: string;
  onDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [vendorId, setVendorId] = useState('');
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const canSubmit =
    vendorId && reason.trim().length > 0 &&
    Object.values(fields).some((v) => v.trim().length > 0);

  const submit = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { reason: reason.trim() };
      for (const [key, value] of Object.entries(fields)) {
        if (value.trim()) body[key] = value.trim();
      }
      const response = await apiFetch(
        API_ENDPOINTS.VENDORS.REQUEST_BANK_CHANGE(vendorId),
        { method: 'POST', body: JSON.stringify(body) },
        token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not raise the request');
      }
      toast({
        title: 'Change requested',
        description:
          'Somebody else must approve it, and payments to this vendor are held until it is resolved.',
      });
      setVendorId('');
      setReason('');
      setFields({});
      onDone();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Refused', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a bank detail change</DialogTitle>
          <DialogDescription>
            This does not change anything yet. Somebody else approves it, a
            cooling period runs, and only then can it be applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Why are the details changing?</Label>
            <Textarea
              className="mt-1"
              placeholder="e.g. Vendor emailed new account details on headed paper; confirmed by phone on the number we already had."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/[0.06] p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-500">
              Confirm the new details on a number you already had for this
              vendor — never one supplied in the request itself. That is how
              this fraud is normally caught.
            </p>
          </div>

          <div className="grid gap-2">
            {FIELDS.map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input
                  className="mt-1 font-mono text-sm"
                  placeholder="leave blank to keep the current value"
                  value={fields[key] ?? ''}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || saving} onClick={submit}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Raise request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
