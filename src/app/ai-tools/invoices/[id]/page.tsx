'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import type { InvoiceDetail, ApiError } from '@/types/invoice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, FileText, Calendar, User, Clock, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  paid: 'bg-blue-500',
  cancelled: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invoiceId = params.id as string;

  const fetchInvoiceDetail = async () => {
    if (authLoading) return;
    
    if (!user?.access_token) {
      toast({ variant: 'destructive', title: 'Authentication required' });
      router.push('/login');
      return;
    }

    if (!invoiceId) {
      setError('Invalid invoice ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.DETAIL(invoiceId),
        {},
        user.access_token
      );

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        
        if (Array.isArray(errorData.detail)) {
          const uuidError = errorData.detail.find(e => e.type === 'uuid_parsing');
          if (uuidError) {
            throw new Error('Invalid invoice ID format');
          }
          throw new Error(errorData.detail[0]?.msg || 'Failed to fetch invoice');
        }
        
        throw new Error(typeof errorData.detail === 'string' ? errorData.detail : 'Invoice not found');
      }

      const data: InvoiceDetail = await response.json();
      setInvoice(data);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load invoice details';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetail();
  }, [invoiceId, authLoading]);

  const formatCurrency = (amount: string, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Authentication Required</h2>
        <p className="text-muted-foreground">Please log in to view invoice details</p>
        <Button onClick={() => router.push('/login')}>Go to Login</Button>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Invoice Not Found</h3>
            <p className="text-sm text-muted-foreground">{error || 'The requested invoice could not be found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Invoice Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{invoice.invoice_number}</CardTitle>
                  <CardDescription>{invoice.vendor_name}</CardDescription>
                </div>
                <Badge className={STATUS_COLORS[invoice.current_state]}>
                  {STATUS_LABELS[invoice.current_state]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Invoice Date</span>
                  </div>
                  <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Due Date</span>
                  </div>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal_amount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </span>
                </div>
              </div>

              {invoice.description && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">{invoice.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Line Items Table */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>
                  {invoice.line_items.length} item{invoice.line_items.length !== 1 ? 's' : ''} • 
                  {invoice.ocr_extracted_data?.raw_data?.line_items_count && 
                    ` ${invoice.ocr_extracted_data.raw_data.line_items_count} detected by OCR`}
                  {invoice.ocr_extracted_data?.ai_corrections?.line_items_merged && 
                    ` • ${invoice.ocr_extracted_data.ai_corrections.line_items_merged.length} merged by AI`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.line_items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm">{item.description}</p>
                              {item.product_code && (
                                <Badge variant="outline" className="text-xs">
                                  {item.product_code}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price.toString(), invoice.currency)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.amount.toString(), invoice.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Subtotal
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.subtotal_amount, invoice.currency)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Tax ({invoice.currency})
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.tax_amount, invoice.currency)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={4} className="text-right font-bold text-lg">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-primary">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OCR Data Card */}
          {invoice.ocr_extracted_data && (
            <Card>
              <CardHeader>
                <CardTitle>OCR Data</CardTitle>
                <CardDescription>
                  Confidence: {invoice.ocr_confidence}% 
                  {invoice.ocr_extracted_data.ai_enhanced && (
                    <Badge variant="outline" className="ml-2">AI Enhanced</Badge>
                  )}
                  {invoice.ocr_extracted_data.raw_data?.pages && (
                    <span className="ml-2">• {invoice.ocr_extracted_data.raw_data.pages} page{invoice.ocr_extracted_data.raw_data.pages !== 1 ? 's' : ''}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Vendor:</span>
                    <span className="font-medium">{invoice.ocr_extracted_data.vendor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Invoice #:</span>
                    <span className="font-medium">{invoice.ocr_extracted_data.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Date:</span>
                    <span className="font-medium">{invoice.ocr_extracted_data.invoice_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="font-medium">{invoice.ocr_extracted_data.currency}</span>
                  </div>
                </div>

                {/* AI Corrections Info */}
                {invoice.ocr_extracted_data.ai_corrections && 
                 (invoice.ocr_extracted_data.ai_corrections.line_items_merged?.length > 0 || 
                  Object.keys(invoice.ocr_extracted_data.ai_corrections.descriptions_fixed || {}).length > 0) && (
                  <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-500">AI Enhancements Applied</p>
                        {invoice.ocr_extracted_data.ai_corrections.line_items_merged?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Merged {invoice.ocr_extracted_data.ai_corrections.line_items_merged.length} split line item{invoice.ocr_extracted_data.ai_corrections.line_items_merged.length !== 1 ? 's' : ''}
                          </p>
                        )}
                        {Object.keys(invoice.ocr_extracted_data.ai_corrections.descriptions_fixed || {}).length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Fixed {Object.keys(invoice.ocr_extracted_data.ai_corrections.descriptions_fixed).length} description{Object.keys(invoice.ocr_extracted_data.ai_corrections.descriptions_fixed).length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Created</span>
                </div>
                <p className="text-sm font-medium">{formatDate(invoice.created_at)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Last Updated</span>
                </div>
                <p className="text-sm font-medium">{formatDate(invoice.updated_at)}</p>
              </div>

              {invoice.approved_at && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Approved</span>
                  </div>
                  <p className="text-sm font-medium">{formatDate(invoice.approved_at)}</p>
                </div>
              )}

              {invoice.rejection_reason && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-500">Rejection Reason</p>
                  <p className="text-sm text-muted-foreground">{invoice.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoice.current_state === 'pending_approval' && (
                <>
                  <Button className="w-full" variant="default">Approve</Button>
                  <Button className="w-full" variant="destructive">Reject</Button>
                </>
              )}
              {invoice.current_state === 'approved' && (
                <Button className="w-full" variant="default">Mark as Paid</Button>
              )}
              <Button className="w-full" variant="outline">Download PDF</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
