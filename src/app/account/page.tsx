'use client';

/**
 * Account settings — profile, password, and (for user managers) team roles.
 *
 * Two things here are security surfaces rather than preferences, and the page
 * is written to say so plainly:
 *
 *   - Changing your password signs out every other session, because the
 *     backend bumps token_version to revoke previously issued tokens. The user
 *     is told before they act, not after.
 *   - Roles are managed here and nowhere else. A role is the input to every
 *     authorization decision in the system, so it is not self-service: you
 *     cannot change your own, and the API enforces that independently.
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, UserCircle, KeyRound, Users, Save, ShieldAlert, Info,
} from 'lucide-react';

interface DirectoryUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

/** Assignable roles, matching app/core/roles.py. */
const ROLES = ['admin', 'cfo', 'manager', 'approver', 'ap_clerk', 'auditor', 'user'];

const MIN_PASSWORD_LENGTH = 8;

export default function AccountPage() {
  const router = useRouter();
  const { user, updateUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) setFullName(user.full_name ?? '');
  }, [user, authLoading, router]);

  const loadDirectory = useCallback(async () => {
    if (!user?.access_token) return;
    const response = await apiFetch(API_ENDPOINTS.USERS.LIST, {}, user.access_token);
    // A 403 simply means this user does not manage the team; the section hides.
    if (response.ok) {
      setDirectory(await response.json());
      setCanManageUsers(true);
    }
  }, [user]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const saveProfile = async () => {
    if (!user?.access_token) return;
    setIsSavingProfile(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUTH.ME,
        { method: 'PUT', body: JSON.stringify({ full_name: fullName }) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Could not save');
      }
      const updated = await response.json();
      updateUser({ full_name: updated.full_name });
      toast({ title: 'Profile saved' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not saved', description: error.message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!user?.access_token) return;
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Re-enter the new password to confirm it.',
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
        {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = Array.isArray(err.detail)
          ? err.detail[0]?.msg ?? 'That password was rejected'
          : err.detail ?? 'Could not change your password';
        throw new Error(detail);
      }
      // The change revoked every token issued to this user, including the one
      // this session is holding. Swap in the fresh token the API returned or
      // the next request would 401 straight into the login screen.
      const { access_token } = await response.json();
      updateUser({ access_token });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password changed',
        description: 'Any other device signed in as you has been signed out.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not changed', description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const changeRole = async (target: DirectoryUser, role: string) => {
    if (!user?.access_token) return;
    setBusyUserId(target.id);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.USERS.SET_ROLE(target.id),
        { method: 'PATCH', body: JSON.stringify({ role }) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === 'string' ? err.detail : 'Could not change that role'
        );
      }
      toast({
        title: 'Role changed',
        description: `${target.full_name || target.email} is now ${role.replace(/_/g, ' ')}. They will need to sign in again.`,
      });
      loadDirectory();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not changed', description: error.message });
    } finally {
      setBusyUserId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsDiffer =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword &&
    !sameAsCurrent;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <UserCircle className="h-7 w-7 text-primary" />
          Account
        </h1>
        <p className="text-muted-foreground mt-1">
          Your profile, your password, and who holds which role.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline">{user.role?.replace(/_/g, ' ')}</Badge>
            <span className="text-xs text-muted-foreground">
              — only a user manager can change this
            </span>
          </div>
          <Button onClick={saveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Password
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Changing your password signs out every other device signed in as you.
            This session stays open.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {passwordTooShort && (
              <p className="text-xs text-destructive">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            )}
            {sameAsCurrent && (
              <p className="text-xs text-destructive">
                The new password must be different from the current one.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {passwordsDiffer && (
              <p className="text-xs text-destructive">These do not match.</p>
            )}
          </div>
          <Button onClick={changePassword} disabled={isChangingPassword || !canSubmitPassword}>
            {isChangingPassword ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            Change password
          </Button>
        </CardContent>
      </Card>

      {/* Team roles — only for users.manage holders */}
      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team roles
            </CardTitle>
            <CardDescription>
              A role decides what someone can approve and what they are blocked from.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3">
              <ShieldAlert className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-600">
                Changing a role signs that person out and is recorded in the audit trail with
                the old and new role. You cannot change your own.
              </p>
            </div>

            {directory.map((member) => {
              const isSelf = member.id === user.id;
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {member.full_name || member.email}
                      {isSelf && (
                        <span className="text-xs text-muted-foreground font-normal"> (you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>

                  {isSelf ? (
                    <Badge variant="outline">{member.role.replace(/_/g, ' ')}</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      {busyUserId === member.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <Select
                        value={member.role}
                        onValueChange={(role) => changeRole(member, role)}
                        disabled={busyUserId !== null}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
