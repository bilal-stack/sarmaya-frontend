'use client';

/**
 * People and what they may do.
 *
 * The counterpart to self-registration being closed: accounts here are granted
 * by someone accountable for the grant, not claimed by whoever finds a signup
 * page. That makes this screen the one place a tenant's authority is actually
 * decided, so it leads with the roles rather than the names.
 *
 * Two rules the server enforces and this screen states up front, because being
 * refused after clicking teaches people nothing:
 *
 *   * You cannot change your own role. Self-promotion is the escalation this
 *     endpoint exists to close.
 *   * The last remaining administrator cannot be demoted — a tenant with
 *     nobody able to administer it cannot be recovered through the API.
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
import { Loader2, Users, Lock, UserPlus, ShieldAlert, Info } from 'lucide-react';

interface DirectoryUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

/** What each role can actually do, in the words a person would use. */
const ROLE_NOTE: Record<string, string> = {
  admin: 'Everything, including managing people.',
  ap_clerk: 'Raises requests, runs tenders, prepares payments. Approves nothing.',
  manager: 'Approves needs and invoices up to 250,000, and awards tenders.',
  cfo: 'Approves any amount, releases payments.',
  approver: 'Approves invoices and orders only.',
  auditor: 'Reads everything, changes nothing.',
  user: 'Read-only access to invoices.',
  system: 'For automation, not a person.',
};

const ASSIGNABLE = [
  'ap_clerk', 'manager', 'cfo', 'approver', 'auditor', 'admin',
];

const ROLE_STYLE: Record<string, string> = {
  admin: 'border-primary/50 bg-primary/10 text-primary',
  cfo: 'border-green-500/50 bg-green-500/10 text-green-600',
  manager: 'border-blue-500/50 bg-blue-500/10 text-blue-600',
  auditor: 'border-muted text-muted-foreground',
};

const label = (s: string) => s.replace(/_/g, ' ');
const MIN_PASSWORD = 12;

export default function UsersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('ap_clerk');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(API_ENDPOINTS.USERS.LIST, {}, user.access_token);
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setUsers(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = async () => {
    if (!user?.access_token) return;
    setBusy('create');
    try {
      const response = await apiFetch(
        API_ENDPOINTS.USERS.LIST,
        {
          method: 'POST',
          body: JSON.stringify({
            email: newEmail.trim(),
            full_name: newName.trim() || null,
            password: newPassword,
            role: newRole,
          }),
        },
        user.access_token
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: response.status === 403 ? 'Not permitted' : 'Could not create',
          description:
            typeof body.detail === 'string'
              ? body.detail
              : 'The account was not created.',
        });
        return;
      }
      toast({
        title: `Created ${body.email}`,
        description: 'Tell them to change the password when they first sign in.',
      });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('ap_clerk');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (target: DirectoryUser, role: string) => {
    if (!user?.access_token || role === target.role) return;
    setBusy(target.id);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.USERS.SET_ROLE(target.id),
        { method: 'PATCH', body: JSON.stringify({ role }) },
        user.access_token
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Role unchanged',
          description:
            typeof body.detail === 'string' ? body.detail : 'Nothing changed.',
        });
        return;
      }
      toast({
        title: `${target.email} is now ${label(role)}`,
        description: 'Their existing sessions have been revoked.',
      });
      await load();
    } finally {
      setBusy(null);
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
                Only an administrator can see who has access.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admins = users.filter((u) => u.role === 'admin');
  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD;
  const canCreate =
    Boolean(newEmail.trim()) && newPassword.length >= MIN_PASSWORD && busy === null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          People
        </h1>
        <p className="text-muted-foreground mt-1">
          Who has access, and what each of them may do.
        </p>
      </div>

      {admins.length === 1 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">One administrator</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {admins[0].email} is the only one. They cannot be demoted, because
                a tenant with nobody able to administer it cannot be recovered
                through the API — consider a second.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>
            {users.length} active account(s). Changing a role revokes that
            person&apos;s existing sessions, so a demotion takes effect at once
            rather than whenever their token happens to expire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((row) => {
            const isSelf = row.id === user.id;
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {row.full_name || row.email}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ROLE_STYLE[row.role] ?? ''}`}
                    >
                      {label(row.role)}
                    </Badge>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.full_name ? `${row.email} · ` : ''}
                    {ROLE_NOTE[row.role] ?? 'Role not described.'}
                  </p>
                </div>

                {isSelf ? (
                  // Refused by the server too; saying why here is kinder than
                  // a 400 after the fact.
                  <span className="text-xs text-muted-foreground">
                    You cannot change your own role
                  </span>
                ) : (
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={row.role}
                    disabled={busy !== null}
                    onChange={(e) => changeRole(row, e.target.value)}
                    aria-label={`Role for ${row.email}`}
                  >
                    {ASSIGNABLE.map((r) => (
                      <option key={r} value={r}>
                        {label(r)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Add someone
          </CardTitle>
          <CardDescription>
            Self-registration is closed, so accounts are granted here — the act is
            permissioned and recorded with the role handed out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Initial password</Label>
              <Input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p
                className={`text-xs ${
                  passwordTooShort ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                At least {MIN_PASSWORD} characters. This account may be given
                authority to approve and release payments.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {ASSIGNABLE.map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                {ROLE_NOTE[newRole]}
              </p>
            </div>
          </div>

          <Separator />

          <Button onClick={createUser} disabled={!canCreate}>
            {busy === 'create' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Create the account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
