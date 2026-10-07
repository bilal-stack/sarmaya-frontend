/**
 * Error tracking in the browser. Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
 *
 * Every option that matters is in src/lib/error-tracking.ts, shared with the
 * server and edge runtimes, so the three cannot drift apart. What is
 * deliberately absent here is the point of this file:
 *
 *   * No replayIntegration. Session Replay records the screen, and the screens
 *     here are invoices, bank details, salaries and payment runs.
 *   * No feedbackIntegration. A widget that sends free text a user typed next
 *     to their payroll is not a feature this needs.
 *
 * The defaults that remain are error handlers, breadcrumbs (console, clicks,
 * fetch, navigation), de-duplication and the page URL and user agent. All of
 * it passes through the scrubber before it leaves.
 */
import * as Sentry from '@sentry/nextjs';

import { envFromProcess, sharedOptions } from '@/lib/error-tracking';

const options = sharedOptions(envFromProcess());
if (options) {
  Sentry.init(options);
}

/** Tells Sentry which route a navigation went to. A no-op while it is off. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
