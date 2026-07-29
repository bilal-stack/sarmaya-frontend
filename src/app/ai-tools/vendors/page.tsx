'use client';

/**
 * Vendor review queue: the reviewer worklist behind the approval gate.
 *
 * An invoice cannot be approved or paid while its vendor is unverified, so
 * these vendors are each blocking real money. They are ordered by the value
 * they are holding up, which is what makes this a worklist rather than a list.
 *
 * Segregation of duties applies: the backend refuses activation by whoever
 * created the vendor, and that refusal is surfaced here rather than swallowed.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ShieldCheck, ShieldAlert, RefreshCw, Building2, Ban,
} from 'lucide-react';

interface VendorReviewItem {
  id: string;
  legal_name: string;
  display_name: string | null;
  vendor_code: string | null;
  email: string | null;
  status: string;
  created_at: string;
  blocked_invoice_count: number;
  blocked_total_amount: number;
}

const STATUS_TONE: Record<string, string> = {
  pending_verification: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600',
  blocked: 'border-red-500/50 bg-red-500/10 text-red-600',
  inactive: 'border-gray-500/50 bg-gray-500/10 text-gray-500',
  active: 'border-green-500/50 bg-green-500/10 text-green-600',
};

export default function VendorReviewPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<VendorReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (authLoading) return;
    if (!user?.access_token) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.VENDORS.REVIEW_QUEUE,
        {},
        user.access_token
      );
      if (!response.ok) throw new Error('Could not load the vendor review queue');
      setVendors(await response.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Load failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user, router, toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const setStatus = async (vendor: VendorReviewItem, status: string) => {
    if (!user?.access_token) return;
    setBusyId(vendor.id);
    try {
      const response = await apiFetch(
        API_ENDPOINTS.VENDORS.SET_STATUS(vendor.id),
        { method: 'PATCH', body: JSON.stringify({ status }) },
        user.access_token
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // A 403 here is usually the SoD control, not a bug — say so plainly.
        throw new Error(err.detail || 'Could not update the vendor');
      }
      toast({
        title: status === 'active' ? 'Vendor verified' : 'Vendor blocked',
        description:
          status === 'active'
            ? `${vendor.legal_name} is active — ${vendor.blocked_invoice_count} invoice(s) released for approval.`
            : `${vendor.legal_name} is blocked and cannot be paid.`,
      });
      fetchQueue();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not permitted', description: error.message });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || (isLoading && vendors.length === 0)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const totalBlocked = vendors.reduce((sum, v) => sum + v.blocked_total_amount, 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Vendor review
          </h1>
          <p className="text-muted-foreground mt-1">
            Vendors awaiting verification, ordered by the value they are holding up.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {vendors.length > 0 && (
        <Card className="mb-6 border-yellow-500/40 bg-yellow-500/[0.06]">
          <CardContent className="py-4">
            <p className="text-sm">
              <span className="font-semibold">{vendors.length}</span> vendor(s) are blocking{' '}
              <span className="font-semibold">
                {totalBlocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>{' '}
              across pending invoices.
            </p>
          </CardContent>
        </Card>
      )}

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No vendors awaiting review</p>
            <p className="text-sm text-muted-foreground mt-1">
              Every vendor with pending invoices has been verified.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{vendor.legal_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {vendor.email ?? 'No contact email'}
                      {vendor.vendor_code && ` · ${vendor.vendor_code}`}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={STATUS_TONE[vendor.status] ?? 'border-muted'}
                  >
                    {vendor.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Holding up{' '}
                    <span className="font-medium text-foreground">
                      {vendor.blocked_invoice_count} invoice
                      {vendor.blocked_invoice_count === 1 ? '' : 's'}
                    </span>{' '}
                    worth{' '}
                    <span className="font-medium text-foreground">
                      {vendor.blocked_total_amount.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === vendor.id}
                      onClick={() => setStatus(vendor, 'blocked')}
                    >
                      <Ban className="h-4 w-4 mr-1.5" />
                      Block
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === vendor.id}
                      onClick={() => setStatus(vendor, 'active')}
                    >
                      {busyId === vendor.id ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                      )}
                      Verify &amp; activate
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 mt-px shrink-0" />
                  Whoever created this vendor cannot be the one to activate it.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
