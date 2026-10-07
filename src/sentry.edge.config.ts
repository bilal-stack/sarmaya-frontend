/**
 * Error tracking in the edge runtime (middleware, edge routes). Inert unless
 * NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/nextjs';

import { envFromProcess, sharedOptions } from '@/lib/error-tracking';

const options = sharedOptions(envFromProcess());
if (options) {
  Sentry.init(options);
}
