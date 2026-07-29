'use client';

/**
 * Version history and rollback for a single config object.
 *
 * Two things make this reviewable rather than just a list of JSON blobs:
 *
 *   - Each entry shows *what changed* against the version before it, so an
 *     approver can see "max amount 50,000 → 75,000" instead of re-reading a
 *     whole snapshot and diffing it in their head.
 *   - Rollback is stated honestly. Restoring does not delete anything; it
 *     re-applies an old snapshot as a new version, so the history stays
 *     append-only and the rollback is itself auditable.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Undo2, ArrowRight, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface ConfigVersion {
  version: number;
  config_type: string;
  config_key: string;
  change_action: string;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
  snapshot: Record<string, any>;
}

interface Props {
  configType: string;
  configKey: string;
  /** Human name of the thing being versioned, e.g. "autopilot settings". */
  label: string;
  /** Called after a successful restore so the parent can refetch live config. */
  onRestored?: () => void;
}

const pretty = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const humanise = (key: string) => key.replace(/_/g, ' ');

type Change = { field: string; from: any; to: any; kind: 'changed' | 'added' | 'removed' };

/** Shallow field-level diff — these snapshots are flat config objects. */
function diff(prev: Record<string, any> | undefined, next: Record<string, any>): Change[] {
  if (!prev) return [];
  const fields = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const out: Change[] = [];
  fields.forEach((field) => {
    const from = prev[field];
    const to = next[field];
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    if (!(field in prev)) out.push({ field, from, to, kind: 'added' });
    else if (!(field in next)) out.push({ field, from, to, kind: 'removed' });
    else out.push({ field, from, to, kind: 'changed' });
  });
  return out;
}

export function ConfigHistory({ configType, configKey, label, onRestored }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.CONFIG.VERSIONS(configType, configKey),
        {},
        user.access_token
      );
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      if (response.ok) setVersions(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, [user, configType, configKey]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (version: number) => {
    if (!user?.access_token) return;
    setRestoringVersion(version);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.CONFIG.RESTORE(configType, configKey, version),
        { method: 'POST' },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not restore that version');
      }
      const created: ConfigVersion = await response.json();
      toast({
        title: `Rolled back to version ${version}`,
        description: `Saved as version ${created.version} — the history is unchanged.`,
      });
      await load();
      onRestored?.();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Rollback failed', description: error.message });
    } finally {
      setRestoringVersion(null);
    }
  };

  if (denied) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Change history
        </CardTitle>
        <CardDescription>
          Every edit to the {label} is versioned. Restoring re-applies an old version as a new
          one — nothing is erased.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No changes recorded yet. The next edit will appear here.
          </p>
        ) : (
          versions.map((v, index) => {
            // versions arrive newest-first, so the previous version is the next item
            const previous = versions[index + 1];
            const changes = diff(previous?.snapshot, v.snapshot);
            const isCurrent = index === 0;

            return (
              <div key={v.version} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Version {v.version}</span>
                      <Badge variant="outline" className="text-xs">
                        {v.change_action}
                      </Badge>
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-xs border-green-500/50 bg-green-500/10 text-green-600"
                        >
                          current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseApiDate(v.created_at), 'dd MMM yyyy, HH:mm')}
                      {v.change_reason && ` · ${v.change_reason}`}
                    </p>
                  </div>

                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoringVersion !== null}
                      onClick={() => restore(v.version)}
                    >
                      {restoringVersion === v.version ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Restore
                    </Button>
                  )}
                </div>

                {/* What actually changed */}
                {changes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {changes.map((c) => (
                      <div
                        key={c.field}
                        className="flex items-center gap-1.5 text-xs flex-wrap"
                      >
                        {c.kind === 'added' ? (
                          <Plus className="h-3 w-3 text-green-600 shrink-0" />
                        ) : c.kind === 'removed' ? (
                          <Minus className="h-3 w-3 text-orange-500 shrink-0" />
                        ) : (
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-muted-foreground">{humanise(c.field)}</span>
                        {c.kind !== 'added' && (
                          <span className="line-through text-muted-foreground/70">
                            {pretty(c.from)}
                          </span>
                        )}
                        {c.kind !== 'removed' && (
                          <span className="font-medium">{pretty(c.to)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* The first version has nothing to compare against */}
                {changes.length === 0 && !previous && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(v.snapshot).map(([field, value]) => (
                      <div key={field} className="flex items-center gap-1.5 text-xs flex-wrap">
                        <span className="text-muted-foreground">{humanise(field)}</span>
                        <span className="font-medium">{pretty(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
