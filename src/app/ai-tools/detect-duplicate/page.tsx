'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_ENDPOINTS } from '@/lib/api-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  ArrowLeft,
  Search,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface DuplicateResult {
  is_duplicate: boolean;
  existing_invoice_id?: string;
  existing_invoice_number?: string;
  similarity_score?: number;
  message: string;
}

export default function DetectDuplicatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DuplicateResult | null>(null);

  const handleCheckDuplicate = async () => {
    if (!user?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to check for duplicates.',
      });
      router.push('/login');
      return;
    }

    if (!invoiceNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter an invoice number.',
      });
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const response = await apiFetch(
        API_ENDPOINTS.DUPLICATES.CHECK,
        {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invoiceNumber.trim(),
            vendor_name: vendorName.trim() || undefined,
          }),
        },
        user.access_token
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to check for duplicates');
      }

      const data: DuplicateResult = await response.json();
      setResult(data);

      if (data.is_duplicate) {
        toast({
          variant: 'destructive',
          title: 'Duplicate Found',
          description: data.message,
        });
      } else {
        toast({
          title: 'No Duplicate',
          description: data.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to check for duplicates',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleReset = () => {
    setInvoiceNumber('');
    setVendorName('');
    setResult(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Detect Duplicate Invoices</h1>
          <p className="text-muted-foreground">
            Check if an invoice already exists in the system to prevent duplicates
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
            <CardDescription>
              Enter the invoice details to check for duplicates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">
                Invoice Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice-number"
                placeholder="Enter invoice number..."
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={isChecking}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name (Optional)</Label>
              <Input
                id="vendor-name"
                placeholder="Enter vendor name for better accuracy..."
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                disabled={isChecking}
              />
              <p className="text-xs text-muted-foreground">
                Adding vendor name helps improve duplicate detection accuracy
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCheckDuplicate}
                disabled={isChecking || !invoiceNumber.trim()}
                className="flex-1"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Check for Duplicates
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isChecking}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.is_duplicate ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Duplicate Detected
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    No Duplicate Found
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`rounded-lg border p-4 ${
                  result.is_duplicate
                    ? 'border-destructive/50 bg-destructive/10'
                    : 'border-green-500/50 bg-green-500/10'
                }`}
              >
                <p className="text-sm">{result.message}</p>
              </div>

              {result.is_duplicate && result.existing_invoice_id && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold">Existing Invoice Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Invoice Number:
                        </span>
                        <Badge variant="outline">
                          {result.existing_invoice_number}
                        </Badge>
                      </div>
                      {result.similarity_score && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Similarity Score:
                          </span>
                          <Badge variant="secondary">
                            {(result.similarity_score * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Button
                      asChild
                      variant="default"
                      className="w-full"
                    >
                      <Link
                        href={`/ai-tools/invoices/${result.existing_invoice_id}`}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Existing Invoice
                      </Link>
                    </Button>
                  </div>
                </>
              )}

              {!result.is_duplicate && (
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="default"
                    className="flex-1"
                  >
                    <Link href="/ai-tools/invoice-upload">
                      <FileText className="mr-2 h-4 w-4" />
                      Upload New Invoice
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Check Another
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
