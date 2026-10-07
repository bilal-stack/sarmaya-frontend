import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-toast',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

// Build-time Sentry: source map upload, so a minified stack trace in an issue
// reads as the original TypeScript. Runtime error reporting does not depend on
// any of this - it is configured in src/lib/error-tracking.ts and is off
// unless NEXT_PUBLIC_SENTRY_DSN is set.
//
// Upload needs SENTRY_AUTH_TOKEN, a secret for the build environment only (a
// Sentry "organization token", Settings > Auth Tokens). Without it the build
// skips the upload and succeeds, which is what CI and local builds do.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'bilal-bk',
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    // Uploaded to Sentry, then removed from the build output, so the original
    // source is not served to anyone who asks the site for a .map file.
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: true,
  // The build plugin otherwise reports anonymous usage data to Sentry.
  telemetry: false,
  silent: !process.env.CI,
});
