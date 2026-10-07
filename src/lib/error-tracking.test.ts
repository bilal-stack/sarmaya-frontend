/**
 * What a frontend error report may carry to Sentry, and what it may not.
 *
 * Run with `npm test` (plain `node --test`; Node strips the types itself, so
 * there is no test framework to install).
 *
 * The load-bearing test is the last describe block: it sends a realistic
 * event through the real Sentry SDK core with a capturing transport, because
 * the backend's version of this module found that a hook which is correct in
 * isolation can still be wired so that nothing it does reaches the wire.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  REDACTED, isDsn, isSensitiveKey, normaliseKey, scrub, scrubText,
  sharedOptions,
} from './error-tracking.ts';

const IBAN = 'GB29NWBK60161331926819';
const SECOND_IBAN = 'PK36SCBL0000001123456702';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ';
const DSN = 'https://public@o0.ingest.sentry.io/0';

describe('keys', () => {
  test('camelCase, kebab-case and snake_case normalise to the same thing', () => {
    for (const key of ['bankAccountNumber', 'bank-account-number', 'bank_account_number', 'BankAccountNumber']) {
      assert.equal(normaliseKey(key), 'bank_account_number', key);
    }
    assert.equal(normaliseKey('newIBAN'), 'new_iban');
    assert.equal(normaliseKey('mfaRecoveryCodes'), 'mfa_recovery_codes');
  });

  // Every spelling of a sensitive field that exists in the API, plus the
  // camelCase forms the components use.
  for (const key of [
    'iban', 'old_iban', 'new_iban', 'creditor_iban', 'newIban', 'newIBAN',
    'bank_account_number', 'bankAccountNumber', 'bank_account_name',
    'swift_code', 'swiftCode', 'creditor_bic', 'national_id', 'nationalId',
    'tax_id', 'taxId', 'salary', 'base_salary', 'newSalary',
    'mfa_secret', 'mfaRecoveryCodes', 'password', 'access_token', 'accessToken',
    'api_key', 'apiKey', 'authorization', 'Authorization', 'tokens', 'secrets',
    // Personal data, which a logged user object carried to the wire intact.
    'email', 'userEmail', 'work_email', 'newEmail', 'full_name', 'fullName',
    'phone', 'ip_address',
  ]) {
    test(`${key} is sensitive`, () => assert.ok(isSensitiveKey(key)));
  }

  // Close, and not. `bic` must match as a word, or the migrations table goes.
  for (const key of [
    'alembic_version', 'routing_reason', 'routingReason', 'employeeNumber',
    'correlation_id', 'correlationId', 'invoice_number', 'amount', 'publicId',
    // A vendor's or company's name is what makes a report useful.
    'name', 'vendorName', 'legal_name',
  ]) {
    test(`${key} survives`, () => assert.ok(!isSensitiveKey(key)));
  }
});

describe('free text', () => {
  test('a repr loses its values, not its shape', () => {
    assert.equal(
      scrubText(`BankChange(reason='moved', iban='${IBAN}', bankAccountNumber='31926819')`),
      `BankChange(reason='moved', iban=${REDACTED}, bankAccountNumber=${REDACTED})`,
    );
  });

  test('JSON in a logged string', () => {
    const out = scrubText('{"new_salary": 150123, "employee_number": "E-1"}');
    assert.ok(!out.includes('150123'));
    assert.ok(out.includes('"employee_number": "E-1"'));
  });

  test('an IBAN with no key is caught by shape', () => {
    assert.equal(scrubText(`pay to ${SECOND_IBAN} today`), `pay to ${REDACTED} today`);
  });

  test('an email with no key is caught by shape', () => {
    // The backend logs "SMTP delivery to <address> failed" as an error.
    assert.equal(scrubText('SMTP delivery to a.person+ap@example.co.uk failed'), `SMTP delivery to ${REDACTED} failed`);
  });

  test('a bearer token in a message is caught by shape', () => {
    // The access token lives in localStorage and rides on every API call.
    assert.equal(scrubText(`request failed: Bearer ${JWT}`), `request failed: Bearer ${REDACTED}`);
  });

  for (const text of [
    'correlation_id=abc method=POST path=/api/v1/x',
    'at 20:01:57 see https://example.com/a?b=c',
    'INV-2026-0042 for PO-123',
    '3f2b9c1e-8a7d-4e2f-9b1c-0d4e5f6a7b8c',
  ]) {
    test(`ordinary text survives: ${text}`, () => assert.equal(scrubText(text), text));
  }
});

describe('structures', () => {
  test('nested objects and arrays', () => {
    const out = scrub({ vendor: { name: 'Acme', iban: IBAN }, lines: [{ note: `to ${IBAN}` }] });
    assert.deepEqual(out, { vendor: { name: 'Acme', iban: REDACTED }, lines: [{ note: `to ${REDACTED}` }] });
  });

  test('the original is never altered by reporting it', () => {
    const state = { user: { id: 'u1', access_token: JWT } };
    scrub(state);
    assert.equal(state.user.access_token, JWT);
  });

  test('a cycle is cut, not followed forever', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    assert.deepEqual(scrub(a), { name: 'a', self: REDACTED });
  });
});

describe('turning it on', () => {
  test('no DSN means off', () => {
    assert.equal(sharedOptions({}), null);
    assert.equal(sharedOptions({ dsn: '   ' }), null);
  });

  // The values next to the DSN on Sentry's setup page are the easy ones to
  // paste instead of it.
  for (const notADsn of ['3f9a1c02e7', 'my-org', 'https://o123.ingest.sentry.io/456', 'https://key@o1.ingest.sentry.io/']) {
    test(`${notADsn} is not a DSN, and is reported`, (t) => {
      const warn = t.mock.method(console, 'warn', () => {});
      assert.equal(isDsn(notADsn), false);
      assert.equal(sharedOptions({ dsn: notADsn }), null);
      assert.equal(warn.mock.callCount(), 1);
      assert.match(String(warn.mock.calls[0].arguments[0]), /Client Keys/);
    });
  }

  test('a DSN turns it on, without personal data', () => {
    const options = sharedOptions({ dsn: DSN, nodeEnv: 'production' });
    assert.ok(options);
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.environment, 'production');
    // Absent, not 0: the SDK treats any rate as "tracing on" and starts
    // putting trace headers on every API call.
    assert.ok(!('tracesSampleRate' in options));
  });

  test('with tracing off, its integrations are removed and no URL gets trace headers', () => {
    // The Next.js browser SDK adds these whether or not a rate is set; a real
    // session's report showed every fetch carrying a span id.
    const options = sharedOptions({ dsn: DSN });
    assert.ok(options);
    const defaults = ['Breadcrumbs', 'BrowserTracing', 'SpanStreaming', 'WebVitals', 'Dedupe'].map((name) => ({ name }));
    assert.deepEqual(options.integrations(defaults).map((i) => i.name), ['Breadcrumbs', 'Dedupe']);
    assert.deepEqual(options.tracePropagationTargets, []);
  });

  test('with tracing on, nothing is removed', () => {
    const options = sharedOptions({ dsn: DSN, tracesSampleRate: '0.1' });
    assert.ok(options);
    const defaults = ['Breadcrumbs', 'BrowserTracing'].map((name) => ({ name }));
    assert.deepEqual(options.integrations(defaults), defaults);
    assert.ok(!('tracePropagationTargets' in options));
  });

  test('a laptop does not report as production', () => {
    assert.equal(sharedOptions({ dsn: DSN, nodeEnv: 'development' })?.environment, 'development');
  });

  test('a sample rate outside (0, 1] leaves tracing off entirely', () => {
    for (const rate of ['2', 'abc', '0', '-1', '']) {
      const options = sharedOptions({ dsn: DSN, tracesSampleRate: rate });
      assert.ok(options && !('tracesSampleRate' in options), rate);
    }
    assert.equal(sharedOptions({ dsn: DSN, tracesSampleRate: '0.1' })?.tracesSampleRate, 0.1);
  });
});

describe('the initialisation files', () => {
  // Checked against source, like the backend's job scripts: these are the
  // two promises the module docstring makes that no unit test can see.
  const roots = ['src', '.'];
  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.next', '.git'].includes(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (depth > 0) walk(path, depth - 1); continue; }
      if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk(roots[0], 12);
  walk(roots[1], 0);

  test('nothing turns on Session Replay', () => {
    // A call, not a mention: the init file says in a comment that it leaves
    // replay out, and a test that fails on the comment teaches people to
    // delete the comment.
    const offenders = files.filter((f) => !f.endsWith('error-tracking.test.ts'))
      .filter((f) => /\breplayIntegration\s*\(|\bnew\s+Replay\s*\(/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(offenders, [], 'replay would record screens full of bank details');
  });

  test('the server never sends stack-frame variables', () => {
    const server = readFileSync('src/sentry.server.config.ts', 'utf8');
    assert.match(server, /includeLocalVariables:\s*false/);
  });

  test('every runtime initialises through sharedOptions', () => {
    for (const f of ['src/instrumentation-client.ts', 'src/sentry.server.config.ts', 'src/sentry.edge.config.ts']) {
      assert.match(readFileSync(f, 'utf8'), /sharedOptions\(envFromProcess\(\)\)/, f);
    }
  });
});

describe('through the real SDK', () => {
  test('a realistic event leaves with nothing sensitive in it', async () => {
    const Sentry = await import('@sentry/node');
    const { createTransport, parseEnvelope } = await import('@sentry/core');

    const sent: Record<string, unknown>[] = [];
    const options = sharedOptions({ dsn: DSN });
    assert.ok(options);
    Sentry.init({
      ...options,
      defaultIntegrations: false,
      transport: (transportOptions) => createTransport(transportOptions, async (request) => {
        const [, items] = parseEnvelope(request.body);
        for (const [header, payload] of items) {
          if ((header as { type?: string }).type === 'event') sent.push(payload as Record<string, unknown>);
        }
        return { statusCode: 200 };
      }),
    });
    try {
      Sentry.setUser({ id: 'user-uuid-1' });
      Sentry.addBreadcrumb({ category: 'console', message: `Bank change requested to ${IBAN}` });
      Sentry.addBreadcrumb({
        category: 'console', message: 'saving',
        data: { arguments: [{ bankAccountNumber: '31926819', vendorName: 'Acme' }] },
      });
      // Exactly what the app's own session object looks like when logged.
      Sentry.addBreadcrumb({
        category: 'console', message: 'session restored',
        data: { arguments: [{ id: 'user-uuid-1', email: 'admin@demo.com', full_name: 'Administrator', access_token: JWT }] },
      });
      Sentry.captureException(new Error(`save failed for Bearer ${JWT}`), {
        extra: { storedUser: { id: 'user-uuid-1', email: 'a@b.co', access_token: JWT } },
      });
      await Sentry.flush(2000);
    } finally {
      await Sentry.close(2000);
    }

    assert.equal(sent.length, 1, 'expected exactly one event');
    const blob = JSON.stringify(sent[0]);
    for (const leak of [JWT, IBAN, '31926819', 'admin@demo.com', 'Administrator', 'a@b.co']) {
      assert.ok(!blob.includes(leak), `${leak.slice(0, 12)}... reached the transport`);
    }
    // And still useful: the breadcrumb is there, the vendor name survived,
    // the user is an id.
    assert.ok(blob.includes('Bank change requested to'));
    assert.ok(blob.includes('Acme'));
    assert.deepEqual((sent[0] as { user?: unknown }).user, { id: 'user-uuid-1' });
  });
});
