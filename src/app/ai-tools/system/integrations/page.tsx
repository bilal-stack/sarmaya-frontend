'use client';

/**
 * The Integration Hub — the tenant's own accounting system, connected.
 *
 * A sibling of the error monitor rather than an `ai-tools` task card, and for
 * the same reason that page exists: the failure this screen catches is a quiet
 * one. When a connection's token dies, nothing errors. Payments keep releasing,
 * the app looks healthy, and journal entries simply stop arriving in the
 * client's books — a divergence nobody notices until somebody reconciles a
 * month later and finds it.
 *
 * So the page leads with two questions in order: is it connected, and is
 * anything stuck. The configuration below is what you set once; the sync
 * failures table is what you come back for.
 *
 * One flow here is unlike anything else in the app. Connecting asks the backend
 * for an authorization URL and then does a full `window.location.href`
 * navigation to Intuit — not a fetch. The browser has to genuinely leave the
 * SPA for a consent screen on a domain we do not own, and the backend's
 * callback redirects it back here with `?connected=` or `?error=`.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Link2, Link2Off,
  ShieldAlert, Info, RotateCw, Plug,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/** One provider today. The shape is per-provider so a second one is a tab,
 *  not a rewrite — but nothing is built for Xero or SAP yet (DR-049). */
const PROVIDER = 'quickbooks';
const PROVIDER_LABEL = 'QuickBooks Online';

type ConnectionStatus = 'not_connected' | 'connected' | 'expired' | 'error';

interface Connection {
  provider: string;
  status: ConnectionStatus;
  external_company_id: string | null;
  external_company_name: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  default_liability_account_external_id: string | null;
  default_bank_account_external_id: string | null;
  ready_to_post: boolean;
}

interface Account {
  external_account_id: string;
  name: string;
  account_type: string | null;
  account_sub_type: string | null;
  is_active: boolean;
}

interface Party {
  external_party_id: string;
  party_type: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
}

interface JournalPost {
  id: string;
  source_type: string;
  source_id: string;
  status: 'pending' | 'posted' | 'failed';
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  posted_at: string | null;
  external_transaction_id: string | null;
}

interface Vendor {
  id: string;
  legal_name: string;
}

const STATUS_META: Record<ConnectionStatus, {
  label: string; icon: React.ReactNode; badge: string; blurb: string;
}> = {
  connected: {
    label: 'Connected',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />,
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    blurb: 'Released payments and paid expense claims are posted as journal entries.',
  },
  not_connected: {
    label: 'Not connected',
    icon: <Plug className="h-5 w-5 text-muted-foreground" />,
    badge: 'bg-muted text-muted-foreground border-border',
    blurb:
      'Nothing is posted anywhere. Payments and expenses work exactly as they do now — connecting is optional.',
  },
  expired: {
    label: 'Needs reconnecting',
    icon: <XCircle className="h-5 w-5 text-destructive" />,
    badge: 'bg-destructive/10 text-destructive border-destructive/30',
    blurb:
      'The token stopped working and cannot be renewed automatically. Entries are queuing and will post once you reconnect — nothing has been lost.',
  },
  error: {
    label: 'Error',
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />,
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    blurb: 'The last call to the provider failed. See the detail below.',
  },
};

const POST_STATUS_BADGE: Record<string, string> = {
  posted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
};

function when(value: string | null): string {
  const parsed = value ? parseApiDate(value) : null;
  if (!parsed) return 'never';
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [posts, setPosts] = useState<JournalPost[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [liabilityAccount, setLiabilityAccount] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // The OAuth callback lands back here with the outcome in the query string,
  // because a browser mid-navigation from Intuit cannot read a JSON body.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const failed = searchParams.get('error');
    if (connected) {
      toast({
        title: 'Connected',
        description: `${PROVIDER_LABEL} is linked. Choose the posting accounts below before anything can post.`,
      });
      router.replace('/ai-tools/system/integrations');
    } else if (failed) {
      toast({
        variant: 'destructive',
        title: 'Could not connect',
        description: failed,
      });
      router.replace('/ai-tools/system/integrations');
    }
    // Runs once per arrival; router.replace clears the params so it cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    setLoading(true);
    try {
      const statusResponse = await apiFetch(
        API_ENDPOINTS.INTEGRATIONS.STATUS(PROVIDER), {}, user.access_token,
      );
      if (statusResponse.status === 403) {
        setForbidden(true);
        return;
      }
      if (!statusResponse.ok) throw new Error('Could not read the connection status');
      const status: Connection = await statusResponse.json();
      setConnection(status);
      setLiabilityAccount(status.default_liability_account_external_id || '');
      setBankAccount(status.default_bank_account_external_id || '');

      if (status.status === 'not_connected') {
        setAccounts([]);
        setParties([]);
        setPosts([]);
        return;
      }

      // Everything below only exists once there is a connection. Failures are
      // kept per-panel: an unreadable vendor list should not blank the page
      // that tells you your books are not being updated.
      const [accountsRes, partiesRes, postsRes, vendorsRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.INTEGRATIONS.ACCOUNTS(PROVIDER), {}, user.access_token),
        apiFetch(API_ENDPOINTS.INTEGRATIONS.PARTIES(PROVIDER, 'vendor'), {}, user.access_token),
        apiFetch(API_ENDPOINTS.INTEGRATIONS.POSTS(PROVIDER), {}, user.access_token),
        apiFetch(API_ENDPOINTS.VENDORS.LIST, {}, user.access_token),
      ]);
      if (accountsRes.ok) setAccounts(await accountsRes.json());
      if (partiesRes.ok) setParties(await partiesRes.json());
      if (postsRes.ok) setPosts(await postsRes.json());
      if (vendorsRes.ok) {
        const body = await vendorsRes.json();
        setVendors(Array.isArray(body) ? body : body.items || []);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load', description: error.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.access_token]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  /** Ask the backend where to send the browser, then actually send it there.
   *  A fetch would follow the redirect internally and land nowhere useful. */
  const connect = async () => {
    if (!user?.access_token) return;
    setBusy('connect');
    try {
      const response = await apiFetch(
        API_ENDPOINTS.INTEGRATIONS.CONNECT(PROVIDER),
        { method: 'POST', body: JSON.stringify({}) },
        user.access_token,
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not start the connection');
      }
      const { authorization_url } = await response.json();
      window.location.href = authorization_url;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not connect', description: error.message });
      setBusy(null);
    }
  };

  const post = async (url: string, body: object | null, success: string, failure: string, key: string) => {
    if (!user?.access_token) return;
    setBusy(key);
    try {
      const response = await apiFetch(
        url,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        user.access_token,
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || failure);
      }
      toast({ title: success });
      await load();
    } catch (error: any) {
      toast({ variant: 'destructive', title: failure, description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const failedPosts = posts.filter((p) => p.status === 'failed');
  const pendingPosts = posts.filter((p) => p.status === 'pending');

  if (authLoading || (loading && !connection && !forbidden)) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const meta = STATUS_META[connection?.status || 'not_connected'];

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting system</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Sarmaya tells your accounting system what already happened — a
            payment released, an expense claim paid — as a journal entry. It
            never changes anything in your books on its own, and it never asks
            them to approve anything.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {forbidden && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Your role cannot see the integration settings. Connecting touches
            credentials for your accounting system, so it is limited to
            administrators.
          </AlertDescription>
        </Alert>
      )}

      {!forbidden && connection && (
        <>
          {/* Connection ------------------------------------------------- */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {meta.icon}
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {PROVIDER_LABEL}
                      <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                    </CardTitle>
                    <CardDescription className="mt-1 max-w-xl">{meta.blurb}</CardDescription>
                  </div>
                </div>
                {connection.status === 'not_connected' ? (
                  <Button onClick={connect} disabled={busy === 'connect'}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {busy === 'connect' ? 'Opening…' : 'Connect'}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    {connection.status === 'expired' && (
                      <Button onClick={connect} disabled={busy === 'connect'}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => post(
                        API_ENDPOINTS.INTEGRATIONS.REFRESH(PROVIDER), null,
                        'Account data refreshed', 'Could not refresh', 'refresh',
                      )}
                      disabled={busy === 'refresh' || connection.status !== 'connected'}
                    >
                      <RotateCw className={`mr-2 h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
                      Re-pull accounts
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => post(
                        API_ENDPOINTS.INTEGRATIONS.DISCONNECT(PROVIDER), null,
                        'Disconnected', 'Could not disconnect', 'disconnect',
                      )}
                      disabled={busy === 'disconnect'}
                    >
                      <Link2Off className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            {connection.status !== 'not_connected' && (
              <CardContent className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Company</div>
                    <div className="font-medium">
                      {connection.external_company_name || connection.external_company_id || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Connected</div>
                    <div className="font-medium">{when(connection.connected_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accounts last pulled</div>
                    <div className="font-medium">{when(connection.last_synced_at)}</div>
                  </div>
                </div>
                {connection.last_error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{connection.last_error}</AlertDescription>
                  </Alert>
                )}
                {connection.status === 'connected' && !connection.ready_to_post && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Connected, but nothing will post yet — choose which
                      accounts an entry should debit and credit below. Guessing
                      them by name would post to the wrong account in a chart
                      that spells them differently, so they are set explicitly.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
          </Card>

          {/* Posting accounts -------------------------------------------- */}
          {connection.status !== 'not_connected' && (
            <Card>
              <CardHeader>
                <CardTitle>Where entries post</CardTitle>
                <CardDescription>
                  Every entry debits the liability account and credits the bank
                  account. Both come from your own chart of accounts, pulled
                  from {PROVIDER_LABEL}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Debit (liability)</label>
                    <Select value={liabilityAccount} onValueChange={setLiabilityAccount}>
                      <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.external_account_id} value={a.external_account_id}>
                            {a.name}{a.account_type ? ` · ${a.account_type}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Credit (bank)</label>
                    <Select value={bankAccount} onValueChange={setBankAccount}>
                      <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.external_account_id} value={a.external_account_id}>
                            {a.name}{a.account_type ? ` · ${a.account_type}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => post(
                    API_ENDPOINTS.INTEGRATIONS.DEFAULT_ACCOUNTS(PROVIDER),
                    {
                      liability_account_external_id: liabilityAccount,
                      bank_account_external_id: bankAccount,
                    },
                    'Posting accounts saved', 'Could not save', 'accounts',
                  )}
                  disabled={!liabilityAccount || !bankAccount || busy === 'accounts'}
                >
                  Save
                </Button>
                {accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No accounts pulled yet. Use “Re-pull accounts” above.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync failures ------------------------------------------------ */}
          {connection.status !== 'not_connected' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Posting queue
                  {failedPosts.length > 0 && (
                    <Badge variant="outline" className={POST_STATUS_BADGE.failed}>
                      {failedPosts.length} failed
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Every entry this connection has been asked to post. A failed
                  one was given up on after repeated attempts — it is kept, not
                  discarded, and retrying preserves the attempt count so it
                  stays visible how long it went unnoticed.
                  {pendingPosts.length > 0 && (
                    pendingPosts.length === 1
                      ? ' One is queued and still being tried.'
                      : ` ${pendingPosts.length} are queued and still being tried.`
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {posts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing has been queued yet. Entries appear here when a
                    payment is released or an expense claim is paid.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.source_type === 'payment' ? 'Payment' : 'Expense claim'}
                            <span className="text-muted-foreground ml-1 font-normal">
                              {p.source_id.slice(0, 8)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={POST_STATUS_BADGE[p.status]}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.attempts}</TableCell>
                          <TableCell className="max-w-md text-sm text-muted-foreground">
                            {p.status === 'posted'
                              ? `Posted ${when(p.posted_at)}${p.external_transaction_id ? ` · ${p.external_transaction_id}` : ''}`
                              : p.last_error || (p.next_attempt_at ? `Next try ${when(p.next_attempt_at)}` : '—')}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => post(
                                  API_ENDPOINTS.INTEGRATIONS.RETRY_POST(PROVIDER, p.id),
                                  null, 'Queued again', 'Could not retry', p.id,
                                )}
                                disabled={busy === p.id}
                              >
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Vendor mapping ---------------------------------------------- */}
          {connection.status !== 'not_connected' && (
            <Card>
              <CardHeader>
                <CardTitle>Vendor matching</CardTitle>
                <CardDescription>
                  Optional. Matching a Sarmaya vendor to the one already in your
                  books makes the vendor breakdown there readable per supplier.
                  An unmatched vendor still posts — it just posts without a name
                  attached.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vendors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendors to match.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sarmaya vendor</TableHead>
                        <TableHead>Matches in {PROVIDER_LABEL}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.legal_name}</TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(value) => post(
                                API_ENDPOINTS.INTEGRATIONS.MAP_VENDOR(PROVIDER, v.id),
                                { external_party_id: value },
                                'Vendor matched', 'Could not match', v.id,
                              )}
                              disabled={busy === v.id}
                            >
                              <SelectTrigger className="max-w-sm">
                                <SelectValue placeholder="Not matched" />
                              </SelectTrigger>
                              <SelectContent>
                                {parties.map((party) => (
                                  <SelectItem
                                    key={party.external_party_id}
                                    value={party.external_party_id}
                                  >
                                    {party.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** useSearchParams needs a Suspense boundary to build statically. */
export default function Page() {
  return (
    <Suspense fallback={<div className="container mx-auto p-4 md:p-8"><Skeleton className="h-40 w-full" /></div>}>
      <IntegrationsPage />
    </Suspense>
  );
}
