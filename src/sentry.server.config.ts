/**
 * Error tracking in the Next.js server runtime: server rendering and route
 * handlers. Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/nextjs';

import { envFromProcess, sharedOptions } from '@/lib/error-tracking';

const options = sharedOptions(envFromProcess());
if (options) {
  Sentry.init({
    ...options,
    // Stated rather than left to the default. The backend's version of this
    // found that stack-frame locals shipped a caller's bearer token on every
    // 500, through a request object whose headers no key-based scrubber could
    // see. The Node SDK defaults this to off today; this line, and the test
    // that checks for it, keep it off if that ever changes.
    includeLocalVariables: false,
  });
}
