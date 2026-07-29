'use client';

/**
 * Live Audit Mode: an object's full history as a timeline, each event carrying
 * a plain-English reason, plus the tamper-evidence check on the hash chain.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { AuditTimeline, AuditChainVerification } from '@/types/governance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ShieldCheck, ShieldAlert, Sparkles, Scale, History,
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  objectType?: string;
  objectId: string;
}

export function AuditTimelineView({ objectType = 'invoice', objectId }: Props) {
  const { user } = useAuth();
  const [timeline, setTimeline] = useState<AuditTimeline | null>(null);
  const [verification, setVerification] = useState<AuditChainVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUDIT.TIMELINE(objectType, objectId),
        {},
        user.access_token
      );
      if (response.ok) setTimeline(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [objectType, objectId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async () => {
    if (!user?.access_token) return;
    setIsVerifying(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUDIT.VERIFY(objectType, objectId),
        {},
        user.access_token
      );
      if (response.ok) setVerification(await response.json());
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading audit trail…
      </div>
    );
  }
  if (!timeline) return null;

  return (
    <div className="space-y-4">
      {/* Policy reason — snapshotted at decision time, so it never drifts. */}
      {timeline.policy_reason && (
        <Card className="border-blue-500/30 bg-blue-500/[0.04]">
          <CardContent className="flex items-start gap-2 py-4">
            <Scale className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Policy applied</p>
              <p className="text-sm text-muted-foreground mt-0.5">{timeline.policy_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Audit trail
              </CardTitle>
              <CardDescription>
                {timeline.total_events} event{timeline.total_events === 1 ? '' : 's'}, oldest first
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={verify} disabled={isVerifying}>
              {isVerifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Verify integrity
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {verification && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 mb-4 ${
                verification.verified
                  ? 'border-green-500/40 bg-green-500/10'
                  : 'border-red-500/40 bg-red-500/10'
              }`}
            >
              {verification.verified ? (
                <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    verification.verified ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {verification.verified
                    ? 'Trail intact — no tampering detected'
                    : `Integrity check failed at event ${(verification.broken_at_index ?? 0) + 1}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {verification.detail ??
                    'Each entry is hash-chained to the one before it, so an edited or deleted event is detectable.'}
                </p>
              </div>
            </div>
          )}

          {timeline.events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No events recorded yet.</p>
          ) : (
            <ol className="relative border-l border-border ml-2">
              {timeline.events.map((event, index) => (
                <li key={`${event.timestamp}-${index}`} className="ml-5 pb-5 last:pb-0">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{event.summary}</p>
                    {event.ai_assisted && (
                      <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI
                        {event.ai_confidence != null && ` ${event.ai_confidence}%`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseApiDate(event.timestamp), 'dd MMM yyyy, HH:mm')}
                    {event.actor && ` · ${event.actor}`}
                    {event.actor_role && ` (${event.actor_role})`}
                  </p>
                  {event.comment && (
                    <p className="text-xs text-muted-foreground mt-1 italic">“{event.comment}”</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
