'use client';

/**
 * "Suggested next step" card for an invoice.
 *
 * Integration rules this component deliberately enforces:
 *
 *  1. It is SUGGESTION-ONLY. It never calls a mutating endpoint. It renders a
 *     button and emits `onAction`; the parent page owns every state change, so
 *     permissions, confirmations and toasts stay in one place.
 *  2. The action is a closed enum. Anything unrecognised renders as advice with
 *     no button rather than a broken control.
 *  3. It loads with `use_ai=false` — instant, no token cost. The AI explanation
 *     is opt-in per invoice, because `use_ai=true` costs seconds of latency and
 *     real money, and must never fire from a list view.
 *  4. `signals` is the explainability trace and is shown, not hidden.
 *  5. Approve is disabled when the user is not the required role, or when the
 *     backend reports a segregation-of-duties conflict.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { NextAction, NextActionSuggestion } from '@/types/governance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2, Lightbulb, ChevronDown, Sparkles, ShieldAlert, Info,
} from 'lucide-react';

/** Label + whether the parent can act on it from here. */
const ACTION_META: Record<NextAction, { label: string; cta: string | null }> = {
  review_extraction:  { label: 'Review the extracted fields', cta: 'Review fields' },
  fix_missing_fields: { label: 'Fill in the missing fields',  cta: 'Edit invoice' },
  validate:           { label: 'Validate this invoice',       cta: 'Validate' },
  submit_for_approval:{ label: 'Submit for approval',         cta: 'Submit' },
  resolve_duplicate:  { label: 'Resolve the duplicate flag',  cta: 'Review duplicate' },
  verify_vendor:      { label: 'Verify the vendor',           cta: 'Open vendor' },
  approve:            { label: 'Approve or reject',           cta: 'Approve' },
  mark_paid:          { label: 'Mark as paid',                cta: 'Mark paid' },
  revise:             { label: 'Revise and resubmit',         cta: 'Edit invoice' },
  none:               { label: 'No action needed',            cta: null },
};

interface Props {
  invoiceId: string;
  /** Parent performs the state change; this card never mutates. */
  onAction?: (action: NextAction) => void;
  /** Disable the CTA while the parent is mid-request. */
  isBusy?: boolean;
}

export function NextActionCard({ invoiceId, onAction, isBusy }: Props) {
  const { user } = useAuth();
  const [suggestion, setSuggestion] = useState<NextActionSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (useAi: boolean) => {
      if (!user?.access_token) return;
      useAi ? setIsEnriching(true) : setIsLoading(true);
      setError(null);
      try {
        const response = await apiFetch(
          `${API_ENDPOINTS.AGENT.NEXT_ACTION(invoiceId)}?use_ai=${useAi}`,
          {},
          user.access_token
        );
        if (!response.ok) throw new Error('Could not load a suggestion');
        setSuggestion(await response.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
        setIsEnriching(false);
      }
    },
    [invoiceId, user]
  );

  // Rules-only on mount: instant and free. AI is opt-in below.
  useEffect(() => {
    load(false);
  }, [load]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Working out the next step…
        </CardContent>
      </Card>
    );
  }

  // Never block the page on a failed suggestion — it is advisory.
  if (error || !suggestion) return null;

  const meta = ACTION_META[suggestion.action];
  if (!meta) return null; // unknown action from a newer backend: stay silent

  const sodConflict = suggestion.signals.some((s) => s.startsWith('sod='));
  const wrongRole =
    suggestion.action === 'approve' &&
    !!suggestion.required_role &&
    user?.role?.toLowerCase() !== suggestion.required_role.toLowerCase() &&
    user?.role?.toLowerCase() !== 'admin';
  const ctaBlocked = sodConflict || wrongRole;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Suggested next step
          {suggestion.source === 'ai' && (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <Sparkles className="h-3 w-3" />
              AI
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">{meta.label}</p>
          <p className="text-sm text-muted-foreground mt-1">{suggestion.reasoning}</p>
        </div>

        {ctaBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-2.5">
            <ShieldAlert className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-600">
              {sodConflict
                ? 'You created this invoice, so segregation of duties prevents you from approving it.'
                : `This invoice needs ${suggestion.required_role?.toUpperCase()} approval.`}
            </p>
          </div>
        )}

        {/* Explainability trace — the Build Book's "Why?" panel. */}
        {suggestion.signals.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3 w-3" />
              Why this suggestion?
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ul className="space-y-1">
                {suggestion.signals.map((signal) => (
                  <li key={signal} className="text-xs text-muted-foreground font-mono">
                    · {signal}
                  </li>
                ))}
              </ul>
              {suggestion.source === 'ai' && suggestion.ai_model && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Explained by {suggestion.ai_model} ({suggestion.prompt_version}), confidence{' '}
                  {(suggestion.confidence * 100).toFixed(0)}%. Policy — not the model — chose the
                  action.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {meta.cta && onAction && (
            <Button size="sm" disabled={ctaBlocked || isBusy} onClick={() => onAction(suggestion.action)}>
              {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {meta.cta}
            </Button>
          )}
          {suggestion.source !== 'ai' && (
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={isEnriching}>
              {isEnriching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Explain with AI
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
