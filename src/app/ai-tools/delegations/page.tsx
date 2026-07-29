'use client';

/**
 * Delegation of approval authority.
 *
 * Lending your authority is a security action, so the UI is explicit about
 * what it does and does not do: the delegate acts in your role for a fixed
 * window, segregation of duties still binds them, and every approval taken
 * under delegation names both parties in the audit trail.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate, toDateTimeLocalValue } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, UserCheck, ShieldAlert, Plus, Ban, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface Delegation {
  id: string;
  from_user_id: string;
  to_user_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface DirectoryUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

/** Default window: from now to a week today — the common "I'm on leave" case.
 *  Formatted as local wall clock, which is what a datetime-local input reads. */
const defaultStart = () => toDateTimeLocalValue(new Date());
const defaultEnd = () =>
  toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 3600 * 1000));

export default function DelegationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [toUserId, setToUserId] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [delRes, dirRes] = await Promise.all([
        apiFetch(`${API_ENDPOINTS.DELEGATIONS.LIST}?include_inactive=true`, {}, user.access_token),
        apiFetch(API_ENDPOINTS.USERS.LIST, {}, user.access_token),
      ]);
      if (delRes.ok) setDelegations(await delRes.json());
      // The directory needs users.view; without it the picker falls back to
      // manual entry rather than the page failing.
      if (dirRes.ok) setDirectory(await dirRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!user?.access_token || !toUserId) return;
    setIsCreating(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.DELEGATIONS.CREATE,
        {
          method: 'POST',
          body: JSON.stringify({
            to_user_id: toUserId,
            starts_at: new Date(startsAt).toISOString(),
            ends_at: new Date(endsAt).toISOString(),
            reason: reason || null,
          }),
        },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not create the delegation');
      }
      toast({
        title: 'Authority delegated',
        description: 'They can act in your role until the end date, or until you revoke it.',
      });
      setToUserId('');
      setReason('');
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not created', description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const revoke = async (d: Delegation) => {
    if (!user?.access_token) return;
    setBusyId(d.id);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.DELEGATIONS.REVOKE(d.id),
        { method: 'POST' },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not revoke');
      }
      toast({ title: 'Delegation revoked', description: 'The authority no longer applies.' });
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not revoked', description: error.message });
    } finally {
      setBusyId(null);
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

  const nameFor = (id: string) => {
    const u = directory.find((x) => x.id === id);
    return u ? u.full_name || u.email : id.slice(0, 8);
  };
  const isActive = (d: Delegation) => {
    const now = Date.now();
    return (
      !d.revoked_at &&
      parseApiDate(d.starts_at).getTime() <= now &&
      parseApiDate(d.ends_at).getTime() >= now
    );
  };
  const statusOf = (d: Delegation) => {
    if (d.revoked_at) return { label: 'Revoked', tone: 'border-muted text-muted-foreground' };
    if (isActive(d)) return { label: 'Active', tone: 'border-green-500/50 bg-green-500/10 text-green-600' };
    if (parseApiDate(d.starts_at).getTime() > Date.now())
      return { label: 'Scheduled', tone: 'border-blue-500/50 bg-blue-500/10 text-blue-600' };
    return { label: 'Expired', tone: 'border-muted text-muted-foreground' };
  };

  const candidates = directory.filter((u) => u.id !== user.id);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <UserCheck className="h-7 w-7 text-primary" />
          Delegation
        </h1>
        <p className="text-muted-foreground mt-1">
          Temporarily lend your approval authority — for leave, or while you are unavailable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delegate your authority</CardTitle>
          <CardDescription>
            They act in your role for this window only. You can revoke it at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">Delegate to</Label>
            {candidates.length > 0 ? (
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger id="to">
                  <SelectValue placeholder="Choose a colleague" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email} · {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="to"
                placeholder="User ID"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">From</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Until</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="Annual leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3">
            <ShieldAlert className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-600">
              Segregation of duties still applies: your delegate cannot approve an invoice they
              created themselves, and any approval they make records both their name and your
              authority.
            </p>
          </div>

          <Button onClick={create} disabled={isCreating || !toUserId}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Delegate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delegations</CardTitle>
          <CardDescription>Granted by or to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {delegations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No delegations yet.</p>
          ) : (
            delegations.map((d) => {
              const status = statusOf(d);
              const mine = d.from_user_id === user.id;
              return (
                <div key={d.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                        {nameFor(d.from_user_id)}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {nameFor(d.to_user_id)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseApiDate(d.starts_at), 'dd MMM HH:mm')} —{' '}
                        {format(parseApiDate(d.ends_at), 'dd MMM HH:mm')}
                        {d.reason && ` · ${d.reason}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={status.tone}>
                        {status.label}
                      </Badge>
                      {mine && !d.revoked_at && isActive(d) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === d.id}
                          onClick={() => revoke(d)}
                        >
                          {busyId === d.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
