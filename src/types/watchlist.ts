/**
 * Change watchlist — the three kinds of change that move money, or move the
 * rules deciding who may send it, without touching a single invoice.
 *
 * Mirrors the backend (ENDPOINTS.md → "Change Watchlist"). All three are
 * audited already; the audit trail answers "what happened to this record" for
 * somebody who has already decided to look at that record, and none of these
 * give anyone a reason to look.
 */

export type AlertCategory =
  | 'vendor_bank_change'
  | 'master_data_edit'
  | 'policy_override';

export type AlertSeverity = 'high' | 'medium';

export interface WatchlistAlert {
  id: string;
  tenant_id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  object_type: string;
  object_id: string;
  summary: string;
  /**
   * Before/after where there is one. Shape varies by category: a bank change
   * carries {event, vendor, old_iban, new_iban} with the accounts masked; the
   * other two carry {before: {...}, after: {...}}.
   */
  detail: Record<string, any> | null;
  /** Who caused the change. They cannot acknowledge their own alert. */
  actor_id: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgement_note: string | null;
  created_at: string;
}

export interface WatchlistFeed {
  open_count: number;
  items: WatchlistAlert[];
}
