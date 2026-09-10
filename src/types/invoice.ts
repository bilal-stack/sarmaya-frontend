// Mirrors app/core/enums.py InvoiceState. `validated` was missing, which is
// the same gap as the missing Validate button: the state exists, every
// uploaded invoice has to pass through it before it can be submitted, and
// neither the type nor the UI knew about it.
export type InvoiceStatus =
  | 'draft'
  | 'validated'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'cancelled';

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
  /** Set when the duplicate check matched an existing invoice. Approval is
   *  held while this is set and `duplicate_acknowledged` is false — the only
   *  way past is the resolve-duplicate override, with a reason. */
  potential_duplicate_id?: string | null;
  duplicate_acknowledged?: boolean;
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
  /**
   * The transaction chain this invoice belongs to, used to open its evidence
   * pack in the audit console. Null for invoices created before correlation
   * IDs were introduced.
   */
  correlation_id: string | null;
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

/**
 * Soft duplicate flag returned on upload: an existing invoice from the same
 * vendor with a similar amount and a nearby date. The upload still succeeds —
 * approval is blocked until a reviewer overrides it with a logged reason.
 */
export interface DuplicateWarning {
  invoice_id: string;
  invoice_number: string | null;
  amount: number | null;
  date: string | null;
  message: string;
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
  duplicate_warning: DuplicateWarning | null;
  file_id: string | null;
  error?: string;
  message?: string;
  existing_invoice_id?: string;
}

export interface DuplicateCheckRequest {
  invoice_number: string;
  vendor_name?: string;
}

export interface DuplicateCheckResponse {
  is_duplicate: boolean;
  existing_invoice_id?: string;
  existing_invoice_number?: string;
  similarity_score?: number;
  message: string;
}
