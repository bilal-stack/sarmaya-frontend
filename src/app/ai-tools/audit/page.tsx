'use client';

/**
 * Audit console — the AI action log, policy decisions and evidence packs.
 *
 * These are the surfaces an auditor actually asks for, and all are
 * restricted to auditors and admins. The page is deliberately read-only apart
 * from sealing a pack, and it never hides a failure: an AI call that returned
 * malformed output or escalated to a human is shown with the same prominence
 * as a successful one, because those are the rows that matter in a review.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, ShieldCheck, Bot, FileArchive, AlertTriangle, CheckCircle2,
  UserCog, Lock, Search, PackagePlus, Scale,
} from 'lucide-react';
import { format } from 'date-fns';

interface AIAction {
  id: string;
  action: string;
  status: string;
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  confidence: number | null;
  latency_ms: number | null;
  input_summary: string | null;
  output_summary: string | null;
  object_type: string | null;
  object_id: string | null;
  created_at: string;
}

interface EvidencePack {
  pack_id: string | null;
  correlation_id: string;
  generated_at: string;
  counts: Record<string, number>;
  all_chains_verified: boolean;
  pack_hash: string;
  content: Record<string, any>;
}

interface PolicyEval {
  id: string;
  policy_key: string;
  policy_id: string | null;
  policy_name: string | null;
  policy_version: number | null;
  inputs: Record<string, any>;
  output: Record<string, any>;
  reasons: string[];
  object_type: string | null;
  object_id: string | null;
  evaluated_by: string | null;
  created_at: string;
}

interface PackRecord {
  id: string;
  correlation_id: string;
  pack_hash: string;
  manifest: Record<string, any>;
  generated_by: string | null;
  created_at: string;
}

/** Status styling. Anything that isn't a clean completion reads as attention. */
const statusTone = (status: string) => {
  switch (status) {
    case 'completed':
      return { tone: 'border-green-500/50 bg-green-500/10 text-green-600', icon: CheckCircle2 };
    case 'hitl_requested':
      return { tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600', icon: UserCog };
    case 'failed_schema':
      return { tone: 'border-orange-500/50 bg-orange-500/10 text-orange-600', icon: AlertTriangle };
    default:
      return { tone: 'border-muted text-muted-foreground', icon: AlertTriangle };
  }
};

const statusLabel = (status: string) =>
  status === 'hitl_requested'
    ? 'sent to a human'
    : status === 'failed_schema'
    ? 'rejected: bad output'
    : status.replace(/_/g, ' ');

function AuditConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [actions, setActions] = useState<AIAction[]>([]);
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [evals, setEvals] = useState<PolicyEval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // Arriving from an invoice's "Evidence pack" link lands here with the chain
  // already chosen, so the auditor never has to copy a UUID by hand.
  const [correlationId, setCorrelationId] = useState(
    () => searchParams.get('correlation_id') ?? ''
  );
  const [preview, setPreview] = useState<EvidencePack | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSealing, setIsSealing] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [actionsRes, packsRes, evalsRes] = await Promise.all([
        apiFetch(`${API_ENDPOINTS.AUDIT.AI_ACTIONS}?limit=100`, {}, user.access_token),
        apiFetch(API_ENDPOINTS.AUDIT.EVIDENCE_PACKS, {}, user.access_token),
        apiFetch(`${API_ENDPOINTS.AUDIT.POLICY_EVALS}?limit=100`, {}, user.access_token),
      ]);
      // Both are auditor/admin-only; a 403 is a legitimate answer, not an error.
      if (actionsRes.status === 403) {
        setDenied(true);
        return;
      }
      if (actionsRes.ok) setActions(await actionsRes.json());
      if (packsRes.ok) setPacks(await packsRes.json());
      if (evalsRes.ok) setEvals(await evalsRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const lookup = async () => {
    if (!user?.access_token || !correlationId.trim()) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUDIT.EVIDENCE_PACK(correlationId.trim()),
        {},
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'No transaction chain with that correlation ID');
      }
      setPreview(await response.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not found', description: error.message });
    } finally {
      setIsPreviewing(false);
    }
  };

  const seal = async () => {
    if (!user?.access_token || !preview) return;
    setIsSealing(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUDIT.EVIDENCE_PACK(preview.correlation_id),
        { method: 'POST' },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not generate the pack');
      }
      const sealed: EvidencePack = await response.json();
      setPreview(sealed);
      toast({
        title: 'Evidence pack sealed',
        description: 'Recorded with its hash. Regenerate later to check nothing has changed.',
      });
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not seal', description: error.message });
    } finally {
      setIsSealing(false);
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
                The audit console is restricted to auditors and administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const needingAttention = actions.filter((a) => a.status !== 'completed').length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Audit console
        </h1>
        <p className="text-muted-foreground mt-1">
          What the AI did, which rule decided each routing, and sealed evidence for any
          transaction chain.
        </p>
      </div>

      <Tabs defaultValue={correlationId ? 'evidence' : 'ai-actions'}>
        <TabsList>
          <TabsTrigger value="ai-actions" className="gap-1.5">
            <Bot className="h-4 w-4" />
            AI actions
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-1.5">
            <Scale className="h-4 w-4" />
            Policy decisions
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            <FileArchive className="h-4 w-4" />
            Evidence packs
          </TabsTrigger>
        </TabsList>

        {/* ---------------- AI action log ---------------- */}
        <TabsContent value="ai-actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI action log</CardTitle>
              <CardDescription>
                Every AI invocation with the provider, model and prompt version behind it.
                {needingAttention > 0 && (
                  <>
                    {' '}
                    <span className="text-foreground font-medium">
                      {needingAttention} did not complete cleanly
                    </span>{' '}
                    — those were escalated to a human or rejected, never acted on.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No AI actions recorded yet.
                </p>
              ) : (
                actions.map((a) => {
                  const { tone, icon: Icon } = statusTone(a.status);
                  return (
                    <div key={a.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {a.action.replace(/_/g, ' ')}
                            </span>
                            <Badge variant="outline" className={`gap-1 text-xs ${tone}`}>
                              <Icon className="h-3 w-3" />
                              {statusLabel(a.status)}
                            </Badge>
                          </div>
                          {a.output_summary && (
                            <p className="text-xs text-muted-foreground mt-1 break-words">
                              {a.output_summary}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(parseApiDate(a.created_at), 'dd MMM, HH:mm')}
                        </span>
                      </div>

                      {/* Provenance — the part that makes the row auditable */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>
                          {a.ai_provider && a.ai_model
                            ? `${a.ai_provider} · ${a.ai_model}`
                            : 'deterministic (no AI call)'}
                        </span>
                        {a.prompt_version && <span>prompt {a.prompt_version}</span>}
                        {a.confidence != null && (
                          <span>confidence {Math.round(a.confidence * 100)}%</span>
                        )}
                        {a.latency_ms != null && a.latency_ms > 0 && (
                          <span>{a.latency_ms} ms</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Policy decisions ---------------- */}
        <TabsContent value="policy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy decisions</CardTitle>
              <CardDescription>
                Each routing decision as it was made — the rule that matched, the version of
                that rule, and the amount it was applied to. Recorded at decision time, so a
                past decision stays explainable after the matrix is edited or rolled back.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {evals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No decisions recorded yet. Submitting or approving an invoice records one.
                </p>
              ) : (
                evals.map((e) => (
                  <div key={e.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {e.policy_name ?? 'Built-in default'}
                          </span>
                          {e.policy_version != null ? (
                            <Badge variant="outline" className="text-xs">
                              version {e.policy_version}
                            </Badge>
                          ) : (
                            // Null means no configured rule matched, so the
                            // hardcoded fallback applied — worth showing plainly.
                            <Badge variant="outline" className="text-xs">
                              unversioned
                            </Badge>
                          )}
                          {e.output?.required_role && (
                            <Badge
                              variant="outline"
                              className="text-xs border-primary/40 bg-primary/10 text-primary"
                            >
                              → {String(e.output.required_role).toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        {e.reasons?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">{e.reasons[0]}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(parseApiDate(e.created_at), 'dd MMM, HH:mm')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {e.inputs?.amount != null && (
                        <span>amount {Number(e.inputs.amount).toLocaleString()}</span>
                      )}
                      {e.object_type && <span>{e.object_type}</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Evidence packs ---------------- */}
        <TabsContent value="evidence" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Build an evidence pack</CardTitle>
              <CardDescription>
                Bundles everything sharing a correlation ID — the objects, the audit trail and
                its integrity check, the policy evaluations, the AI actions and every
                attachment — under one hash.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cid">Correlation ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="cid"
                    placeholder="e.g. 2deec6e0-4db8-44ef-a2d8-b8cb56c9ac2b"
                    value={correlationId}
                    onChange={(e) => setCorrelationId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookup()}
                  />
                  <Button
                    variant="outline"
                    onClick={lookup}
                    disabled={isPreviewing || !correlationId.trim()}
                  >
                    {isPreviewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every invoice carries one. Previewing changes nothing — sealing records the
                  pack and its hash.
                </p>
              </div>

              {preview && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          preview.all_chains_verified
                            ? 'gap-1 border-green-500/50 bg-green-500/10 text-green-600'
                            : 'gap-1 border-destructive/50 bg-destructive/10 text-destructive'
                        }
                      >
                        {preview.all_chains_verified ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {preview.all_chains_verified
                          ? 'Audit chain intact'
                          : 'Chain verification FAILED'}
                      </Badge>
                      {preview.pack_id && (
                        <Badge variant="outline" className="text-xs">
                          sealed
                        </Badge>
                      )}
                    </div>

                    {!preview.all_chains_verified && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-xs text-destructive">
                          The hash chain for this transaction does not verify. The history may
                          have been altered outside the application — investigate before
                          relying on this pack.
                        </p>
                      </div>
                    )}

                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                      {Object.entries(preview.counts).map(([key, value]) => (
                        <div key={key} className="rounded-md border p-2.5">
                          <p className="text-xs text-muted-foreground">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-lg font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Pack hash</p>
                      <p className="text-xs font-mono break-all mt-0.5">{preview.pack_hash}</p>
                    </div>

                    <Button onClick={seal} disabled={isSealing}>
                      {isSealing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PackagePlus className="h-4 w-4 mr-2" />
                      )}
                      Seal this pack
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sealed packs</CardTitle>
              <CardDescription>
                Regenerating a pack and comparing hashes shows whether anything underneath it
                changed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {packs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nothing sealed yet.
                </p>
              ) : (
                packs.map((p) => (
                  <div key={p.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-mono break-all">{p.correlation_id}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseApiDate(p.created_at), 'dd MMM yyyy, HH:mm')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCorrelationId(p.correlation_id);
                          setPreview(null);
                        }}
                      >
                        Load
                      </Button>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground break-all mt-2">
                      {p.pack_hash}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary, otherwise the whole route bails
 * out of static rendering at build time.
 */
export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuditConsole />
    </Suspense>
  );
}
