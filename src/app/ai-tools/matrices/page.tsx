'use client';

/**
 * The control matrices: approval routing and segregation of duties as grids.
 *
 * Build Book, Global Matrices. The rules on this page already exist and are
 * already enforced — nothing here is a new control, and nothing here decides
 * anything. The reason to draw them is that a list answers "what rules exist"
 * and a grid answers "what is not covered", and only the second question finds
 * an amount band nobody configured or a role holding both halves of a
 * separation.
 *
 * So the findings come first and the grids come second. A page that opened
 * with a tidy table of rules would read as reassurance; the useful content is
 * the three or four rows where something is missing, and those have to be the
 * first thing on screen rather than something you notice by scanning.
 *
 * Both panels read with audit.view rather than the dashboard permission, so
 * ordinary roles get a 403 — stated as a fact, not offered a retry button.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Panel, Empty, money } from '@/components/reports/panel';
import type { ApprovalMatrix, SodMatrix, Barrier } from '@/types/dashboards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, RefreshCw, Grid3x3, ShieldAlert, AlertTriangle, CheckCircle2,
  CircleSlash, Lock,
} from 'lucide-react';

const FORBIDDEN =
  'These describe the shape of the controls rather than any record, so they '
  + 'read with audit.view. Your role does not have it.';

/** Weakest barrier, worst first. The label is the finding, not the category. */
const BARRIER: Record<Barrier, { label: string; className: string; icon: React.ReactNode }> = {
  none: {
    label: 'Waived for an admin',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  runtime_check: {
    label: 'Rests on the runtime check',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  permissions: {
    label: 'Separated by permissions',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: <Lock className="h-3 w-3" />,
  },
};

export default function MatricesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  const approval = usePanel<ApprovalMatrix>(API_ENDPOINTS.MATRICES.APPROVAL, reloadKey);
  const sod = usePanel<SodMatrix>(API_ENDPOINTS.MATRICES.SOD, reloadKey);
  const anyLoading = approval.loading || sod.loading;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (!authLoading && !user) return null;

  const a = approval.data;
  const s = sod.data;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Grid3x3 className="h-7 w-7 text-primary" />
            Control matrices
          </h1>
          <p className="text-muted-foreground mt-1">
            The approval and segregation rules as grids, so the gaps show.
            Everything here is already enforced — this page changes nothing.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={anyLoading}
        >
          {anyLoading
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* --- Findings first. --------------------------------------------- */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            What the grids show that a list would not
          </CardTitle>
          <CardDescription>
            Each of these is a rule doing less than it appears to. None is
            necessarily a bug — but each is a decision somebody should have
            made deliberately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Finding
            count={a?.gaps.length ?? 0}
            loading={approval.loading}
            forbidden={approval.status === 403}
            title="Amount bands no rule covers"
            body={
              'Routing does not fail there — it falls through to a split '
              + 'written in code. That is a real approval decision, made by '
              + 'nobody, and invisible on the policy screen.'
            }
          />
          <Finding
            count={a?.unreachable_rules.length ?? 0}
            loading={approval.loading}
            forbidden={approval.status === 403}
            title="Rules that can never fire"
            body={
              'Active, configured, and decides nothing: a higher-priority rule '
              + 'always matches first. Somebody wrote a control and it does '
              + 'not run.'
            }
            detail={a?.unreachable_rules.join(', ')}
          />
          <Finding
            count={s?.unblocked_for_admin.length ?? 0}
            loading={sod.loading}
            forbidden={sod.status === 403}
            title="Separations an admin can simply perform"
            body={
              'Admin holds every permission, and these rules additionally '
              + 'decline to fire on an admin — so one person can do both halves '
              + 'with nothing in the way. Deliberate (a one-person tenant has '
              + 'to function) and bounded, but worth seeing stated.'
            }
            detail={s?.unblocked_for_admin.join(', ')}
          />
          <Finding
            count={s?.depends_on_the_runtime_check.length ?? 0}
            loading={sod.loading}
            forbidden={sod.status === 403}
            title="Separations resting on the runtime check alone"
            body={
              'An ordinary role holds both permissions, so the check is the '
              + 'entire separation — it has to fire on every path that reaches '
              + 'the action. Where no role holds both, the permission model '
              + 'separates them whether the check fires or not.'
            }
            detail={s?.depends_on_the_runtime_check
              .map((r) => `${r.rule} (${r.roles.join(', ')})`)
              .join('; ')}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* --- Approval matrix ------------------------------------------- */}
        <Panel
          icon={<Grid3x3 className="h-4 w-4 text-primary" />}
          title="Approval routing"
          description="Which role must approve, at which amount."
          state={approval}
          forbiddenNote={FORBIDDEN}
        >
          {!a || a.bands.length === 0 ? (
            <Empty>No approval rules configured.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Approver</th>
                      <th className="py-2 font-medium">Decided by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.bands.map((band) => (
                      <tr key={band.amount} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {money(band.amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {band.required_role ? (
                            <Badge variant="secondary" className="font-normal">
                              {band.required_role}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-normal bg-destructive/10 text-destructive border-destructive/30"
                            >
                              nothing matches
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {band.decided_by ?? (
                            <span className="text-destructive">
                              falls back to code
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* The rules themselves, second — they are the input, not the
                  finding. */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Rules, in the order they are evaluated
                </p>
                <ul className="space-y-1.5">
                  {a.rules.map((rule) => {
                    const dead = a.unreachable_rules.includes(rule.policy_name);
                    return (
                      <li
                        key={rule.policy_name}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        {dead ? (
                          <CircleSlash className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className={dead ? 'line-through text-muted-foreground' : ''}>
                          {rule.policy_name}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {rule.operator} {money(rule.threshold)} &rarr; {rule.required_role}
                        </span>
                        {dead && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal bg-destructive/10 text-destructive border-destructive/30"
                          >
                            never fires
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Stated rather than quietly omitted: drawing two axes where
                  the Build Book asks for three would read as though the third
                  had been considered. */}
              <p className="text-xs text-muted-foreground">
                No category axis. The Build Book asks for role &times; amount
                &times; category, and the rule configuration carries no
                category &mdash; so that dimension does not exist in the rules
                and is not drawn here.
              </p>
            </div>
          )}
        </Panel>

        {/* --- SoD matrix ------------------------------------------------- */}
        <Panel
          icon={<ShieldAlert className="h-4 w-4 text-primary" />}
          title="Segregation of duties"
          description="Every separation, and how much actually stands in the way of each."
          state={sod}
          forbiddenNote={FORBIDDEN}
        >
          {!s || s.rules.length === 0 ? (
            <Empty>No separations defined.</Empty>
          ) : (
            <div className="space-y-4">
              {s.admin_holds_every_permission && (
                <p className="text-xs text-muted-foreground">
                  Admin holds every permission, so it appears in both halves of
                  all {s.rules.length} rows. Stated once here rather than
                  repeated below, where it would bury the rows an ordinary role
                  can reach.
                </p>
              )}

              <div className="space-y-2">
                {s.rules.map((row) => {
                  const barrier = BARRIER[row.weakest_barrier];
                  return (
                    <div key={row.rule} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{row.control}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {row.first_action} &rarr; {row.second_action}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`font-normal shrink-0 gap-1 ${barrier.className}`}
                        >
                          {barrier.icon}
                          {barrier.label}
                        </Badge>
                      </div>

                      {/* Each list is labelled with what applies to those
                          roles specifically. An earlier version showed one
                          row-level badge above a bare "holds both" list, so a
                          rule waived for an admin and resting on the check for
                          a manager read as though nothing stopped the manager
                          either. It does — just not the admin. */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {row.roles_with_no_barrier.length > 0 && (
                          <span>
                            Nothing prevents it for:{' '}
                            <span className="text-destructive font-medium">
                              {row.roles_with_no_barrier.join(', ')}
                            </span>
                          </span>
                        )}
                        {row.ordinary_roles_holding_both.length > 0 && (
                          <span>
                            Check is the only barrier for:{' '}
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              {row.ordinary_roles_holding_both.join(', ')}
                            </span>
                          </span>
                        )}
                        {row.first_permission === null && (
                          <span>
                            First half is an identity, not a permission
                          </span>
                        )}
                        <span className="font-mono">{row.enforced_at}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** One finding. Zero is a result worth showing, not a row worth hiding. */
function Finding({
  count, title, body, detail, loading, forbidden,
}: {
  count: number;
  title: string;
  body: string;
  detail?: string;
  loading: boolean;
  forbidden: boolean;
}) {
  if (forbidden) return null;
  const clean = !loading && count === 0;
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : clean ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            {count}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
        {detail && !clean && (
          <p className="text-xs text-muted-foreground mt-1 font-mono break-words">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
