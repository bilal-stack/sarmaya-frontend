/**
 * Purchase orders, goods receipts and three-way matching.
 *
 * Every monetary and quantity field is typed `string`, not `number`. The API
 * serialises Decimal columns as strings ("175600.00", "100.000"), and typing
 * them as numbers would compile happily while `toFixed` and arithmetic
 * silently misbehaved at runtime. Verified against live responses before these
 * types were written.
 */

export type PurchaseOrderState =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'issued'
  | 'rejected'
  | 'closed'
  | 'cancelled';

export interface PurchaseOrderLine {
  id: string;
  line_number: number;
  description: string;
  product_code: string | null;
  quantity: string;
  unit_price: string;
  amount: string;
  /** Running total delivered so far; what the three-way match reads. */
  received_quantity: string;
}

export interface PurchaseOrderSummary {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  total_amount: string;
  current_state: PurchaseOrderState;
  created_at: string;
}

export interface PurchaseOrder extends PurchaseOrderSummary {
  tenant_id: string;
  vendor_id: string | null;
  expected_date: string | null;
  currency: string;
  subtotal_amount: string | null;
  tax_amount: string | null;
  description: string | null;
  /** The chain the receipts and the settling invoice join. */
  correlation_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  lines: PurchaseOrderLine[];
}

export interface GoodsReceiptLine {
  id: string;
  line_number: number;
  purchase_order_line_id: string;
  /** Negative on a return — a correction is appended, never erased. */
  quantity_received: string;
}

export interface GoodsReceipt {
  id: string;
  purchase_order_id: string;
  grn_number: string;
  received_date: string;
  delivery_note: string | null;
  notes: string | null;
  correlation_id: string | null;
  received_by: string;
  created_at: string;
  lines: GoodsReceiptLine[];
}

/** Closed set, mirroring app/services/three_way_match.py. */
export type MatchResult = 'matched' | 'within_tolerance' | 'mismatched' | 'unmatched';

export interface MatchDiscrepancy {
  kind: 'amount' | 'quantity' | 'value' | 'receipt';
  detail: string;
  line_number?: number;
  ordered?: number;
  received?: number;
  invoiced?: number;
  variance?: number;
}

export interface ThreeWayMatch {
  result: MatchResult;
  reason: string;
  purchase_order_id: string | null;
  po_number?: string | null;
  discrepancies: MatchDiscrepancy[];
  tolerance: { amount_percent: number; quantity_percent: number } | null;
}
