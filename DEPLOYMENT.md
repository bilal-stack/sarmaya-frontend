# Deploying the frontend to Vercel

The frontend goes on Vercel. **The backend does not** — it needs a persistent
process and two schedulers, one of which runs every minute, and `render.yaml`
in the API repo already defines exactly that. See "Why not the backend too"
below.

Everything here is prepared and verified except the steps that need your
account, which are marked **you**.

---

## 1. Authenticate (you)

The CLI is available through `npx` — nothing to install globally.

```bash
npx vercel login
```

This opens a browser. Credentials are yours to enter; nothing in this repo
stores them.

## 2. Link the project (you, once)

```bash
npx vercel link
```

Creates `.vercel/` locally. Already covered by `.gitignore` (line 34), so
there is nothing to clean up afterwards.

## 3. Set the one environment variable that matters

```bash
npx vercel env add NEXT_PUBLIC_API_BASE_URL production
```

Give it the deployed API's base URL **including `/api/v1`**, e.g.
`https://sarmaya-api.onrender.com/api/v1`.

This is the setting most likely to be missed, and it fails quietly: the code
falls back to `http://127.0.0.1:8000/api/v1`, so a production build without it
ships a site that tries to talk to the visitor's own machine. Every request
fails in the browser with nothing in the server logs to explain it.

`NEXT_PUBLIC_` values are **inlined into the client bundle at build time**.
That means two things: it is public — never put a secret behind this prefix —
and changing it later requires a **redeploy**, not just an env update.

Repeat for `preview` if you want preview deployments pointed at a staging API.

## 4. Let the API accept the new origin

On the backend, add the Vercel domain to `CORS_ORIGINS`. It is settings-driven,
so this is configuration, not a code change.

Preview deployments get a **different URL per deployment**, so if you want
previews working against the real API you need either a wildcard-capable origin
setup or a stable preview alias. Easiest is to point previews at a staging API
whose CORS is permissive, and keep production strict.

## 5. Deploy

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

---

## What is already verified

- `npm run build` succeeds locally, including the newest pages
  (`/ai-tools/org-units`, `/ai-tools/system`). Vercel runs the same command.
- `package-lock.json` exists, so the pinned `installCommand: npm ci` will work.
  Without a lockfile `npm ci` fails outright — worth re-checking if the lockfile
  is ever deleted.
- `next.config.ts` declares remote image hosts (`placehold.co`,
  `images.unsplash.com`, `picsum.photos`). Vercel's image optimizer honours
  these; an image host added later must be added there or it 400s in production
  while working in dev.

## What `vercel.json` sets, and why

Security headers, applied to every route:

| Header | Why |
| --- | --- |
| `X-Content-Type-Options: nosniff` | Stops a browser second-guessing a declared content type. Relevant here because the app serves **downloaded CSV and HTML exports**. |
| `X-Frame-Options: DENY` | No framing. An approval UI inside somebody else's iframe is a clickjacked approval. |
| `Referrer-Policy: strict-origin-when-cross-origin` | URLs in this app carry invoice and correlation ids. Those should not leak to third parties in a `Referer`. |
| `Permissions-Policy` | Turns off camera, microphone, geolocation and payment APIs. None are used, and unused capability is attack surface. |
| `Strict-Transport-Security` | Two years, subdomains, preload-eligible. |

**No Content-Security-Policy, deliberately.** A correct CSP for a Next.js app
needs per-request nonces wired through the middleware, and a CSP guessed at
without that either breaks the app or is loose enough to be theatre. It is
worth doing properly as its own task — not as a line in this file.

`installCommand` is pinned to `npm ci` rather than left to auto-detection so
the deployed build resolves exactly the locked dependency tree, the same way
the local build did.

---

## Why not the backend too

Not a limitation of Vercel so much as a mismatch:

- **The schedulers.** `dispatch_notifications` must run every minute or nothing
  is ever delivered; `run_workflow_timers` runs hourly or no SLA is ever
  escalated. Vercel Cron's minimum frequency depends on plan — verify against
  current docs before assuming — and the per-minute job is the sticking point.
  `render.yaml` already declares both as cron services.
- **FastAPI on serverless** is possible through an ASGI adapter but is not a
  first-class path, and cold starts are a poor trait for an approvals API.

One concern that turned out **not** to apply: serverless usually means a
connection pooler, and a transaction-mode pooler breaks session-scoped
Postgres settings — which would be severe here, because tenant isolation is
enforced by an RLS GUC. It is safe: `set_tenant_context` sets that GUC
transaction-locally and re-applies it at the start of every transaction, which
is precisely the pooler-safe pattern. The crons are the blocker, not isolation.
