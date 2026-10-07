'use client';

/**
 * The last resort: an error thrown while rendering the root layout itself.
 *
 * React catches render errors before any global handler sees them, so without
 * this file a crash here would show Next's default error page and report
 * nothing. It replaces the root layout when it renders, which is why it brings
 * its own <html> and <body>.
 */
import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* Next's own generic error page; it says nothing about the cause. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
