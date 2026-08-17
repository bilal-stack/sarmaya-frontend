/**
 * Types for the governance surfaces (Decision Inbox, next-action agent,
 * Live Audit Mode). These mirror the backend response shapes exactly — see
 * ENDPOINTS.md → "Post-MVP Governance & AI Endpoints".
 */

// --- Decision Inbox ---------------------------------------------------------

export type InboxCategory =
  | 'duplicate_review'
  | 'vendor_verification'
  | 'approval'
  | 'requisition_approval'
  | 'sourcing_award'
  | 'purchase_order_approval'
  | 'payment_release'
  | 'vendor_bank_change'
  | 'unexplained_debit';

/** The Build Book's own vocabulary for what kind of work an item is. */
export type WorkItemType =
  | 'approval'
  | 'exception'
  | 'review'
  | 'reconciliation'
  | 'admin';

/**
 * Items are no longer invoice-shaped. Every module contributes to the inbox, so
 * the identity fields are neutral (`object_type`/`reference`) and each item
 * carries the link to open it — the reader no longer builds URLs per category.
 */
export interface DecisionInboxItem {
  category: InboxCategory;
  work_item_type: WorkItemType;
  priority: number;          // lower sorts first
  action: string;            // human label for the next step
  reason: string;            // why this needs attention now
  object_type: string;       // 'invoice' | 'requisition' | 'payment' | ...
  object_id: string;
  reference: string | null;  // the number a person would quote
  subtitle: string | null;   // vendor, title, counterparty — whatever identifies it
  amount: number;
  current_state: string | null;
  required_role: string | null;
  detail_url: string;
  timeline_url: string;
  sla_due_at: string | null;
  overdue: boolean;
  escalated: boolean;        // visible to you because the SLA was breached
}

export interface DecisionInbox {
  total: number;
  counts: Record<string, number>;
  by_work_item_type: Partial<Record<WorkItemType, number>>;
  overdue_count: number;
  items: DecisionInboxItem[];
}

export interface EscalationResult {
  escalated_count: number;
  items: Array<{
    invoice_id: string;
    invoice_number: string | null;
    state: string;
    escalated_to: string;
    sla_due_at: string | null;
  }>;
}

// --- Next-action agent ------------------------------------------------------

/**
 * The agent SUGGESTS; it never executes. The UI must render this as a
 * recommendation and route the user to the real action endpoint.
 */
export type NextAction =
  | 'review_extraction'
  | 'fix_missing_fields'
  | 'validate'
  | 'submit_for_approval'
  | 'resolve_duplicate'
  | 'verify_vendor'
  | 'approve'
  | 'mark_paid'
  | 'revise'
  | 'none';

export interface NextActionSuggestion {
  invoice_id: string;
  action: NextAction;
  confidence: number;
  reasoning: string;
  signals: string[];          // explainability trace — show this
  required_role: string | null;
  source: 'rules' | 'ai';
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
}

// --- Live Audit Mode --------------------------------------------------------

export interface AuditTimelineEvent {
  timestamp: string;
  action: string;
  summary: string;
  actor: string | null;
  actor_role: string | null;
  workflow_step: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  comment: string | null;
  document_hash: string | null;
  ai_assisted: boolean;
  ai_confidence: number | null;
}

export interface AuditTimeline {
  object_type: string;
  object_id: string;
  current_state: string | null;
  policy_reason: string | null;
  total_events: number;
  events: AuditTimelineEvent[];
}

export interface AuditChainVerification {
  object_type: string;
  object_id: string;
  total_events: number;
  verified: boolean;
  broken_at_index: number | null;
  detail: string | null;
}
