/**
 * Error tracking: what reaches Sentry from the browser and the Next server,
 * and — more carefully — what does not.
 *
 * The rules mirror the backend's app/core/error_tracking.py, where every one
 * of them was found by capturing real events rather than assumed. There, the
 * SDK's defaults shipped a caller's bearer token on every 500. The browser has
 * its own versions of the same risks, so the same rules apply here:
 *
 * **Off unless NEXT_PUBLIC_SENTRY_DSN is set.** Nothing initialises and
 * nothing is sent.
 *
 * **No Session Replay, ever.** Replay records the screen, and the screens in
 * this application are invoices, bank details, salaries and payment runs.
 * Masking settings are a promise about every element on every page, including
 * ones not written yet; leaving replay out is a promise about none.
 *
 * **Scrubbed by name and by shape.** Sentry's own scrubbing knows a short list
 * of key names and matches them exactly. This domain spells IBAN five ways in
 * snake_case on the API and again in camelCase in the components, so keys are
 * matched by the words they are built from, after splitting camelCase. Values
 * with no key at all — an IBAN in an error message, an access token in a
 * logged string — are caught by shape.
 *
 * No Sentry import in this file, deliberately: it is the part worth testing,
 * and the tests run under plain `node --test` with no SDK in the way.
 */

/** Sentry's own marker, so a value removed here looks like one it removed. */
export const REDACTED = '[Filtered]';

/**
 * Whole words in a key that mark its value as sensitive. A trailing "s" is
 * ignored, so `tokens` and `secrets` count. Whole words rather than
 * substrings, so `alembic_version` survives `bic`.
 */
const SENSITIVE_WORDS = new Set([
  'iban', 'swift', 'bic', 'salary', 'totp', 'otp', 'password', 'passwd',
  'secret', 'token', 'authorization', 'cookie',
  // Personal data. Found by sending a real session to a local stand-in for
  // Sentry: a logged user object reached the wire with its email and full
  // name intact, because sendDefaultPii governs what the SDK collects, not
  // what the application logs. Bare `name` is deliberately absent - here it
  // is nearly always a vendor's or a company's, which is what makes a report
  // useful.
  'email', 'phone', 'ip',
]);

/** Multi-word fragments, matched as substrings of the normalised key. */
const SENSITIVE_PHRASES = [
  'account_number', 'bank_account', 'national_id', 'tax_id',
  'recovery_code', 'mfa_secret', 'routing_number', 'sort_code',
  'api_key', 'apikey', 'private_key',
  'full_name', 'first_name', 'last_name',
];

/** An IBAN by shape. Upper-case only, as IBANs are stored and printed. */
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

/**
 * A JWT by shape: three base64url segments, the first beginning `eyJ` (that
 * is `{"` encoded). The access token lives in localStorage and rides on every
 * API call, so it is the value most likely to end up in a logged string.
 */
const JWT = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;

/** An email address by shape, for one that arrives with no key at all. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** `name=value` or `"name": value` inside free text. */
const KEY_VALUE =
  /(["']?[A-Za-z_][A-Za-z0-9_]*["']?)(\s*[=:]\s*)('[^']*'|"[^"]*"|[^\s,;)}\]]+)/g;

/** `bankAccountNumber`, `bank-account-number` and `bank_account_number` alike. */
export function normaliseKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[-.\s]+/g, '_');
}

export function isSensitiveKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const normalised = normaliseKey(key);
  if (SENSITIVE_PHRASES.some((phrase) => normalised.includes(phrase))) return true;
  return normalised.split('_').some(
    (word) => SENSITIVE_WORDS.has(word)
      || (word.endsWith('s') && SENSITIVE_WORDS.has(word.slice(0, -1))),
  );
}

/** Remove sensitive values from free text, by name and by shape. */
export function scrubText(text: string): string {
  return text
    .replace(KEY_VALUE, (match, key: string, sep: string) => (
      isSensitiveKey(key.replace(/^["']|["']$/g, '')) ? `${key}${sep}${REDACTED}` : match
    ))
    .replace(JWT, REDACTED)
    .replace(EMAIL, REDACTED)
    .replace(IBAN, REDACTED);
}

/**
 * Walk anything an event can contain. Returns a new structure, so whatever
 * the caller still holds — component state, a logged object — is never
 * altered by the act of reporting it. Cycles are cut rather than followed.
 */
export function scrub<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (typeof value === 'string') return scrubText(value) as T;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return REDACTED as T;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, seen)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrub(inner, seen);
  }
  return out as T;
}

/**
 * Sentry's beforeSend. Walks the whole event — breadcrumbs included, since a
 * breadcrumb only leaves the browser inside an event. The backend tried a
 * separate breadcrumb hook and removed it, because no test could tell it was
 * there.
 */
export function beforeSend<E>(event: E): E {
  return scrub(event);
}

/**
 * A DSN by shape: `https://<key>@<host>/<project-id>`. Checked so a pasted
 * org slug or project id is reported, rather than handed to the SDK, which
 * would log a warning nobody reads and quietly report nothing.
 */
export function isDsn(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && url.username.length > 0
      && /^\/\d+$/.test(url.pathname);
  } catch {
    return false;
  }
}

/** What the SDK loads to trace, as named in a real browser session's report. */
const TRACING_INTEGRATIONS = new Set(['BrowserTracing', 'SpanStreaming', 'WebVitals']);

export interface ErrorTrackingEnv {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: string;
  nodeEnv?: string;
}

/**
 * The options every runtime shares — browser, Node server and edge — in one
 * place a reviewer can read. Returns null when error tracking is off.
 *
 * Takes its environment as an argument rather than reading process.env, so
 * the browser bundle's inlined NEXT_PUBLIC_ values and a test's values go
 * through exactly the same code.
 */
export function sharedOptions(env: ErrorTrackingEnv) {
  const dsn = env.dsn?.trim();
  if (!dsn) return null;
  if (!isDsn(dsn)) {
    // Loud, and once: the value was set, so somebody meant to turn this on.
    console.warn(
      'NEXT_PUBLIC_SENTRY_DSN is set but is not a DSN, so error tracking is '
      + 'off. It is a URL of the form https://<public-key>@o<org-id>.ingest.'
      + '<region>.sentry.io/<project-id> - in Sentry: Settings, Projects, '
      + '<project>, Client Keys (DSN).',
    );
    return null;
  }
  const rate = Number(env.tracesSampleRate);
  const tracing = Number.isFinite(rate) && rate > 0 && rate <= 1;
  return {
    dsn,
    environment: env.environment?.trim()
      || (env.nodeEnv === 'production' ? 'production' : 'development'),
    release: env.release?.trim() || undefined,
    // Errors only by default — tracing is a separate quota on the free plan.
    // Omitted rather than set to 0, because the SDK treats ANY rate, zero
    // included, as "tracing on": it loads the tracing instrumentation and
    // starts attaching sentry-trace and baggage headers to every API call,
    // then samples none of it. Absent, none of that loads.
    ...(tracing ? { tracesSampleRate: rate } : {}),
    // Omitting the rate is not enough on its own. The Next.js browser SDK adds
    // its tracing integrations by default regardless - found by reading what a
    // real session sent, where every fetch breadcrumb carried a span id. With
    // tracing off they are removed, and trace headers go to no URL at all.
    integrations: <T extends { name: string }>(defaults: T[]): T[] => (
      tracing ? defaults : defaults.filter((i) => !TRACING_INTEGRATIONS.has(i.name))
    ),
    ...(tracing ? {} : { tracePropagationTargets: [] }),
    // No IP addresses, cookies or user headers.
    sendDefaultPii: false,
    beforeSend,
    // Same treatment for performance events, for whoever turns tracing up:
    // spans carry their own text — a URL, a query — and need it too.
    beforeSendTransaction: beforeSend,
  };
}

/** The environment as Next exposes it. NEXT_PUBLIC_ values are inlined at build. */
export function envFromProcess(): ErrorTrackingEnv {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    nodeEnv: process.env.NODE_ENV,
  };
}
