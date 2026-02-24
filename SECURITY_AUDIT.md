## Security Audit: Next.js 16 + Docker Self-Hosting

Comprehensive security audit of the streamystats codebase against Next.js 16 and Docker self-hosting best practices. Findings organized by severity.

---

## CRITICAL

### 1. No Security Headers (CSP, HSTS, X-Frame-Options)

**No middleware.ts exists.** No Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy headers are set anywhere — not in middleware, not in `next.config.mjs`, not via a library like `@nosecone/next`.

The app is fully open to XSS, clickjacking, MIME sniffing, and protocol downgrade attacks.

**Files:** `apps/nextjs-app/middleware.ts` (missing), `apps/nextjs-app/next.config.mjs`

### 2. No Rate Limiting Anywhere

Zero rate limiting across the entire application:
- No rate limiting library installed
- No middleware-level throttling
- No reverse proxy rate limiting (no nginx/caddy/traefik config exists)
- Auth endpoints, AI chat, search, import, and all 27 Server Actions are unprotected

Specific attack vectors:
- `/api/chat`: spawn hundreds of concurrent 60-second AI requests
- `/api/servers` POST: unlimited registration attempts
- `/api/search`: expensive DB queries with no per-user limits
- `/api/import`: accepts up to 500MB body with no rate limit

**Files:** `apps/nextjs-app/next.config.mjs:21`, all `app/api/` routes

### 3. No Reverse Proxy — Direct Internet Exposure

Next.js listens directly on `0.0.0.0:3000` with no reverse proxy. Both `docker-compose.yml` and `docker-compose.aio.yml` map port 3000 directly to the host.

Consequences:
- No TLS termination (all traffic is plaintext HTTP)
- No WAF protection against known CVE exploit patterns
- No request filtering or header sanitization
- `X-Forwarded-Proto` header trusted from any source without validation
- Session cookies default to non-secure

**Files:** `docker-compose.yml:27`, `docker-compose.aio.yml:19`, `lib/secure-cookies.ts`, `DOCKERLESS.md`

### 4. server-only Boundary Not Enforced

The `server-only` package is not listed in any package.json. Only 4 of 25+ `lib/db/` files have `import 'server-only'`. Multiple client components directly import server-side database functions:

- `components/UserMenu.tsx` imports `logout` from `lib/db/users`
- `components/SideBar.tsx` imports `getUser` from `lib/db/users`
- `components/MarkAsWatchedMenuItem.tsx` imports 4 functions from `lib/db/mark-watched`
- `components/DynamicBreadcrumbs.tsx` imports `getUserById` from `lib/db/users`

**Files:** `components/UserMenu.tsx`, `components/SideBar.tsx`, `components/MarkAsWatchedMenuItem.tsx`, `components/DynamicBreadcrumbs.tsx`, all `lib/db/*.ts`

### 5. Dockerfile.aio Runs Everything as Root with Hardcoded Credentials

`Dockerfile.aio` runs the entire container as root via supervisord. Hardcoded default credentials are baked into the image:

```
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/streamystats
```

**Files:** `Dockerfile.aio:116-127`, `Dockerfile.aio:139`, `docker/aio/supervisord.conf:3`

### 6. No NEXT_SERVER_ACTIONS_ENCRYPTION_KEY Configured

This env var is not referenced anywhere in the project. Without it, Next.js generates a new encryption key per build, breaking rolling deployments and Server Action payload integrity.

**Files:** `docker-compose.yml`, `docker-compose.aio.yml`, `.env.example`

### 7. SESSION_SECRET Falls Back to Hardcoded String

Both `proxy.ts` and `lib/session.ts` fall back to `"fallback-dev-secret-change-in-production"` when `SESSION_SECRET` is not set:

```typescript
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "fallback-dev-secret-change-in-production",
);
```

This fallback is discoverable in source code. An attacker can forge valid JWT session cookies (containing user ID, admin status, server ID) and gain full admin access if `SESSION_SECRET` is not configured. The fallback should be replaced with an explicit error throw.

**Files:** `apps/nextjs-app/proxy.ts:23-25`, `apps/nextjs-app/lib/session.ts:7-9`

---

## HIGH

### 8. Dangerous next.config.mjs Settings

- `images.remotePatterns` allows `*` hostname on both HTTP and HTTPS — potential SSRF vector
- `images.dangerouslyAllowLocalIP: true` — allows image optimization requests to local/private IPs
- `serverActions.bodySizeLimit: "500mb"` — DoS vector
- No `allowedOrigins` for Server Actions CSRF protection
- No `deploymentId` for version skew protection

**Files:** `apps/nextjs-app/next.config.mjs`

### 9. Job Server Dockerfile Runs as Root

`apps/job-server/Dockerfile` has no `USER` directive. Also uses floating base image tag `debian:stable-slim`.

**Files:** `apps/job-server/Dockerfile:34`

### 10. No Container Image Vulnerability Scanning in CI/CD

No Trivy, Snyk, or any image scanner in GitHub Actions workflows. No `npm audit` or `bun audit` scripts. No SBOM generation.

**Files:** `.github/workflows/docker-build.yml`, `.github/workflows/pr-docker-build.yml`

### 11. .dockerignore Missing .env Exclusion

`.dockerignore` does not exclude `.env*` files. Secrets could be accidentally copied into Docker images.

**Files:** `.dockerignore`

### 12. Production docker-compose.yml Missing SCRAM-SHA-256 Auth

`docker-compose.dev.yml` sets `POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256` but production `docker-compose.yml` does not — defaulting to MD5.

**Files:** `docker-compose.yml` (missing), `docker-compose.dev.yml:17`

### 13. No Logging Framework — 76+ console.* Calls in Production

No structured logging library installed. 76+ `console.log/error` calls in production code, violating CLAUDE.md. No error tracking (Sentry/Datadog). No authentication audit trail.

**Files:** Throughout `apps/job-server/src/` and `apps/nextjs-app/lib/`

### 14. Unprotected Information Disclosure Endpoint

`/api/check-connectivity` requires no authentication and calls `getServersWithSecrets()`, exposing all registered Jellyfin server names, URLs, and connectivity status.

**Files:** `apps/nextjs-app/app/api/check-connectivity/route.ts`

### 15. Server Actions Missing Authentication/Authorization

7 Server Actions in settings pages have **no authentication or authorization checks** — security is enforced only in the UI (middleware route protection), not in the action itself. Any user who can call the action directly can:

- `deleteServerAction()` — delete any server (no auth, no admin check)
- `updateServerTimezoneAction()` — modify any server's timezone (no auth)
- `updateServerConnectionAction()` — change any server's URL/API key (no auth)
- `updateExcludedUsersAction()` / `updateExcludedLibrariesAction()` — modify exclusions (no auth)
- `updateDisabledHolidaysAction()` — modify holiday settings (no auth)
- `createServer()` — register new servers (no auth, should require admin)

Additionally, `importFromPlaybackReporting()` and `importFromJellystats()` accept FormData with no auth check.

**Files:** `app/(app)/servers/[id]/(auth)/settings/actions.ts`, `app/(app)/servers/[id]/reconnect/actions.ts`, `app/(app)/servers/[id]/(auth)/settings/exclusions/actions.ts`, `app/(app)/servers/[id]/(auth)/settings/holiday-actions.ts`, `lib/server.ts`, `lib/importPlaybackReporting.ts`

---

## MEDIUM

### 16. Server Actions Lack Consistent Input Validation

27 files contain `"use server"`. Zod is installed but not used for Server Action validation. No middleware pattern like `next-safe-action`.

### 17. Floating Docker Base Image Tags

- `Dockerfile.base:2` uses `oven/bun:1-alpine` (floating major)
- `apps/nextjs-app/Dockerfile:53` uses `node:24-alpine` (floating major)
- `Dockerfile.aio:70` uses `node:24-bookworm-slim` (floating major)

### 18. Job Server Dockerfile Missing --frozen-lockfile

`apps/job-server/Dockerfile:14` runs `bun install` without `--frozen-lockfile`. `Dockerfile.base:14` has fallback that silently bypasses lock.

### 19. No deploymentId for Version Skew Protection

`next.config.mjs` has no `deploymentId`. Clients may receive mismatched assets during rolling deployments.

### 20. No Monitoring or Alerting

Only basic `/api/health` endpoints. No Prometheus metrics, Grafana dashboards, alerting, or incident escalation.

---

## Action Items Summary

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | Add security headers via middleware | Critical | Medium |
| 2 | Implement rate limiting | Critical | Medium |
| 3 | Add reverse proxy to docker-compose | Critical | Medium |
| 4 | Enforce server-only boundary | Critical | Low |
| 5 | Fix AIO Dockerfile (non-root + remove hardcoded creds) | Critical | Low |
| 6 | Configure NEXT_SERVER_ACTIONS_ENCRYPTION_KEY | Critical | Low |
| 7 | Remove SESSION_SECRET hardcoded fallback, throw on missing | Critical | Low |
| 8 | Fix next.config.mjs (image patterns, body size, allowedOrigins) | High | Low |
| 9 | Add non-root user to job-server Dockerfile | High | Low |
| 10 | Add Trivy scanning to CI/CD | High | Medium |
| 11 | Add .env* to .dockerignore | High | Low |
| 12 | Add SCRAM-SHA-256 to prod docker-compose | High | Low |
| 13 | Replace console.* with structured logger | High | High |
| 14 | Authenticate /api/check-connectivity | High | Low |
| 15 | Add auth checks to 7+ unauthenticated Server Actions | High | Medium |
| 16 | Add Zod validation to Server Actions | Medium | Medium |
| 17 | Pin all Docker base image versions | Medium | Low |
| 18 | Add --frozen-lockfile to job-server Dockerfile | Medium | Low |
| 19 | Configure deploymentId | Medium | Low |
| 20 | Add monitoring/alerting | Medium | High |
