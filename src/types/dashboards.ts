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
