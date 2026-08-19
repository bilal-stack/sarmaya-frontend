/**
 * Vendor bank detail changes — the AP fraud control.
 *
 * Mirrors the backend shapes (ENDPOINTS.md → "Vendor bank changes"). The
 * threat these exist for is specific: an attacker does not forge an invoice,
 * they change one line of a vendor record and wait, and the next genuine
 * invoice pays them. So the details cannot be edited; they move through a
 * request a second person approves, a cooling period, and an explicit apply.
 */

export type BankChangeState =
  | 'pending_approval'
  | 'approved'      // agreed, cooling period running, not yet on the vendor
  | 'effective'     // applied to the vendor record
  | 'rejected'
  | 'cancelled';

export interface BankChange {
  id: string;
  tenant_id: string;
  vendor_id: string;
  reason: string;

  new_bank_account_name: string | null;
  new_bank_account_number: string | null;
  new_bank_name: string | null;
  new_iban: string | null;
  new_swift_code: string | null;

  /** Kept beside the new values because the substitution is what a reviewer
   *  is judging — after this is applied the vendor no longer holds them. */
  old_bank_account_name: string | null;
  old_bank_account_number: string | null;
  old_bank_name: string | null;
  old_iban: string | null;
  old_swift_code: string | null;

  current_state: BankChangeState;
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  /** When a payment may first use the new details. Until then payments to this
   *  vendor are held — to either account. */
  effective_at: string | null;
  applied_at: string | null;
  applied_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  /** False when the account numbers above are masked for your role. */
  bank_details_visible: boolean;
}

export interface BankChangeRequestBody {
  reason: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  iban?: string;
  swift_code?: string;
}

/** States in which the change is unresolved, and payments are therefore held. */
export const OPEN_STATES: BankChangeState[] = ['pending_approval', 'approved'];
