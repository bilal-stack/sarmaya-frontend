'use client';

/**
 * HR — people, hires, onboarding and claims.
 *
 * Two things about this screen are deliberate and worth knowing before
 * changing it.
 *
 * **It shows what the server sent, and never reconstructs a salary.** Pay,
 * national IDs and bank details arrive masked unless the viewer holds
 * `hr.view_compensation`. The keys are present either way, so nothing here has
 * to branch — but nothing here should ever compute a figure from a masked one
 * either, because that would put back exactly what the masking removed.
 *
 * **The outstanding-access panel is the one with teeth.** Everything else here
 * is administration; that panel answers "who has left and can still sign in",
 * which is a question an auditor asks directly and nothing else in the product
 * would surface.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { usePanel } from '@/hooks/use-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, UserPlus, ClipboardList, Receipt, Wallet, RefreshCw, ShieldAlert,
  TriangleAlert, CheckCircle2, Lock,
} from 'lucide-react';

interface EmployeeRow {
  id: string;
  employee_number: string;
  full_name: string;
  job_title: string;
  status: string;
  employment_type: string;
  has_login: boolean;
  base_salary: number | string | null;
  national_id: string | null;
  compensation_visible: boolean;
  is_sensitive_role: boolean;
  background_check_cleared: boolean;
}

interface HeadcountRow {
  id: string;
  request_number: string;
  job_title: string;
  positions: number;
  total_amount: number;
  current_state: string;
  is_sensitive_role: boolean;
  created_by: string;
}

interface PayrollRow {
  id: string;
  request_number: string;
  reason_code: string;
  change_amount: number;
  current_state: string;
  effective_date: string;
  created_by: string;
  compensation_visible: boolean;
  new_salary: number | null;
}

interface ExpenseRow {
  id: string;
  claim_number: string;
  category: string;
  total_amount: number;
  current_state: string;
  has_receipt: boolean;
  receipt_required: boolean;
  policy_override_reason: string | null;
  created_by: string;
}

interface AccessRow {
  task_id: string;
  employee_number: string;
  full_name: string;
  title: string;
  owning_team: string | null;
  days_overdue: number;
  employment_ended: boolean;
  still_has_login: boolean;
}

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pretty = (s: string) => s.replace(/_/g, ' ');

function stateBadge(state: string) {
  if (['approved', 'filled', 'applied', 'paid'].includes(state)) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  }
  if (state === 'pending_approval') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
  }
  if (['rejected', 'cancelled'].includes(state)) {
    return 'bg-destructive/10 text-destructive border-destructive/30';
  }
  return '';
}

export default function HrPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const employees = usePanel<EmployeeRow[]>(API_ENDPOINTS.HR.EMPLOYEES, reloadKey);
  const headcount = usePanel<HeadcountRow[]>(API_ENDPOINTS.HR.HEADCOUNT, reloadKey);
  const payroll = usePanel<PayrollRow[]>(API_ENDPOINTS.HR.PAYROLL_CHANGES, reloadKey);
  const expenses = usePanel<ExpenseRow[]>(API_ENDPOINTS.HR.EXPENSES, reloadKey);
  const access = usePanel<AccessRow[]>(API_ENDPOINTS.HR.OUTSTANDING_ACCESS, reloadKey);
  const plan = usePanel<{
    employees_on_the_books: number;
    approved_not_yet_filled: number;
    committed_annual_cost: number;
  }>(API_ENDPOINTS.HR.HEADCOUNT_PLAN, reloadKey);

  const forbidden = employees.status === 403;
  const staff = employees.data ?? [];
  const stillHaveAccess = (access.data ?? []).filter((r) => r.employment_ended);
  const compensationHidden = staff.length > 0 && !staff[0].compensation_visible;

  async function act(url: string, body?: unknown, successTitle = 'Done') {
    if (!user?.access_token) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', body: JSON.stringify(body ?? {}) },
        user.access_token,
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(
          typeof detail.detail === 'string' ? detail.detail : 'That did not work',
        );
      }
      toast({ title: successTitle });
      setReloadKey((k) => k + 1);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Refused', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            People
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Who works here, who is joining, and what is waiting on a signature.
            An employee is a person the company employs — not an account, which
            is why most of them have no login.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={employees.loading}
        >
          <RefreshCw className={`h-4 w-4 ${employees.loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {forbidden && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Your role cannot view HR records.</AlertDescription>
        </Alert>
      )}

      {/* The panel that matters. Somebody who has left and can still sign in is
          a live access problem, not an administrative loose end. */}
      {stillHaveAccess.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            {stillHaveAccess.length} {stillHaveAccess.length === 1 ? 'person has' : 'people have'}
            {' '}left with access still open
            {stillHaveAccess.some((r) => r.still_has_login)
              && ' — and at least one still has a login'}.
          </AlertDescription>
        </Alert>
      )}

      {!forbidden && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">On the books</p>
              {plan.loading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                <p className="text-2xl font-semibold">
                  {plan.data?.employees_on_the_books ?? 0}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Approved, not yet filled</p>
              {plan.loading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                <p className="text-2xl font-semibold">
                  {plan.data?.approved_not_yet_filled ?? 0}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Committed annual cost</p>
              {plan.loading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                <p className="text-2xl font-semibold">
                  {money(plan.data?.committed_annual_cost ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!forbidden && (
        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people" className="gap-1.5">
              <Users className="h-4 w-4" /> People
            </TabsTrigger>
            <TabsTrigger value="headcount" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Hiring
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-1.5">
              <Wallet className="h-4 w-4" /> Pay changes
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-1.5">
              <Receipt className="h-4 w-4" /> Expenses
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Access
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">The staff list</CardTitle>
                <CardDescription>
                  {compensationHidden ? (
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Pay and identifiers are hidden from your role.
                    </span>
                  ) : (
                    'Everyone currently employed.'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {employees.loading && <Skeleton className="h-24 w-full" />}
                {!employees.loading && staff.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nobody on the books yet.
                  </p>
                )}
                {staff.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {person.full_name}
                        <span className="text-muted-foreground">
                          {' '}— {person.job_title}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{person.employee_number}</span>
                        {' · '}{pretty(person.employment_type)}
                        {!person.has_login && ' · no login'}
                        {person.is_sensitive_role && (
                          person.background_check_cleared
                            ? ' · vetted'
                            : ' · vetting outstanding'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Rendered exactly as the server sent it. When masked
                          this is the string "restricted", never a number. */}
                      <span className="text-sm font-medium tabular-nums">
                        {typeof person.base_salary === 'number'
                          ? money(person.base_salary)
                          : <span className="text-muted-foreground italic">restricted</span>}
                      </span>
                      <Badge variant="outline" className={stateBadge(person.status)}>
                        {pretty(person.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="headcount" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hiring requests</CardTitle>
                <CardDescription>
                  A hire is agreed once and paid for years, so a request states
                  what it costs before anybody approves it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {headcount.loading && <Skeleton className="h-24 w-full" />}
                {(headcount.data ?? []).map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{request.request_number}</span>
                        <span className="text-muted-foreground">
                          {' '}— {request.job_title} × {request.positions}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(request.total_amount)} a year
                        {request.is_sensitive_role && ' · sensitive role'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={stateBadge(request.current_state)}>
                        {pretty(request.current_state)}
                      </Badge>
                      {request.current_state === 'pending_approval'
                        && request.created_by !== user?.id && (
                        <Button
                          size="sm" disabled={saving}
                          onClick={() => act(
                            API_ENDPOINTS.HR.HEADCOUNT_ACTION(request.id, 'approve'),
                            {}, 'Approved',
                          )}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!headcount.loading && (headcount.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No hiring requests.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pay changes</CardTitle>
                <CardDescription>
                  The size of each change is shown to everyone who can approve
                  it — an approver has to know whether they are signing 2% or
                  40%. The salaries themselves stay behind the permission.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {payroll.loading && <Skeleton className="h-24 w-full" />}
                {(payroll.data ?? []).map((change) => (
                  <div
                    key={change.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{change.request_number}</span>
                        <span className="text-muted-foreground">
                          {' '}— {pretty(change.reason_code)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(change.change_amount)} change
                        {change.new_salary !== null && ` · to ${money(change.new_salary)}`}
                        {' · effective '}{change.effective_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={stateBadge(change.current_state)}>
                        {pretty(change.current_state)}
                      </Badge>
                      {change.current_state === 'pending_approval'
                        && change.created_by !== user?.id && (
                        <Button
                          size="sm" disabled={saving}
                          onClick={() => act(
                            API_ENDPOINTS.HR.PAYROLL_ACTION(change.id, 'approve'),
                            {}, 'Approved and applied',
                          )}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!payroll.loading && (payroll.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No pay changes.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Expense claims</CardTitle>
                <CardDescription>
                  An employee&apos;s own money that the company is holding. A
                  claim needing a receipt cannot be submitted without one.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {expenses.loading && <Skeleton className="h-24 w-full" />}
                {(expenses.data ?? []).map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{claim.claim_number}</span>
                        <span className="text-muted-foreground">
                          {' '}— {claim.category}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(claim.total_amount)}
                        {claim.receipt_required && !claim.has_receipt && ' · receipt needed'}
                        {claim.policy_override_reason && ' · rule waived'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={stateBadge(claim.current_state)}>
                        {pretty(claim.current_state)}
                      </Badge>
                      {claim.current_state === 'pending_approval'
                        && claim.created_by !== user?.id && (
                        <Button
                          size="sm" disabled={saving}
                          onClick={() => act(
                            API_ENDPOINTS.HR.EXPENSE_APPROVE(claim.id), {}, 'Approved',
                          )}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!expenses.loading && (expenses.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No claims.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Outstanding access</CardTitle>
                <CardDescription>
                  Account and access tasks still open on people who are leaving
                  or have left. This is the half of the checklist with teeth —
                  an unfinished offboarding task is somebody who can still sign
                  in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {access.loading && <Skeleton className="h-24 w-full" />}
                {(access.data ?? []).map((row) => (
                  <div
                    key={row.task_id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                      row.employment_ended ? 'border-destructive/40' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {row.full_name}
                        <span className="text-muted-foreground"> — {row.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{row.employee_number}</span>
                        {row.owning_team && ` · ${row.owning_team}`}
                        {row.days_overdue > 0 && ` · ${row.days_overdue} days overdue`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.employment_ended && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          {row.still_has_login ? 'left, still has a login' : 'left'}
                        </Badge>
                      )}
                      <Button
                        size="sm" variant="outline" disabled={saving}
                        onClick={() => act(
                          API_ENDPOINTS.HR.TASK_STATUS(row.task_id),
                          { status: 'done' }, 'Marked done',
                        )}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ))}
                {!access.loading && (access.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nothing outstanding. Nobody who has left still holds access.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
