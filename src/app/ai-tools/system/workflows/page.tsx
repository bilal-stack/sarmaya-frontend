'use client';

/**
 * The state machines, and where they are broken.
 *
 * Ten record types each have a workflow: a list of states, the states each one
 * may move to, and optionally an SLA for sitting in it. All of it has been
 * configurable through the API since it shipped and none of it was reachable —
 * the read endpoint was even mapped in api-config and consumed by nothing.
 *
 * **The thing this screen adds beyond a form.** `update_transitions` checks
 * that every target state exists. It does not check that the graph stays
 * connected. So a non-final state can be left with no way out, and records
 * that reach it stop there — no error, no warning, nothing in any report,
 * because from the machine's point of view the record is simply in a state.
 * The dead-end warning below is computed on the client for exactly that case,
 * and it is why this is a screen rather than a JSON editor.
 *
 * Guards are shown and not editable. They are the permissions required to
 * leave a state, they live in code, and rendering them next to editable
 * fields without saying so would imply a control somebody could relax here.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import type { WorkflowState } from '@/types/dashboards';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Network, AlertTriangle, Clock, Lock, Flag, Play, Save,
} from 'lucide-react';
import { MatchToleranceCard } from '@/components/config/match-tolerance-card';

//: The record types that carry a workflow. Mirrors DEFAULT_WORKFLOWS in
//: app/services/config_defaults.py.
const WORKFLOW_TYPES = [
  'invoice', 'requisition', 'purchase_order', 'rfq', 'payment',
  'inventory_adjustment', 'vendor_return', 'headcount_request',
  'payroll_change_request', 'expense_reimbursement',
] as const;

const label = (s: string) => s.replace(/_/g, ' ');

export default function WorkflowSettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<string>('invoice');
  const [states, setStates] = useState<WorkflowState[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingState, setSavingState] = useState<string | null>(null);
  const [draftSla, setDraftSla] = useState<Record<string, { hours: string; escalate_to: string }>>({});

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    setLoading(true);
    setForbidden(false);
    try {
      const res = await apiFetch(
        API_ENDPOINTS.CONFIG.WORKFLOW_STATES(workflow), {}, user.access_token,
      );
      if (res.status === 403) { setForbidden(true); setStates(null); return; }
      if (!res.ok) throw new Error('Could not load the workflow.');
      const data: WorkflowState[] = await res.json();
      setStates(data.sort((a, b) => a.state_order - b.state_order));
      setDraftSla(Object.fromEntries(data.map((s) => [
        s.state_name,
        {
          hours: s.sla?.hours ? String(s.sla.hours) : '',
          escalate_to: s.sla?.escalate_to ?? '',
        },
      ])));
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not load',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.access_token, workflow, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  async function save(url: string, body: unknown, stateName: string, what: string) {
    if (!user?.access_token) return;
    setSavingState(stateName);
    try {
      const res = await apiFetch(
        url,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        user.access_token,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Could not update ${what}.`);
      }
      toast({ title: `${what} updated`, description: `${label(stateName)} saved.` });
      await load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: `Could not update ${what}`,
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setSavingState(null);
    }
  }

  function toggleTransition(state: WorkflowState, target: string) {
    const next = state.allowed_transitions.includes(target)
      ? state.allowed_transitions.filter((t) => t !== target)
      : [...state.allowed_transitions, target];
    save(
      API_ENDPOINTS.CONFIG.WORKFLOW_TRANSITIONS(workflow, state.state_name),
      { allowed_transitions: next },
      state.state_name,
      'Transitions',
    );
  }

  // A state nothing leads out of, that is not an ending. Records reach it and
  // stop, and nothing else in the system reports that — see the file docstring.
  const deadEnds = (states ?? []).filter(
    (s) => !s.is_final && s.allowed_transitions.length === 0,
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <Network className="h-7 w-7 text-primary" />
          Workflows
        </h1>
        <p className="text-muted-foreground mt-1">
          Which states a record can move to, and how long it may sit in one.
        </p>
      </div>

      {/* The other thing on this page that decides whether a control refuses
          something. Sits above the workflow picker because it applies to every
          workflow rather than to the one selected below. */}
      <div className="mb-6">
        <MatchToleranceCard />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select value={workflow} onValueChange={setWorkflow}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {label(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {forbidden ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Changing a workflow needs workflow.manage. Your role does not have
              it — which is the point: the shape of an approval chain is not
              something every user should be able to redraw.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* The finding, above the form. */}
          {deadEnds.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {deadEnds.length} state{deadEnds.length === 1 ? '' : 's'} with
                  no way out
                </CardTitle>
                <CardDescription>
                  {deadEnds.map((s) => label(s.state_name)).join(', ')} —{' '}
                  {deadEnds.length === 1 ? 'is not an ending and leads' : 'are not endings and lead'}{' '}
                  nowhere. A record that reaches{' '}
                  {deadEnds.length === 1 ? 'it' : 'them'} stops there: nothing
                  errors, nothing is overdue, and no report shows it, because as
                  far as the machine is concerned the record is simply in a
                  state. The API checks that a transition target exists; it does
                  not check that the graph stays connected.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {states?.map((state) => {
            const busy = savingState === state.state_name;
            const stranded = !state.is_final && state.allowed_transitions.length === 0;
            const draft = draftSla[state.state_name] ?? { hours: '', escalate_to: '' };

            return (
              <Card key={state.id} className={stranded ? 'border-destructive/40' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2 capitalize">
                    {state.display_name || label(state.state_name)}
                    {state.is_initial && (
                      <Badge variant="outline" className="font-normal gap-1">
                        <Play className="h-3 w-3" /> start
                      </Badge>
                    )}
                    {state.is_final && (
                      <Badge variant="outline" className="font-normal gap-1">
                        <Flag className="h-3 w-3" /> ending
                      </Badge>
                    )}
                    {stranded && (
                      <Badge
                        variant="outline"
                        className="font-normal gap-1 bg-destructive/10 text-destructive border-destructive/30"
                      >
                        <AlertTriangle className="h-3 w-3" /> no way out
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
                      {state.state_name}
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Can move to
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {states
                        .filter((t) => t.state_name !== state.state_name)
                        .map((target) => {
                          const on = state.allowed_transitions.includes(target.state_name);
                          return (
                            <Button
                              key={target.id}
                              size="sm"
                              variant={on ? 'default' : 'outline'}
                              disabled={busy}
                              onClick={() => toggleTransition(state, target.state_name)}
                              className="capitalize"
                            >
                              {label(target.state_name)}
                            </Button>
                          );
                        })}
                      {state.is_final && state.allowed_transitions.length === 0 && (
                        <span className="text-xs text-muted-foreground self-center">
                          Nothing — this is where records finish.
                        </span>
                      )}
                    </div>
                  </div>

                  {Object.keys(state.guards || {}).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5" />
                          Guards — set in code, not here
                        </p>
                        <div className="space-y-1">
                          {Object.entries(state.guards).map(([target, perms]) => (
                            <p key={target} className="text-xs text-muted-foreground">
                              <span className="capitalize">{label(target)}</span>
                              {' needs '}
                              <span className="font-mono">{perms.join(', ')}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      How long a record may sit here
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`h-${state.id}`}>
                          Hours
                        </label>
                        <Input
                          id={`h-${state.id}`}
                          className="w-28"
                          inputMode="numeric"
                          placeholder="none"
                          value={draft.hours}
                          onChange={(e) => setDraftSla((d) => ({
                            ...d,
                            [state.state_name]: { ...draft, hours: e.target.value },
                          }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`e-${state.id}`}>
                          Escalate to
                        </label>
                        <Input
                          id={`e-${state.id}`}
                          className="w-40"
                          placeholder="nobody"
                          value={draft.escalate_to}
                          onChange={(e) => setDraftSla((d) => ({
                            ...d,
                            [state.state_name]: { ...draft, escalate_to: e.target.value },
                          }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => save(
                          API_ENDPOINTS.CONFIG.WORKFLOW_SLA(workflow, state.state_name),
                          {
                            hours: draft.hours.trim() ? Number(draft.hours) : null,
                            escalate_to: draft.escalate_to.trim() || null,
                          },
                          state.state_name,
                          'SLA',
                        )}
                      >
                        {busy
                          ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          : <Save className="mr-2 h-3.5 w-3.5" />}
                        Save
                      </Button>
                    </div>
                    {/* The backend rejects the combination rather than guessing,
                        so say which way round it works before somebody tries. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      Hours on their own mark a record overdue. Escalating needs
                      hours as well — there is no point escalating at a deadline
                      nobody set. Clear both to remove the SLA.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {states?.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No states configured for this workflow yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
