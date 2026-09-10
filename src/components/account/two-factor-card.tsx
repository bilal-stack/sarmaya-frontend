'use client';

/**
 * Turning a second factor on, off, and reissuing recovery codes.
 *
 * The backend has had all of this since MFA shipped — six endpoints, tested —
 * and none of it was reachable. Worse than unreachable: `/auth/login` answers
 * an MFA account with `mfa_required` and no token, which the login form used to
 * report as "Login failed", so enabling the factor locked you out of the app
 * with an error that never said why. The challenge step in login-form.tsx is
 * the other half of this change and had to come first.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 * **The QR is rendered in the browser.** The provisioning URI contains the
 * shared secret, so handing it to a hosted QR image service would post the
 * second factor to a third party — which is why this pulls in a local
 * component rather than an <img src="https://...chart?data=otpauth://...">.
 *
 * **Recovery codes are shown once and the screen says so.** They are stored
 * hashed, so there is no second chance and no support route that recovers
 * them. A dialog somebody dismisses without reading is how a person ends up
 * locked out of an account they still own.
 */

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/api-config';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MfaStatus {
  enabled: boolean;
  confirmed_at: string | null;
  recovery_codes_remaining: number;
}

type Mode = 'idle' | 'enrolling' | 'disabling' | 'reissuing';

export function TwoFactorCard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');

  const [enrolment, setEnrolment] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.access_token}`,
    }),
    [user?.access_token],
  );

  const loadStatus = useCallback(async () => {
    if (!user?.access_token) return;
    try {
      const res = await fetch(API_ENDPOINTS.AUTH.MFA_STATUS, { headers: authHeaders() });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [user?.access_token, authHeaders]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  /** Every call here fails the same way, so the handling lives in one place. */
  async function call(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'That did not work.');
    return data;
  }

  function fail(error: unknown, title: string) {
    toast({
      variant: 'destructive',
      title,
      description: error instanceof Error ? error.message : 'Please try again.',
    });
  }

  function reset() {
    setMode('idle');
    setEnrolment(null);
    setCode('');
    setPassword('');
  }

  async function beginEnrolment() {
    setBusy(true);
    try {
      const data = await call(API_ENDPOINTS.AUTH.MFA_SETUP);
      setEnrolment({ secret: data.secret, uri: data.provisioning_uri });
      setMode('enrolling');
    } catch (e) {
      fail(e, 'Could not start setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrolment() {
    setBusy(true);
    try {
      const data = await call(API_ENDPOINTS.AUTH.MFA_CONFIRM, { code: code.trim() });
      setRecoveryCodes(data.recovery_codes);
      reset();
      await loadStatus();
    } catch (e) {
      fail(e, 'That code was not accepted');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await call(API_ENDPOINTS.AUTH.MFA_DISABLE, { password, code: code.trim() });
      reset();
      setRecoveryCodes(null);
      await loadStatus();
      toast({ title: 'Two-factor authentication is off' });
    } catch (e) {
      fail(e, 'Could not turn it off');
    } finally {
      setBusy(false);
    }
  }

  async function reissue() {
    setBusy(true);
    try {
      const data = await call(API_ENDPOINTS.AUTH.MFA_RECOVERY_CODES, { code: code.trim() });
      setRecoveryCodes(data.recovery_codes);
      reset();
      await loadStatus();
    } catch (e) {
      fail(e, 'Could not reissue');
    } finally {
      setBusy(false);
    }
  }

  const enabled = status?.enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {enabled
            ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
            : <ShieldOff className="h-4 w-4" />}
          Two-factor authentication
          {!loading && (
            <Badge
              variant="outline"
              className={`ml-auto font-normal ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : ''
              }`}
            >
              {enabled ? 'On' : 'Off'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          A code from your phone, on top of your password. Without it, anybody
          who learns your password is you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : recoveryCodes ? (
          <RecoveryCodes
            codes={recoveryCodes}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(recoveryCodes.join('\n'));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            onDone={() => { setRecoveryCodes(null); setCopied(false); }}
          />
        ) : mode === 'enrolling' && enrolment ? (
          <div className="space-y-4">
            <p className="text-sm">
              Scan this with an authenticator app, then enter the code it shows.
              Nothing is switched on until that code is accepted.
            </p>

            {/* Rendered here, in the browser. The URI carries the shared
                secret — sending it to a hosted QR service would hand the
                second factor to a third party. */}
            <div className="flex justify-center rounded-md border bg-white p-4">
              <QRCodeSVG value={enrolment.uri} size={168} />
            </div>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Can&apos;t scan it? Enter this key by hand
              </summary>
              <code className="mt-2 block break-all rounded bg-muted p-2 font-mono">
                {enrolment.secret}
              </code>
            </details>

            <Separator />

            <div className="space-y-2">
              <label htmlFor="mfa-setup-code" className="text-sm font-medium">
                Code from the app
              </label>
              <Input
                id="mfa-setup-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                className="tracking-widest"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={confirmEnrolment} disabled={busy || !code.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Turn it on
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : mode === 'disabling' ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              {/* The backend requires both, and the reason is worth repeating
                  here: a stolen session should not be able to strip the
                  protection that exists because sessions get stolen. */}
              Turning this off needs your password as well as a current code —
              a session on its own must not be able to remove it.
            </p>

            <div className="space-y-2">
              <label htmlFor="mfa-off-password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="mfa-off-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="mfa-off-code" className="text-sm font-medium">
                Current code
              </label>
              <Input
                id="mfa-off-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
                className="tracking-widest"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={disable}
                disabled={busy || !password || !code.trim()}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Turn it off
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : mode === 'reissuing' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A new set replaces the old one, so any code you still have written
              down stops working.
            </p>
            <div className="space-y-2">
              <label htmlFor="mfa-reissue-code" className="text-sm font-medium">
                Current code
              </label>
              <Input
                id="mfa-reissue-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
                className="tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={reissue} disabled={busy || !code.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reissue
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : enabled ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              On since{' '}
              {status?.confirmed_at
                ? new Date(status.confirmed_at).toLocaleDateString()
                : 'recently'}
              .{' '}
              {/* Surfaced rather than buried: somebody down to their last code
                  is one lost phone from a support ticket nobody can resolve,
                  because the codes are stored hashed. */}
              <span
                className={
                  (status?.recovery_codes_remaining ?? 0) <= 2
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : ''
                }
              >
                {status?.recovery_codes_remaining ?? 0} recovery code
                {status?.recovery_codes_remaining === 1 ? '' : 's'} left
              </span>
              .
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode('reissuing')}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Reissue recovery codes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMode('disabling')}>
                Turn off
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={beginEnrolment} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set up two-factor authentication
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Shown once, at enrolment or reissue. There is no second chance — the codes
 *  are stored hashed — so this states that plainly and makes the reader
 *  acknowledge it rather than offering a quiet dismiss. */
function RecoveryCodes({
  codes, copied, onCopy, onDone,
}: {
  codes: string[];
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <span>
          <span className="font-medium">Save these now.</span> They are stored
          hashed, so this is the only time they can be shown — not by us, not by
          support. Each one works once, and they are how you get in if you lose
          your phone.
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm">
        {codes.map((c) => <div key={c}>{c}</div>)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied
            ? <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />
            : <Copy className="mr-2 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4"
          />
          I have saved them somewhere safe
        </label>
        <Button size="sm" onClick={onDone} disabled={!acknowledged}>
          Done
        </Button>
      </div>
    </div>
  );
}
