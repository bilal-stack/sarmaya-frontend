'use client';

/**
 * Approval matrix + Policy Simulator.
 *
 * The simulator is the reason this page matters: it answers "what would this
 * threshold change have done to last quarter?" before anyone commits to it.
 * It is read-only on the server, and the UI says so plainly — a user must be
 * able to press Simulate without fearing they've changed anything.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Scale, FlaskConical, ArrowRight, Info, TrendingUp, TrendingDown,
} from 'lucide-react';

interface Policy {
  id: string;
  policy_name: string;
  rule_config: { amount_threshold: number; operator: string; required_role: string };
  priority: number;
  is_active: boolean;
}

interface SimulationChange {
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  from_role: string;
  to_role: string;
  new_reason: string;
}

interface SimulationResult {
  window_days: number;
  invoices_evaluated: number;
  routing_before: { counts: Record<string, number>; value: Record<string, number> };
  routing_after: { counts: Record<string, number>; value: Record<string, number> };
  changed_count: number;
  changed_value: number;
  net_by_role: Record<string, number>;
  changes: SimulationChange[];
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function PoliciesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [threshold, setThreshold] = useState<number>(250000);
  const [windowDays, setWindowDays] = useState<number>(90);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.CONFIG.APPROVAL_POLICIES,
        {},
        user.access_token
      );
      if (response.ok) {
        const data: Policy[] = await response.json();
        setPolicies(data);
        // Seed the simulator from the highest-priority live rule so the user
        // starts from reality and edits one number.
        const top = [...data].sort((a, b) => b.priority - a.priority)[0];
        if (top?.rule_config?.amount_threshold != null) {
          setThreshold(top.rule_config.amount_threshold);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const simulate = async () => {
    if (!user?.access_token) return;
    setIsSimulating(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.CONFIG.SIMULATE,
        {
          method: 'POST',
          body: JSON.stringify({
            window_days: windowDays,
            // A complete matrix: without a catch-all the backend falls through
            // to its built-in default split, which would confuse the result.
            proposed_rules: [
              {
                policy_name: `CFO above ${threshold}`,
                priority: 100,
                rule: {
                  amount_threshold: threshold,
                  operator: 'greater_than',
                  required_role: 'cfo',
                },
              },
              {
                policy_name: 'Manager otherwise',
                priority: 0,
                rule: {
                  amount_threshold: 0,
                  operator: 'greater_equal',
                  required_role: 'manager',
                },
              },
            ],
          }),
        },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Simulation failed');
      }
      setResult(await response.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Simulation failed', description: error.message });
    } finally {
      setIsSimulating(false);
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <Scale className="h-7 w-7 text-primary" />
          Approval matrix
        </h1>
        <p className="text-muted-foreground mt-1">
          The rules that decide who must approve an invoice — and a simulator to test a change
          before it goes live.
        </p>
      </div>

      {/* Live rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live rules</CardTitle>
          <CardDescription>Highest priority wins. Every edit is versioned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {policies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No rules configured — the built-in default split applies.
            </p>
          ) : (
            [...policies]
              .sort((a, b) => b.priority - a.priority)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{p.policy_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      amount {p.rule_config.operator.replace(/_/g, ' ')}{' '}
                      {fmt(p.rule_config.amount_threshold)} →{' '}
                      {p.rule_config.required_role.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">priority {p.priority}</Badge>
                    {!p.is_active && <Badge variant="outline">inactive</Badge>}
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      {/* Simulator */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Policy simulator
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Replays a proposed threshold over past invoices. Nothing is saved and no live rule
            changes — it is safe to run as often as you like.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold">CFO approval above</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window">Look back (days)</Label>
              <Input
                id="window"
                type="number"
                min={1}
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
              />
            </div>
          </div>

          <Button onClick={simulate} disabled={isSimulating}>
            {isSimulating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4 mr-2" />
            )}
            Simulate
          </Button>

          {result && (
            <>
              <Separator />
              <div>
                <p className="text-sm">
                  Across{' '}
                  <span className="font-semibold">{result.invoices_evaluated}</span> invoice(s) in
                  the last {result.window_days} days,{' '}
                  <span className="font-semibold">{result.changed_count}</span> would route
                  differently
                  {result.changed_value > 0 && (
                    <>
                      , shifting{' '}
                      <span className="font-semibold">{fmt(result.changed_value)}</span> of value
                    </>
                  )}
                  .
                </p>

                {result.changed_count === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    This threshold produces the same routing as today.
                  </p>
                )}
              </div>

              {/* Net movement per role */}
              {Object.keys(result.net_by_role).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(result.net_by_role).map(([role, net]) => (
                    <div key={role} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{role.toUpperCase()}</p>
                      <p className="text-sm font-medium mt-0.5 flex items-center gap-1.5">
                        {result.routing_before.counts[role] ?? 0}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {result.routing_after.counts[role] ?? 0}
                        {net !== 0 && (
                          <span
                            className={`text-xs flex items-center gap-0.5 ${
                              net > 0 ? 'text-orange-500' : 'text-green-600'
                            }`}
                          >
                            {net > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {net > 0 ? `+${net}` : net}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fmt(result.routing_before.value[role] ?? 0)} →{' '}
                        {fmt(result.routing_after.value[role] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {result.changes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Invoices that would move</p>
                  {result.changes.slice(0, 10).map((c) => (
                    <div
                      key={c.invoice_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm">{c.invoice_number ?? 'Invoice'}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.from_role.toUpperCase()} → {c.to_role.toUpperCase()}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{fmt(c.amount)}</span>
                    </div>
                  ))}
                  {result.changes.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      …and {result.changes.length - 10} more.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
