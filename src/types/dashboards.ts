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
