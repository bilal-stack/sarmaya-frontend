/**
 * Requisitions and sourcing — the upstream half of procure-to-pay.
 *
 * Money and quantity fields are `string`, not `number`: the API serialises
 * Decimal as "9200.00". Typing them as numbers compiles cleanly and then
 * misbehaves at runtime. Verified against live responses before these types
 * were written.
 */

export type RequisitionState =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'converted'
  | 'rejected'
  | 'cancelled';

export type RFQState = 'draft' | 'issued' | 'closed' | 'awarded' | 'cancelled';

export type QuoteState =
  | 'received'
  | 'shortlisted'
  | 'awarded'
  | 'rejected'
  | 'withdrawn';

export interface RequisitionLine {
  id: string;
  line_number: number;
  description: string;
  product_code: string | null;
  quantity: string;
  /** An estimate, not a price — nobody has quoted yet. */
  estimated_unit_price: string;
  estimated_amount: string;
}

export interface RequisitionSummary {
  id: string;
  requisition_number: string;
  title: string;
  department: string | null;
  estimated_amount: string;
  currency: string | null;
  current_state: RequisitionState;
  requested_date: string;
  needed_by: string | null;
  created_at: string;
}

export interface Requisition extends RequisitionSummary {
  tenant_id: string;
  /** What the approver is actually deciding on. */
  justification: string;
  budget_code: string | null;
  /** Minted here; the RFQ, quotes, order, invoice and payment all inherit it. */
  correlation_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  lines: RequisitionLine[];
}

export interface QuoteLine {
  id: string;
  line_number: number;
  description: string;
  product_code: string | null;
  quantity: string;
  unit_price: string;
  amount: string;
}

export interface Quote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  vendor_name: string;
  quote_reference: string | null;
  quote_date: string | null;
  valid_until: string | null;
  currency: string | null;
  total_amount: string;
  lead_time_days: number | null;
  payment_terms: string | null;
  notes: string | null;
  /** A cheaper bid for the wrong specification is a different quote, not a
   *  better one — so it is taken out of the "cheapest" comparison. */
  is_compliant: boolean;
  non_compliance_reason: string | null;
  current_state: QuoteState;
  /** Vendors do not log in; this is the buyer who typed it in. */
  captured_by: string;
  created_at: string;
  lines: QuoteLine[];
}

export interface InvitedVendor {
  vendor_id: string;
  vendor_name: string;
  invited_at: string;
}

export interface RFQSummary {
  id: string;
  rfq_number: string;
  title: string;
  current_state: RFQState;
  issued_date: string | null;
  closes_at: string | null;
  created_at: string;
}

export interface RFQ extends RFQSummary {
  tenant_id: string;
  requisition_id: string;
  currency: string | null;
  correlation_id: string | null;
  awarded_quote_id: string | null;
  awarded_by: string | null;
  awarded_at: string | null;
  /** Why this quote and not the cheapest. Required unless it *was* the cheapest. */
  award_justification: string | null;
  cancellation_reason: string | null;
  created_by: string;
  invited_vendors: InvitedVendor[];
  quotes: Quote[];
}

export interface QuoteComparisonRow {
  quote_id: string;
  vendor_id: string;
  vendor_name: string;
  total_amount: string;
  currency: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  is_compliant: boolean;
  non_compliance_reason: string | null;
  state: QuoteState;
  lines: number;
}

/**
 * The two facts that frame the award decision: which offer is the cheapest
 * *compliant* one, and whether it came back above what the approval covered.
 */
export interface QuoteComparison {
  rfq_id: string;
  rfq_number: string;
  state: RFQState;
  invited_count: number;
  quoted_count: number;
  /** Invited and silent. A tender answered by one of five invitees is a
   *  different decision from one answered by all five. */
  no_response_vendors: string[];
  lowest_compliant_quote_id: string | null;
  requisition_estimate: string | null;
  lowest_exceeds_estimate: boolean;
  quotes: QuoteComparisonRow[];
}
