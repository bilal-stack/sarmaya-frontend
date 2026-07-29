/**
 * Parsing timestamps that come back from the API.
 *
 * The backend stores governance timestamps in tz-naive UTC columns, so FastAPI
 * serialises them without an offset: "2026-08-06T10:00:00". JavaScript reads a
 * date-time in that form as *local* time, which silently shifts every value by
 * the viewer's UTC offset. On these screens that is not cosmetic — it is the
 * difference between an SLA showing "due in 5 hours" and being overdue, or a
 * delegation reading "Scheduled" while the server is already honouring it.
 *
 * `parseApiDate` treats an offset-less timestamp as UTC, and leaves anything
 * already carrying a `Z` or a numeric offset alone.
 */

const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseApiDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const raw = value.trim();
  // A date-only value ("2026-08-06") is already parsed as UTC by the spec.
  const needsUtc = raw.includes('T') && !HAS_OFFSET.test(raw);
  return new Date(needsUtc ? `${raw}Z` : raw);
}

/**
 * Format a Date for an `<input type="datetime-local">`.
 *
 * The input reads and writes *local* wall-clock time, so the obvious
 * `toISOString().slice(0, 16)` is wrong: it produces UTC, which the input then
 * interprets as local and shifts by the viewer's offset. Prefilling "now" that
 * way gives a window starting hours from where the user thinks it does.
 */
export function toDateTimeLocalValue(date: Date): string {
  const localMs = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localMs).toISOString().slice(0, 16);
}
