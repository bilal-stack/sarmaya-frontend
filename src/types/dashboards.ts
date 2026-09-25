/**
 * The seven global dashboards (Build Book lines 265-272).
 *
 * Every figure is computed from history the system already keeps — the audit
 * trail, the invoices, the bank lines — rather than from counters written at
 * the time, because a counter can drift from the events it counts and the
 * trail cannot.
 */

export interface StuckReason {
  reason: string;
  count: number;
  amount: number;
  oldest_days: number;
  /** Why this is stuck, in a sentence a person can act on. */
  note: string;
  link: string;
}

export interface ControlRoom {
  total_amount_stuck: number;
  total_items_stuck: number;
  blocked: StuckReason[];
  paid_last_30_days: { runs: number; amount: number };
}

export interface RoleCycleTime {
  step: string;
  role: string;
  decisions: number;
  /** Reported beside the average because one three-week outlier drags a mean
   *  somewhere no real invoice ever was. */
  median_hours: number;
  average_hours: number;
  slowest_hours: number;
}

export interface AgeBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface Bottlenecks {
  window_days: number;
  by_role: RoleCycleTime[];
  still_waiting: AgeBucket[];
}

export interface ExceptionsHeatmap {
  window_days: number;
  total: number;
  by_reason: Array<{ reason: string; count: number }>;
  by_vendor: Array<{ vendor: string; count: number }>;
}

export interface InvoiceThroughput {
  window_days: number;
  captured: number;
  settled: number;
  capture_to_paid_hours: { mean: number | null; median: number | null };
  rework_events: number;
  /** One invoice rejected three times is three events and one affected
   *  invoice. The rate below is over invoices, so it stays readable. */
  invoices_reworked: number;
  rework_rate_pct: number;
  rework_drivers: Array<{ reason: string; count: number }>;
  /** Always null. Three-way match is computed on demand and never stored, so
   *  what an invoice matched when it was approved cannot be recovered. */
  match_rate_pct: number | null;
}

export interface PaymentRunStatus {
  window_days: number;
  by_state: Array<{ state: string; count: number; value: number }>;
  awaiting_bank_file: Array<{
    payment_number: string;
    value: number;
    released_at: string | null;
  }>;
  unreconciled_after_release: Array<{
    payment_number: string;
    value: number;
    released_at: string | null;
    age_days: number | null;
  }>;
  rejected: Array<{
    payment_number: string;
    value: number;
    reason: string | null;
  }>;
  /** Figures the system deliberately does not report, with the reason. A zero
   *  would be read as "none failed" rather than "we cannot see". */
  not_reported: { failed: string; reissued: string };
}

export interface DuplicateAnomaly {
  window_days: number;
  flagged: number;
  paid_anyway: number;
  still_held: number;
  stopped: number;
  /** What the flag actually held back — not a claim that each would have been
   *  paid twice. See the service docstring. */
  value_held_back: number;
  value_paid_anyway: number;
  watchlist: Array<{
    category: string;
    severity: string;
    count: number;
    acknowledged: number;
    open: number;
  }>;
}

/** Attempts the controls refused. Unlike every other report here, an empty
 *  result is the good outcome — see the panel's own note. */
export interface SodViolations {
  window_days: number;
  total_blocked: number;
  /** Segregation failures specifically, kept apart from clerical blocks so a
   *  rise in missing vendor links cannot read as attempted self-dealing. */
  sod_blocked: number;
  other_blocked: number;
  by_reason: Array<{
    reason: string;
    label: string;
    is_sod: boolean;
    count: number;
  }>;
  by_person: Array<{ who: string; count: number; sod_count: number }>;
  by_object_type: Array<{ object_type: string; count: number }>;
  recent: Array<{
    action: string;
    reason: string;
    label: string;
    is_sod: boolean;
    who: string | null;
    object_type: string;
    object_id: string | null;
    at: string | null;
  }>;
}

export interface PolicyOverrides {
  window_days: number;
  total: number;
  by_person: Array<{ who: string; count: number; amount: number }>;
  recent: Array<{
    action: string;
    who: string | null;
    reason: string | null;
    amount: number;
    at: string | null;
  }>;
}

export interface EvidenceCompleteness {
  invoices: number;
  missing_document: number;
  missing_document_pct: number;
  breached_sla: number;
  unreviewed_watchlist_alerts: number;
  completeness_pct: number;
}

export interface ReconciliationHealth {
  unexplained_count: number;
  unexplained_amount: number;
  matched_count: number;
  match_rate_pct: number;
  aging: AgeBucket[];
}

export interface AutopilotHealth {
  window_days: number;
  auto_approved: number;
  reverted: number;
  /** Read with auto_approved or not at all. */
  reversal_rate_pct: number;
  ai_calls_by_status: Record<string, { count: number; avg_confidence: number }>;
  schema_failures: number;
}

export interface DashboardOverview {
  control_room: ControlRoom;
  approval_bottlenecks: Bottlenecks;
  exceptions: ExceptionsHeatmap;
  policy_overrides: PolicyOverrides;
  evidence: EvidenceCompleteness;
  reconciliation: ReconciliationHealth;
  autopilot: AutopilotHealth;
}


/**
 * The control matrices.
 *
 * A view of rules that already exist and are already enforced. The value is
 * not the list — it is what the grid makes visible that a list does not: an
 * amount band no rule covers, a rule that can never fire, and a role holding
 * both halves of a separation.
 */

export interface ApprovalRule {
  policy_name: string;
  threshold: number;
  operator: string;
  required_role: string;
}

export interface ApprovalBand {
  amount: number;
  /** null when nothing matched — routing falls through to a split hardcoded
   *  in policy.py that nobody configured and nobody can see on the policy
   *  screen. */
  required_role: string | null;
  decided_by: string | null;
  falls_back: boolean;
}

export interface ApprovalMatrix {
  rules: ApprovalRule[];
  bands: ApprovalBand[];
  gaps: ApprovalBand[];
  /** Active, configured, and decides nothing: something above it always
   *  matches first. */
  unreachable_rules: string[];
  roles_used: string[];
  /** Always null. The Build Book asks for role x amount x category and the
   *  rule config carries no category, so the axis does not exist. Reported
   *  rather than quietly omitted. */
  category_axis: null;
}

export type Barrier = 'none' | 'runtime_check' | 'permissions';

export interface SodRuleRow {
  rule: string;
  control: string;
  first_action: string;
  /** null when the first half is an identity rather than a permission — being
   *  the employee a claim is for is not something a role grants. */
  first_permission: string | null;
  second_action: string;
  second_permission: string;
  admin_exempt: boolean;
  enforced_at: string;
  roles_holding_both: string[];
  roles_first_only: string[];
  roles_second_only: string[];
  roles_with_no_barrier: string[];
  ordinary_roles_holding_both: string[];
  weakest_barrier: Barrier;
}

export interface SodMatrix {
  roles: string[];
  rules: SodRuleRow[];
  /** True of every row, so it is stated once here rather than repeated. */
  admin_holds_every_permission: boolean;
  unblocked_for_admin: string[];
  depends_on_the_runtime_check: Array<{ rule: string; roles: string[] }>;
  separated_by_permissions: string[];
}


/** CFO / Finance Director. */

export interface PayableBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface FunnelStage {
  stage: string;
  label: string;
  /** What this stage means in a sentence somebody can act on. */
  note: string;
  count: number;
  amount: number;
}

export interface ApAging {
  as_of: string;
  total_payable: number;
  total_overdue: number;
  overdue_pct: number;
  /** Aged against the due date, not against how long the record has sat. */
  aging: PayableBucket[];
  /** Reported separately rather than bucketed as "not yet due": the column is
   *  nullable, and a payable nobody can chase is itself the finding. */
  no_due_date: { count: number; amount: number };
  funnel: FunnelStage[];
  most_overdue: Array<{
    invoice_id: string;
    invoice_number: string;
    vendor: string | null;
    amount: number;
    days_overdue: number;
    state: string;
  }>;
}

export interface SpendSlice {
  key: string;
  count: number;
  amount: number;
}

export interface SpendAnalytics {
  window_days: number;
  since: string;
  total_spend: number;
  invoice_count: number;
  by_vendor: SpendSlice[];
  vendor_count: number;
  /** Negotiating position on one side, single-supplier exposure on the other.
   *  null below six vendors, where it is always 100% by arithmetic and so says
   *  nothing about concentration. */
  top_5_vendor_share_pct: number | null;
  by_gl_account: SpendSlice[];
  by_cost_centre: SpendSlice[];
  by_month: SpendSlice[];
  /** Kept in the denominator and named, so the breakdown cannot read as
   *  complete while describing only the well-behaved fraction. */
  unclassified: {
    no_gl_account: number;
    no_gl_account_pct: number;
    no_cost_centre: number;
    no_cost_centre_pct: number;
  };
  /** Always null — invoices carry no category, so there is nothing to chart. */
  by_category: null;
}


/** Procurement Leadership. */

export interface RfqStage {
  stage: string;
  /** A human name for the stage. The `from`/`to` fields below are raw audit
   *  action names — internal vocabulary, kept so somebody reconciling against
   *  the trail can see what was measured, not for display. */
  label: string;
  from: string;
  to: string;
  /** Whether this stage is a delay we own or a window we chose to give
   *  vendors. The distinction matters: reading the vendor window as a delay
   *  pushes a buyer to shorten the time suppliers get, which is the opposite
   *  of the improvement. */
  note: string;
  count: number;
  /** null when nothing completed this stage in the window — not zero, which
   *  would read as instantaneous. */
  median_days: number | null;
  worst_days: number | null;
}

export interface RfqCycleTime {
  window_days: number;
  rfq_count: number;
  stages: RfqStage[];
  competition: {
    invited: number;
    quoted: number;
    response_rate_pct: number;
    /** Awarded on one quote or none. Not necessarily wrong — sole supply is
     *  real — but it is the case a cycle-time average never surfaces. */
    single_quote_awards: number;
    awarded_with_competition: number;
  };
  savings: {
    awarded_value: number;
    /** Against the requisition estimate: what somebody committed to in
     *  writing before any vendor quoted. */
    vs_estimate: number | null;
    vs_estimate_pct: number | null;
    /** Against the highest compliant quote on the same RFQ: the worst
     *  alternative actually on the table. null when no award had one. */
    vs_highest_quote: number | null;
    vs_highest_quote_pct: number | null;
    /** Awarded on a single compliant quote, so there was nothing to save
     *  against. Counted rather than folded in at zero. */
    awards_with_no_comparison: number;
  };
  overdue_open: Array<{
    rfq_id: string;
    rfq_number: string;
    closed_days_ago: number;
  }>;
}


/** COO / Supply Chain. */

export interface InventoryTurns {
  window_days: number;
  since: string;
  cogs: number;
  /** Reconstructed exactly by subtracting the window's net movements from the
   *  current balance — possible only because the movement ledger is
   *  append-only. */
  opening_value: number;
  closing_value: number;
  average_value: number;
  /** null when there is no stock to turn. Zero would read as stock sitting
   *  dead, which is a different problem from having none. */
  turns_per_year: number | null;
  days_of_stock: number | null;
  /** How much of the warehouse the figures above do not cover. Items with no
   *  standard cost fall outside every number here — excluding them and costing
   *  them at zero give the identical ratio, so this is disclosure rather than
   *  protection against a distorted figure. */
  uncosted: { item_count: number; units_on_hand: number };
}

export interface P2PStep {
  step: string;
  label: string;
  /** `object_type.action` from the audit trail. Kept for reconciliation, not
   *  for display. */
  from: string;
  to: string;
  count: number;
  median_days: number | null;
  worst_days: number | null;
}

export interface P2PCycleTime {
  window_days: number;
  chains_seen: number;
  steps: P2PStep[];
  /** The sum of the medians, not the median of the totals. No single purchase
   *  necessarily took this long. */
  typical_total_days: number | null;
  slowest_step: string | null;
}

/**
 * Workflow configuration.
 *
 * A state machine per record type. The backend validates that a transition
 * target exists, but not that the graph stays connected — so a non-final state
 * can be left with no way out, and records that reach it stop there. The
 * settings screen computes that and says so; nothing else in the system would.
 */

export interface WorkflowState {
  id: string;
  workflow_type: string;
  state_name: string;
  display_name: string | null;
  state_order: number;
  is_initial: boolean;
  is_final: boolean;
  allowed_transitions: string[];
  /** Permissions required to leave this state, keyed by target. Set in code,
   *  not configuration — shown read-only so the screen does not imply
   *  otherwise. */
  guards: Record<string, string[]>;
  /** `{}` when none. `hours` alone tracks overdue; `escalate_to` needs hours. */
  sla: { hours?: number; escalate_to?: string };
  color: string | null;
}
