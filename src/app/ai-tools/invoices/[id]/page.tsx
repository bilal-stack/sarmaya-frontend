'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import type { InvoiceDetail, ApiError } from '@/types/invoice';
import type { NextAction } from '@/types/governance';
import Link from 'next/link';
import { NextActionCard } from '@/components/governance/next-action-card';
import { AuditTimelineView } from '@/components/governance/audit-timeline';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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
          const uuidError = errorData.detail.find(
            (e) => e.type === 'uuid_parsing'
          );
          if (uuidError) {
            throw new Error('Invalid invoice ID format');
          }
          throw new Error(errorData.detail[0]?.msg || 'Failed to fetch invoice');
        }

        throw new Error(
          typeof errorData.detail === 'string'
            ? errorData.detail
            : 'Invoice not found'
        );
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

  /**
   * Route a suggestion to the handler that already owns that transition.
   * Suggestions never bypass the normal path: anything needing extra input
   * (a duplicate override reason, vendor verification, field edits) navigates
   * rather than firing a mutation blind.
   */
  const handleSuggestedAction = (action: NextAction) => {
    switch (action) {
      case 'submit_for_approval':
        return handleSubmitForApproval();
      case 'approve':
        return handleApprove();
      case 'mark_paid':
        return handleMarkAsPaid();
      case 'verify_vendor':
        return router.push('/ai-tools/vendors');
      case 'review_extraction':
      case 'fix_missing_fields':
      case 'revise':
      case 'resolve_duplicate':
      default:
        // Needs human input or a screen we don't own here.
        return;
    }
  };

  const handleSubmitForApproval = async () => {
    if (!user?.access_token || !invoice) return;

    setIsSubmitting(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.SUBMIT(invoice.id),
        { method: 'POST' },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit invoice');
      }

      toast({
        title: 'Success',
        description: 'Invoice submitted for approval successfully',
      });

      fetchInvoiceDetail();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to submit invoice',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!user?.access_token || !invoice) return;

    setIsApproving(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.APPROVE(invoice.id),
        { method: 'POST' },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to approve invoice');
      }

      toast({
        title: 'Success',
        description: 'Invoice approved successfully',
      });

      fetchInvoiceDetail();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to approve invoice',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!user?.access_token || !invoice || !rejectionReason.trim()) return;

    setIsRejecting(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.REJECT(invoice.id),
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectionReason }),
        },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to reject invoice');
      }

      toast({
        title: 'Success',
        description: 'Invoice rejected successfully',
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      fetchInvoiceDetail();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reject invoice',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!user?.access_token || !invoice) return;

    setIsMarkingPaid(true);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.INVOICES.MARK_PAID(invoice.id),
        { method: 'POST' },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to mark invoice as paid');
      }

      toast({
        title: 'Success',
        description: 'Invoice marked as paid successfully',
      });

      fetchInvoiceDetail();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to mark invoice as paid',
      });
    } finally {
      setIsMarkingPaid(false);
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
        <p className="text-muted-foreground">
          Please log in to view invoice details
        </p>
        <Button onClick={() => router.push('/login')}>Go to Login</Button>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Invoice Not Found</h3>
            <p className="text-sm text-muted-foreground">
              {error || 'The requested invoice could not be found'}
            </p>
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
                  <span className="font-medium">
                    {formatCurrency(invoice.subtotal_amount, invoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {formatCurrency(invoice.tax_amount, invoice.currency)}
                  </span>
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
                    <p className="text-sm text-muted-foreground">
                      {invoice.description}
                    </p>
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
                  {invoice.line_items.length} item
                  {invoice.line_items.length !== 1 ? 's' : ''} •
                  {invoice.ocr_extracted_data?.raw_data?.line_items_count && (
                    ` ${invoice.ocr_extracted_data.raw_data.line_items_count} detected by OCR`
                  )}
                  {invoice.ocr_extracted_data?.ai_corrections?.line_items_merged && (
                    ` • ${invoice.ocr_extracted_data.ai_corrections.line_items_merged.length} merged by AI`
                  )}
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
                    <Badge variant="outline" className="ml-2">
                      AI Enhanced
                    </Badge>
                  )}
                  {invoice.ocr_extracted_data.raw_data?.pages && (
                    <span className="ml-2">
                      • {invoice.ocr_extracted_data.raw_data.pages} page
                      {invoice.ocr_extracted_data.raw_data.pages !== 1 ? 's' : ''}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Vendor:</span>
                    <span className="font-medium">
                      {invoice.ocr_extracted_data.vendor_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Invoice #:</span>
                    <span className="font-medium">
                      {invoice.ocr_extracted_data.invoice_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extracted Date:</span>
                    <span className="font-medium">
                      {invoice.ocr_extracted_data.invoice_date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency:</span>
                    <span className="font-medium">
                      {invoice.ocr_extracted_data.currency}
                    </span>
                  </div>
                </div>

                {/* AI Corrections Info. Both fields are optional on the OCR
                    payload, so the counts are resolved once here rather than
                    re-reading a possibly-absent array inside the markup. */}
                {(() => {
                  const corrections = invoice.ocr_extracted_data.ai_corrections;
                  const mergedCount = corrections?.line_items_merged?.length ?? 0;
                  const fixedCount = Object.keys(
                    corrections?.descriptions_fixed ?? {}
                  ).length;
                  if (mergedCount === 0 && fixedCount === 0) return null;

                  return (
                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-blue-500">
                            AI Enhancements Applied
                          </p>
                          {mergedCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Merged {mergedCount} split line item
                              {mergedCount !== 1 ? 's' : ''}
                            </p>
                          )}
                          {fixedCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Fixed {fixedCount} description
                              {fixedCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Live Audit Mode: full history, policy reason, tamper-evidence. */}
          <AuditTimelineView objectType="invoice" objectId={invoice.id} />

          {/* The way into the audit console for this invoice. Without this the
              evidence pack is only reachable by reading a UUID out of the
              database, which makes the feature effectively invisible. */}
          {invoice.correlation_id && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Transaction chain</p>
                  <p className="text-xs text-muted-foreground font-mono break-all mt-0.5">
                    {invoice.correlation_id}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/ai-tools/audit?correlation_id=${invoice.correlation_id}`}>
                    Evidence pack
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Suggestion only — the card emits an action, the handlers below
              perform it, so every mutation still goes through one path. */}
          <NextActionCard
            invoiceId={invoice.id}
            isBusy={isSubmitting || isApproving || isMarkingPaid}
            onAction={handleSuggestedAction}
          />

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
                  <p className="text-sm text-muted-foreground">
                    {invoice.rejection_reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoice.current_state === 'draft' && (
                <Button
                  className="w-full"
                  onClick={handleSubmitForApproval}
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit for Approval
                </Button>
              )}

              {invoice.current_state === 'pending_approval' && (
                <>
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={handleApprove}
                    disabled={isApproving}
                  >
                    {isApproving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Approve Invoice
                  </Button>
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isRejecting}
                  >
                    Reject Invoice
                  </Button>
                </>
              )}

              {invoice.current_state === 'approved' && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleMarkAsPaid}
                  disabled={isMarkingPaid}
                >
                  {isMarkingPaid && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Mark as Paid
                </Button>
              )}

              <Button className="w-full" variant="outline">
                Download PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
              }}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
