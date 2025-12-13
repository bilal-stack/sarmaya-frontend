'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS, apiUpload } from '@/lib/api-config';
import type { InvoiceUploadResponse } from '@/types/invoice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, UploadCloud, File, X, XCircle, CheckCircle, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function InvoiceUploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedInvoice, setUploadedInvoice] = useState<InvoiceUploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(selectedFile.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a PDF or image file (JPG, PNG).',
        });
        return;
      }
      setFile(selectedFile);
      setUploadedInvoice(null);
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFileChange(event.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleUpload = async () => {
    if (!file || isUploading) return;

    if (!user?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to upload an invoice.',
      });
      router.push('/login');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiUpload(
        API_ENDPOINTS.INVOICES.UPLOAD,
        formData,
        user.access_token,
        setUploadProgress
      );

      const result: InvoiceUploadResponse = await response.json();

      if (result.success) {
        setUploadedInvoice(result);
        toast({
          title: 'Upload Successful',
          description: `Invoice ${result.invoice_number} has been uploaded successfully.`,
        });
      } else {
        // Handle failed upload but still show OCR data
        setUploadedInvoice(result);
        setUploadError(result.message || 'Upload failed');
        
        // Show specific error message
        if (result.error === 'duplicate_invoice_number') {
          toast({
            variant: 'destructive',
            title: 'Duplicate Invoice',
            description: result.message || 'This invoice already exists in the system.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: result.message || 'Could not save the invoice.',
          });
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'Could not upload the invoice.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadedInvoice(null);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Invoice</CardTitle>
            <CardDescription>
              Upload PDF or image files for OCR processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!file ? (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragOver ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                }`}
              >
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG (MAX. 10MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <File className="h-8 w-8 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={resetUpload}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">
                      {uploadProgress}% complete
                    </p>
                  </div>
                )}

                {!uploadedInvoice && (
                  <Button onClick={handleUpload} disabled={isUploading} className="w-full">
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading & Processing...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload & Process Invoice
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
            <CardDescription>
              AI-extracted information from the invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!uploadedInvoice ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Upload an invoice to see extracted data
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  {uploadedInvoice.success ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Successfully Processed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                      <XCircle className="mr-1 h-3 w-3" />
                      Upload Failed
                    </Badge>
                  )}
                  {(uploadedInvoice.ocr_confidence || uploadedInvoice.ocr_data?.confidence) && (
                    <Badge variant="secondary">
                      {uploadedInvoice.ocr_confidence || uploadedInvoice.ocr_data?.confidence}% Confidence
                    </Badge>
                  )}
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-500">
                        {uploadedInvoice.error === 'duplicate_invoice_number' 
                          ? 'Duplicate Invoice' 
                          : 'Upload Failed'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{uploadError}</p>
                      {uploadedInvoice.existing_invoice_id && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-red-500 hover:text-red-600 mt-1"
                          onClick={() => router.push(`/ai-tools/invoices/${uploadedInvoice.existing_invoice_id}`)}
                        >
                          View existing invoice →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Duplicate Warning */}
                {uploadedInvoice.duplicate_warning && (
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-500">Warning</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {uploadedInvoice.duplicate_warning}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Invoice Details - Show OCR data even on failure */}
                <div className="space-y-3">
                  {(uploadedInvoice.invoice_number || uploadedInvoice.ocr_data?.invoice_number) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Invoice Number</span>
                      <span className="text-sm font-medium">
                        {uploadedInvoice.invoice_number || uploadedInvoice.ocr_data?.invoice_number}
                      </span>
                    </div>
                  )}

                  {(uploadedInvoice.vendor_name || uploadedInvoice.ocr_data?.vendor_name) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Vendor</span>
                      <span className="text-sm font-medium">
                        {uploadedInvoice.vendor_name || uploadedInvoice.ocr_data?.vendor_name}
                      </span>
                    </div>
                  )}

                  {(uploadedInvoice.invoice_date || uploadedInvoice.ocr_data?.invoice_date) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Date</span>
                      <span className="text-sm font-medium">
                        {uploadedInvoice.invoice_date 
                          ? formatDate(uploadedInvoice.invoice_date)
                          : uploadedInvoice.ocr_data?.invoice_date || 'N/A'}
                      </span>
                    </div>
                  )}

                  <Separator />

                  {(uploadedInvoice.tax_amount || uploadedInvoice.ocr_data?.tax_amount) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tax Amount</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(
                          uploadedInvoice.tax_amount || uploadedInvoice.ocr_data?.tax_amount || 1,
                          uploadedInvoice.currency || uploadedInvoice.ocr_data?.currency || 'USD'
                        )}
                      </span>
                    </div>
                  )}

                  {(uploadedInvoice.total_amount || uploadedInvoice.ocr_data?.total_amount) && (
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-primary">
                        {formatCurrency(
                          uploadedInvoice.total_amount || uploadedInvoice.ocr_data?.total_amount || 2,
                          uploadedInvoice.currency || uploadedInvoice.ocr_data?.currency || 'USD'
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  {uploadedInvoice.success && uploadedInvoice.invoice_id && (
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/ai-tools/invoices/${uploadedInvoice.invoice_id}`)}
                    >
                      View Invoice Details
                    </Button>
                  )}
                  {uploadedInvoice.existing_invoice_id && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(`/ai-tools/invoices/${uploadedInvoice.existing_invoice_id}`)}
                    >
                      View Existing Invoice
                    </Button>
                  )}
                  <Button
                    variant={uploadedInvoice.success ? "outline" : "default"}
                    className="w-full"
                    onClick={resetUpload}
                  >
                    Upload Another Invoice
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
