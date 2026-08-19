/**
 * The notification outbox.
 *
 * Messages are queued in the same transaction as the action that produced
 * them and delivered afterwards by a scheduler, so nothing is sent from a
 * request. These types are for watching that the queue is actually moving —
 * a stalled one means approval requests and SLA escalations are going
 * nowhere, silently.
 */

export type QueueStatus = 'pending' | 'sent' | 'failed';

export interface QueuedMessage {
  id: string;
  to_email: string;
  subject: string;
  /** What produced it: sla_escalation, watchlist, awaiting_action, … */
  category: string | null;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  /** Earliest the next try may run — backoff is stored, not held in memory. */
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface DispatchResult {
  attempted: number;
  sent: number;
  /** Gave up after the attempt limit. */
  failed: number;
  /** Failed this time, queued for another go. */
  retrying: number;
  /** Not attempted at all because SMTP is switched off. */
  held: number;
}

export type QueueSummary = Record<QueueStatus, number>;


/**
 * One thing you were told. Yours only — the API scopes these to the caller,
 * and there is no role that grants reading somebody else's.
 */
export interface MyNotification {
  id: string;
  subject: string;
  body: string;
  category: string | null;
  /** Where it points. The Decision Inbox stays the system of record. */
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface MyNotificationFeed {
  unread: number;
  items: MyNotification[];
}
