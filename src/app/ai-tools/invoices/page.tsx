'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/api-config';
import { apiFetch } from '@/lib/api-config';
import type { Invoice, InvoiceStatus, InvoiceFilters } from '@/types/invoice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, FileText, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  paid: 'bg-blue-500',
  cancelled: 'bg-gray-400',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth(); // Add authLoading
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<InvoiceFilters>({
    status_filter: (searchParams.get('status') as InvoiceStatus) || undefined,
    vendor_name: searchParams.get('vendor') || '',
    limit: 50,
    offset: 0,
  });

  const fetchInvoices = async () => {
    if (authLoading) return;
    
    if (!user?.access_token) {
      toast({ variant: 'destructive', title: 'Authentication required' });
      router.push('/login');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.status_filter) params.append('status_filter', filters.status_filter);
      if (filters.vendor_name) params.append('vendor_name', filters.vendor_name);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await apiFetch(
        `${API_ENDPOINTS.INVOICES.LIST}?${params.toString()}`,
        {},
        user.access_token
      );

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      setInvoices(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load invoices',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [filters.status_filter, filters.offset, authLoading]); // Add authLoading dependency

  const handleSearch = () => {
    fetchInvoices();
  };

  const handleFilterChange = (key: keyof InvoiceFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Show loading while auth is loading
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Authentication Required</h2>
        <p className="text-muted-foreground">Please log in to view invoices</p>
        <Button onClick={() => router.push('/login')}>
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage and track all your invoices
          </p>
        </div>
        <Button onClick={() => router.push('/ai-tools/invoice-upload')}>
          <FileText className="mr-2 h-4 w-4" />
          Upload Invoice
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status_filter || 'all'}
                onValueChange={(value) => handleFilterChange('status_filter', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vendor Name</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search vendor..."
                  value={filters.vendor_name}
                  onChange={(e) => handleFilterChange('vendor_name', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <div className="grid gap-4">
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No invoices found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or upload a new invoice
              </p>
            </CardContent>
          </Card>
        ) : (
          invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/ai-tools/invoices/${invoice.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{invoice.invoice_number}</h3>
                      <Badge className={STATUS_COLORS[invoice.current_state]}>
                        {STATUS_LABELS[invoice.current_state]}
                      </Badge>
                    </div>
                    
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.vendor_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(invoice.invoice_date)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-lg">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(invoice.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {invoices.length > 0 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={filters.offset === 0}
            onClick={() => handleFilterChange('offset', Math.max(0, (filters.offset || 0) - (filters.limit || 50)))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={invoices.length < (filters.limit || 50)}
            onClick={() => handleFilterChange('offset', (filters.offset || 0) + (filters.limit || 50))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
