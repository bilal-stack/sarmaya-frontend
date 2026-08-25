'use client';

/**
 * Org units and access scopes.
 *
 * A role says what somebody may *do*. It has never said what they may do it
 * *to* — so a manager who runs one warehouse could approve invoices for every
 * site, and an auditor attached to one business unit read the whole company.
 * This is the other half: assign somebody a unit and they see that unit and
 * everything beneath it.
 *
 * The screen is built around the one thing about this that surprises people:
 * **no scope means no restriction.** A user with nothing assigned sees the
 * whole tenant, which is the default and why the feature is harmless until
 * someone configures it. It also means removing a person's last scope *widens*
 * their access rather than removing it, so the page says that out loud at the
 * moment it would happen rather than leaving it to be discovered afterwards.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2, MapPin, Users2, Wallet, FolderKanban, Plus, X, Loader2,
  ShieldAlert, Globe, AlertTriangle,
} from 'lucide-react';

interface OrgUnit {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  unit_type: string;
  parent_id: string | null;
  is_active: boolean;
}

interface DirectoryUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
}

const UNIT_TYPES: Array<{ value: string; label: string; icon: React.ReactNode }> = [
  { value: 'business_unit', label: 'Business unit', icon: <Building2 className="h-4 w-4" /> },
  { value: 'location', label: 'Location', icon: <MapPin className="h-4 w-4" /> },
  { value: 'department', label: 'Department', icon: <Users2 className="h-4 w-4" /> },
  { value: 'cost_center', label: 'Cost centre', icon: <Wallet className="h-4 w-4" /> },
  { value: 'project', label: 'Project', icon: <FolderKanban className="h-4 w-4" /> },
];

const TYPE_META = Object.fromEntries(
  UNIT_TYPES.map((t) => [t.value, t]),
) as Record<string, { value: string; label: string; icon: React.ReactNode }>;

/** Depth of a unit in the tree, so the list can be indented without a
 *  recursive component — an org chart is tens of rows, not thousands. */
function depthOf(unit: OrgUnit, byId: Record<string, OrgUnit>): number {
  let depth = 0;
  let current = unit;
  while (current.parent_id && byId[current.parent_id] && depth < 10) {
    current = byId[current.parent_id];
    depth += 1;
  }
  return depth;
}

export default function OrgUnitsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [scopeReloadKey, setScopeReloadKey] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', unit_type: 'business_unit', parent_id: '',
  });
  const [confirmRevoke, setConfirmRevoke] = useState<OrgUnit | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const units = usePanel<OrgUnit[]>(API_ENDPOINTS.ORG_UNITS.LIST, reloadKey);
  const directory = usePanel<DirectoryUser[]>(API_ENDPOINTS.USERS.LIST, reloadKey);
  const scopes = usePanel<OrgUnit[]>(
    selectedUserId ? API_ENDPOINTS.ORG_UNITS.SCOPES(selectedUserId) : '',
    scopeReloadKey,
  );

  const forbidden = units.status === 403;
  const unitList = units.data ?? [];
  const byId = Object.fromEntries(unitList.map((u) => [u.id, u]));
  const assigned = scopes.data ?? [];
  const assignedIds = new Set(assigned.map((u) => u.id));
  const unrestricted = Boolean(selectedUserId) && !scopes.loading && assigned.length === 0;

  async function createUnit() {
    if (!user?.access_token) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.ORG_UNITS.CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            code: form.code.trim(),
            name: form.name.trim(),
            unit_type: form.unit_type,
            parent_id: form.parent_id || null,
          }),
        },
        user.access_token,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not create that unit');
      }
      toast({ title: 'Unit created', description: `${form.code} is now available to assign.` });
      setForm({ code: '', name: '', unit_type: 'business_unit', parent_id: '' });
      setCreating(false);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Not created', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function assign(unitId: string) {
    if (!user?.access_token || !selectedUserId) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.ORG_UNITS.ASSIGN(selectedUserId),
        { method: 'POST', body: JSON.stringify({ org_unit_id: unitId }) },
        user.access_token,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not assign that scope');
      }
      toast({
        title: 'Scope assigned',
        description: 'They can now act within this unit and everything under it.',
      });
      setScopeReloadKey((k) => k + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Not assigned', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function revoke(unit: OrgUnit) {
    if (!user?.access_token || !selectedUserId) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.ORG_UNITS.REVOKE(selectedUserId, unit.id),
        { method: 'DELETE' },
        user.access_token,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not remove that scope');
      }
      const wasLast = assigned.length === 1;
      toast({
        title: 'Scope removed',
        description: wasLast
          ? 'That was their last scope, so they can now see the whole tenant.'
          : `They can no longer act within ${unit.code}.`,
      });
      setConfirmRevoke(null);
      setScopeReloadKey((k) => k + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Not removed', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Org units and scopes</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            A role decides what somebody may do. A scope decides what they may
            do it to — assign a unit and they see that unit and everything
            beneath it.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={forbidden}>
          <Plus className="mr-2 h-4 w-4" />
          New unit
        </Button>
      </div>

      {forbidden && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Your role cannot manage org units. Assigning a scope changes what
            somebody can see, so it sits with the permission that manages users.
          </AlertDescription>
        </Alert>
      )}

      {!forbidden && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The org chart</CardTitle>
              <CardDescription>
                Business units, locations, departments, cost centres and
                projects. A scope on a parent covers everything under it, so a
                new site opening beneath one is picked up without reassigning
                anybody.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {units.loading && (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              )}
              {!units.loading && unitList.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No units yet. Until one exists and is assigned, everybody sees
                  the whole tenant — which is exactly how the system behaved
                  before scopes existed.
                </p>
              )}
              {unitList.map((unit) => {
                const meta = TYPE_META[unit.unit_type];
                const depth = depthOf(unit, byId);
                return (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                    style={{ marginLeft: `${depth * 1.25}rem` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground">{meta?.icon}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          <span className="font-mono text-sm">{unit.code}</span>
                          <span className="text-muted-foreground"> — {unit.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meta?.label ?? unit.unit_type}
                        </p>
                      </div>
                    </div>
                    {selectedUserId && (
                      assignedIds.has(unit.id) ? (
                        <Badge variant="secondary">Assigned</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => assign(unit.id)}
                        >
                          Assign
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Who can act where</CardTitle>
              <CardDescription>
                Pick somebody to see and change their scopes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {(directory.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email} — {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedUserId && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nobody selected.
                </p>
              )}

              {selectedUserId && scopes.loading && <Skeleton className="h-20 w-full" />}

              {/* The thing that surprises people, said plainly and in the place
                  it applies. */}
              {unrestricted && (
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Unrestricted.</span> With no
                    scope assigned this user sees the whole tenant. Assign a
                    unit to narrow that.
                  </AlertDescription>
                </Alert>
              )}

              {assigned.length > 0 && (
                <div className="space-y-2">
                  {assigned.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-muted-foreground">
                          {TYPE_META[unit.unit_type]?.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            <span className="font-mono text-sm">{unit.code}</span>
                            <span className="text-muted-foreground"> — {unit.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            and everything beneath it
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => setConfirmRevoke(unit)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New org unit</DialogTitle>
            <DialogDescription>
              The code is what people quote out loud, so it has to be unique
              within the tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-code">Code</Label>
              <Input
                id="unit-code"
                placeholder="KHI"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-name">Name</Label>
              <Input
                id="unit-name"
                placeholder="Karachi warehouse"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.unit_type}
                onValueChange={(v) => setForm({ ...form, unit_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sits under (optional)</Label>
              <Select
                value={form.parent_id || 'none'}
                onValueChange={(v) => setForm({ ...form, parent_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Top level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top level</SelectItem>
                  {unitList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={createUnit}
              disabled={saving || !form.code.trim() || !form.name.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Removing the last scope widens access rather than removing it. That is
          counter-intuitive enough to be worth stopping for. */}
      <Dialog open={Boolean(confirmRevoke)} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this scope?</DialogTitle>
            <DialogDescription>
              {assigned.length === 1
                ? 'This is their last scope. Removing it does not restrict them further — it gives them the whole tenant.'
                : `They will no longer be able to act within ${confirmRevoke?.code}.`}
            </DialogDescription>
          </DialogHeader>
          {assigned.length === 1 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No scope means no restriction. If the intent is to narrow their
                access, assign a different unit instead.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRevoke && revoke(confirmRevoke)}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
