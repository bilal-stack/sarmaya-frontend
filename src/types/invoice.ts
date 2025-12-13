export type InvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  total_amount: string;
  current_state: InvoiceStatus;
  created_at: string;
}

export interface InvoiceFilters {
  status_filter?: InvoiceStatus;
  vendor_name?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  product_code: string;
}

export interface OCRExtractedData {
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  tax_amount: number;
  currency: string;
  line_items?: LineItem[];
  confidence: number;
  raw_data?: {
    entities?: Record<string, any>;
    text?: string;
    pages?: number;
    tax_metadata?: any;
    line_items_count?: number;
    raw_line_items_count?: number;
  };
  ai_enhanced?: boolean;
  ai_corrections?: {
    line_items_merged?: string[];
    descriptions_fixed?: Record<string, any>;
  };
}

export interface InvoiceDetail extends Invoice {
  due_date: string | null;
  tax_amount: string;
  subtotal_amount: string;
  description: string | null;
  currency: string;
  tenant_id: string;
  ocr_confidence: number;
  ocr_extracted_data: OCRExtractedData;
  pdf_file_id: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  updated_at: string;
  line_items?: LineItem[];
}

export interface ApiError {
  detail: string | Array<{
    type: string;
    loc: string[];
    msg: string;
    input: string;
    ctx?: Record<string, any>;
    url?: string;
  }>;
}

export interface InvoiceUploadResponse {
  success: boolean;
  invoice_id: string | null;
  invoice_number: string | null;
  vendor_name: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  currency: string | null;
  current_state: InvoiceStatus | null;
  ocr_confidence: number | null;
  ocr_data: OCRExtractedData | null;
  duplicate_warning: string | null;
  file_id: string | null;
  error?: string;
  message?: string;
  existing_invoice_id?: string;
}
