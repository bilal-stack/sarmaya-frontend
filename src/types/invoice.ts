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
