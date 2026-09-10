'use client';

/**
 * Overriding the duplicate gate, with a reason.
 *
 * The gate is soft by design: `approve_invoice` refuses while an invoice
 * carries `potential_duplicate_id` and no acknowledgement, and the only way
 * past is `resolve-duplicate`, which records a reason on the audit trail. That
 * endpoint had no UI, so a flagged invoice could not be approved and could not
 * be released — it simply stopped, with the approve button reporting a refusal
 * the screen offered no way to answer.
 *
 * The reason is required by the backend and required here, and the dialog says
 * what it is for rather than treating it as a formality. It is the thing an
 * auditor reads when they ask why two invoices for the same amount were both
 * paid, so "duplicate ok" is a worse answer than the field being empty would
 * have been.
 */

import { useState } from 'react';
import { Loader2, CopyCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function ResolveDuplicateDialog({
  invoiceId, invoiceNumber, open, onOpenChange, onResolved,
}: {
  invoiceId: string;
  invoiceNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user?.access_token) return;
    setBusy(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.RESOLVE_DUPLICATE(invoiceId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() }),
        },
        user.access_token,
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not record the override.');
      }
      toast({
        title: 'Duplicate flag overridden',
        description: 'The reason is on the audit trail. The invoice can now be approved.',
      });
      setReason('');
      onOpenChange(false);
      onResolved();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not override',
        description:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyCheck className="h-4 w-4" />
            Override the duplicate flag
          </DialogTitle>
          <DialogDescription>
            {invoiceNumber ? `${invoiceNumber} ` : 'This invoice '}
            matches another closely enough that approval is being held. Say why
            it should go through anyway.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            {/* Worth saying plainly. The reason is the entire record of this
                decision — nothing else on the invoice will explain why the
                control was waived. */}
            This goes on the audit trail against your name, and it is what an
            auditor reads when they ask why two similar invoices were both
            paid. Write the reason, not the word.
          </p>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Second delivery on the same PO, invoiced separately by the vendor."
            rows={3}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !reason.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record and unblock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
