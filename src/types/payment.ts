/**
 * Payment runs and their bank export.
 *
 * Money fields are `string`, not `number`: the API serialises Decimal as
 * "320600.00". Typing them as numbers compiles cleanly and then misbehaves at
 * runtime. Verified against live responses before these types were written.
 */

export type PaymentState =
  | 'draft'
  | 'pending_release'
  | 'released'
  | 'rejected'
  | 'cancelled';

export interface PaymentLine {
  id: string;
  line_number: string;
  invoice_id: string;
  amount: string;
  vendor_id: string | null;
  vendor_name: string;
  /** Copied at preparation, so the instruction stays reconstructable. */
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  iban: string | null;
  swift_code: string | null;
}

export interface PaymentSummary {
  id: string;
  payment_number: string;
  payment_date: string;
  total_amount: string;
  current_state: PaymentState;
  prepared_by: string;
  released_by: string | null;
  /** Resolved server-side, so maker-checker is legible without users.view. */
  prepared_by_name: string | null;
  released_by_name: string | null;
  created_at: string;
}

export interface Payment extends PaymentSummary {
  tenant_id: string;
  method: string;
  reference: string | null;
  notes: string | null;
  currency: string | null;
  correlation_id: string | null;
  released_at: string | null;
  rejection_reason: string | null;
  /** Recorded on first export, so a differing later file is detectable. */
  bank_file_hash: string | null;
  bank_file_generated_at: string | null;
  lines: PaymentLine[];
  /**
   * False when the destination accounts on the lines are masked for your role.
   * The values are still present and still identify the account by its last
   * four, but they are not what is stored — say so rather than showing bullets
   * as if the record were incomplete.
   */
  bank_details_visible: boolean;
}

/** An approved invoice not already claimed by an open or released run. */
export interface PayableInvoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  total_amount: string;
}
