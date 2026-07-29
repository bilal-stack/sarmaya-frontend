'use client';

/**
 * Restricted Autopilot console.
 *
 * Autopilot approves invoices without a human, so the UI is built around
 * *not* surprising anyone: the dry-run preview is the default and shows why
 * each invoice is or isn't eligible, running is an explicit second step, and
 * every auto-approval is reversible from here.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { ConfigHistory } from '@/components/governance/config-history';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Bot, Play, Eye, CheckCircle2, XCircle, Save, AlertTriangle,
} from 'lucide-react';

interface AutopilotConfig {
  enabled: boolean;
  max_auto_approve_amount: number;
  require_active_vendor: boolean;
  require_no_duplicate: boolean;
}

interface Candidate {
  invoice_id: string;
  invoice_number: string | null;
  vendor_name: string | null;
  amount: number;
  eligible: boolean;
  reason: string;
}

interface Preview {
  enabled: boolean;
  config: AutopilotConfig;
  considered: number;
  eligible_count: number;
  candidates: Candidate[];
}

export default function AutopilotPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const [cfgRes, prevRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.CONFIG.AUTOPILOT, {}, user.access_token),
        apiFetch(API_ENDPOINTS.AUTOPILOT.PREVIEW, {}, user.access_token),
      ]);
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (prevRes.ok) setPreview(await prevRes.json());
    } catch {
      toast({ variant: 'destructive', title: 'Could not load autopilot settings' });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async () => {
    if (!user?.access_token || !config) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.CONFIG.AUTOPILOT,
        { method: 'PUT', body: JSON.stringify(config) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not save');
      }
      toast({ title: 'Settings saved', description: 'Change recorded and versioned.' });
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const run = async () => {
    if (!user?.access_token) return;
    setIsRunning(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.AUTOPILOT.RUN,
        { method: 'POST' },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Autopilot run failed');
      }
      const result = await response.json();
      toast({
        title: `${result.approved_count} invoice(s) auto-approved`,
        description: 'Each is logged and can be reverted from the invoice.',
      });
      load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Run failed', description: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || !config) return null;

  const eligible = preview?.candidates.filter((c) => c.eligible) ?? [];
  const skipped = preview?.candidates.filter((c) => !c.eligible) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" />
          Restricted Autopilot
        </h1>
        <p className="text-muted-foreground mt-1">
          Opt-in auto-approval for low-risk invoices. Every action is reversible and logged.
        </p>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bounds</CardTitle>
          <CardDescription>
            Autopilot only ever acts inside these limits. Changes are versioned and can be
            rolled back.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="font-medium">Enabled</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Off by default. Nothing runs automatically — you still press Run.
              </p>
            </div>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="limit">Maximum amount</Label>
            <Input
              id="limit"
              type="number"
              min={0}
              value={config.max_auto_approve_amount}
              onChange={(e) =>
                setConfig({ ...config, max_auto_approve_amount: Number(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Invoices above this are always left to a human.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="vendor" className="font-normal text-sm">
              Require an active, verified vendor
            </Label>
            <Switch
              id="vendor"
              checked={config.require_active_vendor}
              onCheckedChange={(v) => setConfig({ ...config, require_active_vendor: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dup" className="font-normal text-sm">
              Require no open duplicate flag
            </Label>
            <Switch
              id="dup"
              checked={config.require_no_duplicate}
              onCheckedChange={(v) => setConfig({ ...config, require_no_duplicate: v })}
            />
          </div>

          {(!config.require_active_vendor || !config.require_no_duplicate) && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-600">
                With a guard off, autopilot can approve invoices a human reviewer would be
                stopped from approving. Turn it back on unless you have a specific reason.
              </p>
            </div>
          )}

          <Button onClick={saveConfig} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save bounds
          </Button>
        </CardContent>
      </Card>

      {/* Dry run */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Dry run
              </CardTitle>
              <CardDescription>
                {preview?.considered ?? 0} pending invoice(s) considered ·{' '}
                <span className="font-medium text-foreground">
                  {preview?.eligible_count ?? 0} eligible
                </span>
              </CardDescription>
            </div>
            <Button
              onClick={run}
              disabled={isRunning || !config.enabled || (preview?.eligible_count ?? 0) === 0}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Approve {preview?.eligible_count ?? 0} invoice(s)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {!config.enabled && (
            <p className="text-sm text-muted-foreground pb-2">
              Autopilot is disabled, so nothing can run. The preview below still shows what
              would qualify.
            </p>
          )}

          {[...eligible, ...skipped].length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No invoices are pending approval.
            </p>
          ) : (
            [...eligible, ...skipped].map((c) => (
              <div
                key={c.invoice_id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{c.invoice_number ?? 'Invoice'}</span>
                    <span className="text-xs text-muted-foreground">{c.vendor_name}</span>
                    <Badge
                      variant="outline"
                      className={
                        c.eligible
                          ? 'gap-1 border-green-500/50 bg-green-500/10 text-green-600'
                          : 'gap-1 border-muted text-muted-foreground'
                      }
                    >
                      {c.eligible ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {c.eligible ? 'Eligible' : 'Skipped'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>
                </div>
                <span className="text-sm font-medium shrink-0">
                  {c.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfigHistory
        configType="autopilot"
        configKey="autopilot"
        label="autopilot bounds"
        onRestored={load}
      />
    </div>
  );
}
