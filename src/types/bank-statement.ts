/**
 * Bank statements and reconciliation.
 *
 * Money fields are `string`, not `number`: the API serialises Decimal as
 * "320600.00". Verified against live responses before these types were written.
 *
 * The important shape here is `MatchCandidate`. A candidate is a *suggestion* —
 * the API never matches anything on its own, and this type must never be
 * rendered as though it had. `reasons` is why the suggestion exists, and it is
 * shown so a reconciler can disagree with it.
 */

export type StatementFormat = 'camt053' | 'mt940' | 'csv';

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchCandidate {
  payment_id: string;
  payment_number: string;
  payment_date: string;
  total_amount: string;
  currency: string | null;
  score: number;
  confidence: MatchConfidence;
  /** The named signals behind the score. Show these, not just the number. */
  reasons: string[];
}

export interface BankStatementLine {
  id: string;
  line_number: number;
  value_date: string | null;
  booking_date: string | null;
  amount: string;
  /** Debits are stored positive with this flag; the sign is not in `amount`. */
  is_debit: boolean;
  currency: string | null;
  description: string | null;
  counterparty: string | null;
  bank_reference: string | null;
  matched_payment_id: string | null;
  matched_by: string | null;
  matched_at: string | null;
}

/**
 * A debit with nothing matched against it.
 *
 * An empty `candidates` array is the meaningful case: it separates "not
 * reconciled yet" from "no instruction in this system could have produced
 * this", and only the second is a fraud signal.
 */
export interface UnexplainedDebit extends BankStatementLine {
  statement_reference: string | null;
  candidates: MatchCandidate[];
}

export interface OutstandingPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  total_amount: string;
  currency: string | null;
  current_state: string;
  released_at: string | null;
  days_outstanding: number;
}

/** Both directions of the gap, returned together on purpose. */
export interface ReconciliationSummary {
  instructed_not_cleared: OutstandingPayment[];
  cleared_not_instructed: UnexplainedDebit[];
}

export interface BankStatementSummary {
  id: string;
  statement_reference: string;
  account_identifier: string | null;
  source_format: StatementFormat;
  statement_date: string | null;
  closing_balance: string | null;
  currency: string | null;
  /**
   * A CSV has no statement identifier of its own, so every CSV import reports
   * the same reference. The filename is the only thing telling two apart.
   */
  original_filename: string | null;
  created_at: string;
}

export interface BankStatement extends BankStatementSummary {
  tenant_id: string;
  opening_balance: string | null;
  /** SHA-256 of the imported file — the same statement cannot be imported twice. */
  file_hash: string;
  imported_by: string;
  lines: BankStatementLine[];
}
