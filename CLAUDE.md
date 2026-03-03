# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Streamystats is a self-hosted analytics platform for Jellyfin media servers. It provides watch statistics, AI-powered recommendations, security monitoring, and data visualization. Users deploy it via Docker alongside their Jellyfin instance. It continuously syncs data from Jellyfin and presents it through a web dashboard. It's a Bun monorepo with two services: a Next.js web app and a Hono job server, backed by VectorChord PostgreSQL 17 (pgvector + tsvector).

## Commands

```bash
# Development
bun run dev              # Start both services (job-server + next.js)
bun run dev:nextjs       # Next.js only
bun run dev:job-server   # Job server only (with --watch)

# Build & Production
bun run build            # Build database package + Next.js
bun run start            # Start both services

# Database
bun run db:generate      # Generate migrations from schema.ts
bun run db:migrate       # Run pending migrations
bun run db:studio        # Launch Drizzle Studio

# Code Quality
bun run lint:fix         # Biome lint with fixes
bun run format:fix       # Biome format with fixes
bun run typecheck        # TypeScript check (both apps)

# Testing
cd apps/nextjs-app && bun test           # Run all tests
cd apps/nextjs-app && bun test file.ts   # Run single test file
```

## Architecture

```
┌─────────────┐       ┌───────────────┐       ┌─────────────────────┐
│   Browser    │──────▶│  Next.js      │──────▶│  Job Server         │
│              │ :3000 │  (BFF + UI)   │ :3005 │  (Hono + pg-boss)   │
└─────────────┘       │               │       │                     │
                      │  Server       │       │  Session Poller     │
                      │  Components   │       │  Scheduled Jobs     │
                      │  API Routes   │       │  SSE Event Bus      │
                      │  Server       │       └──────────┬──────────┘
                      │  Actions      │                  │
                      └───────┬───────┘                  │
                              │                          │
                              ▼                          ▼
                      ┌──────────────────────────────────────────┐
                      │  VectorChord PostgreSQL 17               │
                      │  pgvector (embeddings) + tsvector (FTS)  │
                      │  :5432                                   │
                      └──────────────────────────────────────────┘
                              │
                              │ Jellyfin API calls
                              ▼
                      ┌──────────────────┐
                      │  Jellyfin Server │
                      │  (external)      │
                      └──────────────────┘
```

```
apps/
├── nextjs-app/          # Web UI + API routes (port 3000)
│   ├── app/             # Next.js App Router
│   │   ├── (app)/       # Main app layout group
│   │   └── api/         # REST endpoints (authenticated)
│   ├── components/      # React components
│   │   └── ui/          # shadcn/ui components
│   ├── lib/
│   │   ├── db/          # Database query functions (25+ files)
│   │   ├── ai/          # AI integration (chat, embeddings)
│   │   ├── auth.ts      # Session authentication
│   │   └── api-auth.ts  # API token validation
│   └── hooks/           # Custom React hooks
│
└── job-server/          # Background job processor (port 3005, Hono)
    └── src/
        ├── jobs/        # Job definitions (scheduler, session-poller, embeddings, geolocation, security-sync, server-jobs)
        ├── events/      # SSE event bus (job-events.ts)
        └── routes/      # HTTP endpoints for job management

packages/
└── database/            # Shared database layer
    └── src/
        ├── schema.ts    # Drizzle ORM schema (single source of truth)
        └── connection.ts
```

**Next.js app** (port 3000): Web UI via App Router with server components, API routes for external integrations, server actions for mutations. Acts as BFF — the browser never talks to the job-server directly.

**Job server** (port 3005): Hono HTTP server with pg-boss for persistent job queues. Runs a session poller (in-memory tracking of active Jellyfin playback) and scheduled cron jobs for data sync. Publishes SSE events for real-time progress.

**PostgreSQL**: VectorChord image (PostgreSQL 17 + pgvector). Extensions: `vector` (embeddings), `uuid-ossp` (ID generation). Full-text search via `tsvector` columns with GIN indexes, updated by database triggers.

### Communication

- Next.js → job-server: HTTP via `JOB_SERVER_URL` (e.g., `http://job-server:3005`)
- Both services → PostgreSQL: via `DATABASE_URL`
- Job-server → Jellyfin: HTTP via stored server URLs (uses `internalUrl` when configured, falls back to `url`)
- Next.js → Jellyfin: HTTP from server components/API routes using `getInternalUrl(server)`
- Browser → Jellyfin: only for login (credentials flow), never for data

### Deployment

**Docker Compose** (`docker-compose.yml`): 4 services — vectorchord (pg17), migrate (one-shot), job-server, nextjs-app — on a shared `app-network` bridge. Startup order is health-check gated.

**AIO** (`docker-compose.aio.yml`): Single container running supervisord. Wrapper scripts in `docker/aio/scripts/` handle startup ordering.

**Dev** (`docker-compose.dev.yml`): PostgreSQL only on `localhost:5432`. Run `bun run dev` locally.

**Required env vars**: `SESSION_SECRET` (JWT signing), `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `DATABASE_URL`, `JOB_SERVER_URL`. DB credentials default to `postgres`/`postgres`/`streamystats` in Docker.

## Data Sync & Jobs

All data flows from Jellyfin into the database. Streamystats never writes back to Jellyfin.

**Session Poller**: Polls Jellyfin `/Sessions` every 5s per server. Maintains in-memory `Map<serverId, Map<sessionKey, TrackedSession>>`. New sessions → `activeSessions` table. Ended sessions → final record in `sessions` table with full playback stats. Publishes SSE events on session start/complete.

**Scheduled Jobs**:

| Job | Schedule | Description |
|-----|----------|-------------|
| `activity-sync` | `*/5 * * * *` | Syncs recent Jellyfin activities (paginated with cursor) |
| `recent-items-sync` | `*/5 * * * *` | Syncs recently added media items |
| `user-sync` | `*/5 * * * *` | Syncs Jellyfin user accounts |
| `people-sync` | `*/15 * * * *` | Syncs actors, directors, writers |
| `embeddings-sync` | `*/15 * * * *` | Generates AI embeddings (batch: 100 from DB, 20 per API call) |
| `geolocation-sync` | `*/15 * * * *` | Parses IPs, looks up coordinates via geoip-lite |
| `fingerprint-sync` | `0 4 * * *` | Calculates user behavioral patterns |
| `full-sync` | `0 2 * * *` | Complete re-sync of all data |
| `deleted-items-cleanup` | `0 * * * *` | Removes soft-deleted items older than threshold |
| `job-cleanup` | `*/1 * * * *` | Resets stuck jobs |
| `old-job-cleanup` | `0 3 * * *` | Purges old job result records |

All schedules overridable per-server via `serverJobConfigurations` table (admin UI at `/settings/jobs`). Set `SKIP_STARTUP_FULL_SYNC=true` to skip initial full sync on container restart.

Sync status tracked on `servers` table: `syncStatus` (pending/syncing/completed/failed) and `syncProgress` (current step description).

## Database Schema

**Core tables**: `servers` (Jellyfin config, AI config, exclusions, timezone), `users` (Jellyfin users with ~30 permission fields), `libraries` (media collections), `items` (movies/series/episodes with 50+ metadata columns, `embedding` pgvector, `searchVector` tsvector, `rawData` JSONB, `deletedAt` soft delete), `sessions` (playback history with timing, progress, transcoding fields, `isInferred` flag).

**Analytics tables**: `activities` (server events), `activityLocations` (geolocated IPs), `userFingerprints` (behavioral patterns), `anomalyEvents` (suspicious activity flags with severity/resolution).

**Feature tables**: `watchlists` + `watchlistItems` (user-created media lists), `hiddenRecommendations`, `people` + `itemPeople` (cast/crew relationships).

**System tables**: `jobResults` (execution log), `serverJobConfigurations` (per-server cron overrides), `activeSessions` (durable snapshot of current playback), `activityLogCursors` (pagination state).

**Key patterns**: Hybrid storage (structured columns + full JSONB DTO), variable-dimension pgvector with auto-created HNSW indexes, soft deletes on items, `tsvector` FTS on items/users/activities/people/watchlists (DB triggers + GIN indexes), cascade deletes from server.

## Authentication

**Session cookie** (`streamystats-session`): httpOnly, sameSite=lax, 30-day maxAge. JWT signed with `SESSION_SECRET` containing `id`, `name`, `serverId`, `isAdmin`. Separate `streamystats-token` cookie stores Jellyfin access token. Functions in `lib/session.ts`: `createSession()`, `getSession()`, `destroySession()`, `updateSession()`.

**MediaBrowser token** (external API clients): `Authorization: MediaBrowser Token="<jellyfin-access-token>"`. Validated by calling Jellyfin `/Users/Me`.

**Auth guards**: `requireSession()` (web app, 401), `requireAuth(request)` (session OR MediaBrowser), `requireAdmin()` (session + admin, 403), `requireApiKey()` (validates against Jellyfin `/System/Info`).

## Key Patterns

### Database Migrations

1. Modify `packages/database/src/schema.ts`
2. Run `bun run db:generate`
3. Optionally edit generated `.sql` for data migration
4. Run `bun run db:migrate`
5. Rebuild the database package to regenerate Drizzle types:
   ```bash
   cd packages/database && bun run build
   ```

Never manually create `.sql` files, `_journal`, or snapshots - they're auto-generated.

For custom migrations without schema changes:
```bash
bunx drizzle-kit generate --custom --name=your_migration_name
```

### Statistics Exclusions

All statistics queries in `lib/db/` must implement exclusion filters:

```typescript
import { getStatisticsExclusions } from "./exclusions";

const { userExclusion, itemLibraryExclusion, requiresItemsJoin } =
  await getStatisticsExclusions(serverId);

const conditions: SQL[] = [/* ... */];
if (userExclusion) conditions.push(userExclusion);

// Sessions lack direct libraryId - join items table when needed
if (requiresItemsJoin || otherCondition) {
  query = query.innerJoin(items, eq(sessions.itemId, items.id));
  if (itemLibraryExclusion) conditions.push(itemLibraryExclusion);
}
```

Additional helpers in `lib/db/exclusions.ts`: `buildUserExclusionCondition(ids)`, `buildLibraryExclusionCondition(ids)`, `getExcludedItemIds(serverId, ids)`, `addExclusionConditions(conditions, settings)`. For library-table queries use `librariesTableExclusion`, for user-table queries use `usersTableExclusion` — both returned by `getStatisticsExclusions()`.

### Internal vs External URLs

Servers have two URL fields: `url` (external, required) and `internalUrl` (optional). Use helpers from `lib/server-url.ts` (nextjs-app) or `src/utils/server-url.ts` (job-server):

- **Server-to-server requests** (API routes, server actions, job-server jobs): use `getInternalUrl(server)` — returns `internalUrl` with fallback to `url`
- **Client-side browser links** (opening Jellyfin web UI, client components): use `server.url` directly
- **Images in server components**: use `getInternalUrl(server)` since Next.js fetches server-side
- **Images in client components**: route through `/api/image-proxy/[itemId]` so the proxy fetches internally and serves to the browser

Never use raw `server.url` for server-to-server Jellyfin API calls — always use `getInternalUrl()`.

### SSE Event System

Job-server publishes events via `publishJobEvent()` (in `job-server/src/events/job-events.ts`) → in-memory `jobEventBus` → SSE endpoint `/api/events`. Next.js proxies at `/api/jobs/events` (`nextjs-app/app/api/jobs/events/route.ts`). Client consumes via `useJobEvents` hook (`hooks/useJobEvents.ts`) with auto-reconnect and `?since=<epochMs>` for missed events. Event buffer: max 2000 events, 5-minute window. Heartbeat every 15s. Event types: `hello`, `ping`, `started`, `completed`, `failed`, `progress`, `anomaly_detected`. Key pattern: fetch initial state once, then use SSE for real-time updates (eliminates polling).

### Caching / "use cache"

Next.js `"use cache"` directive with `cacheLife()` presets and `cacheTag()` for revalidation. Rules: no `cookies()` or `headers()` inside cached functions — resolve dynamic data first, pass as arguments. No route segment config (`export const dynamic`, `export const runtime`) when `cacheComponents: true` is enabled — causes build errors. Cache keys are auto-generated from build ID + function ID + serializable arguments. Use `revalidateTag()` for manual invalidation.

### Timezone Handling

All timestamps stored as UTC (`timestamptz`) in the database. Per-server IANA timezone stored on `servers.timezone` (display only). Client-side conversion via `useServerTimezone()` context + `<FormattedDate>` component (`components/FormattedDate.tsx`). Conversion utilities in `lib/timezone.ts` (`formatLocalDate`, `utcHourToLocalHour`). Never use `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` for date formatting — causes hydration mismatch. Number formatting (e.g., thousands separators) is fine. Prefer `<FormattedDate>` or `formatLocalDate()` with timezone parameter for all new code.

### API Endpoints

- All endpoints must be authenticated
- Admin endpoints require admin-level authentication
- Filter responses to return only necessary data
- Avoid creating external API endpoints unless needed

## Code Conventions

### Package Manager
Use **Bun** exclusively (`bun install`, `bun run`, `bunx drizzle-kit`).

### Timestamps
ISO 8601 UTC with microseconds: `2025-07-23T07:51:42.811836Z`

### TypeScript
- Never use `any` - prefer `unknown` + narrowing, generics, or discriminated unions
- Never use non-null assertion `!` - use control-flow narrowing or runtime checks
- Never use `@ts-ignore`/`@ts-nocheck` - use `@ts-expect-error` with reason if needed
- Never use unsafe `as Foo` casts - prefer narrowing or runtime validation
- Strict mode required (`"strict": true`, `"noImplicitAny": true`)

### Imports
- All imports at top of file
- No inline `await import(...)`
- Use `import type` for type-only imports

### React
- Never prefix hooks with `React.` (use `useEffect`, not `React.useEffect`)
- Always include all dependencies in effect/memo arrays
- Prefer server components with `<Suspense>` when possible

### Code Style
- Prefer `const`; use `let` only when reassignment needed; never `var`
- Always use `===`/`!==`
- No `console.*` in production - use logger abstraction
- Prefer named exports over default exports
- Use `Number.parseInt(value, 10)` - always specify radix
- Never rely on local timezone - use UTC explicitly

### Async
- No floating promises - must be `await`ed, `return`ed, or explicitly `void`ed
- Handle errors at boundaries - don't swallow errors

### Comments
Comments must explain *why*, not act as structural headings. No `/* Overview */` style comments.

### Git Workflow
- **Never commit directly to `main`** — always create a feature/fix branch first (e.g., `fix/some-bug`, `feat/some-feature`)
- Before starting work on an issue, check for existing PRs to avoid duplicate effort

### Commit Messages
Use conventional commits format, single line only (no multiline commits). Examples:
- `feat: add user dashboard`
- `fix: resolve session timeout issue`
- `chore: update dependencies`

### PRs
Keep PR body short, use convnetional commits and don't add any attributions to the PR body, branch name, or commit messages. Don't include a test plan in PR body.

## Debugging with tmux

The dev servers can be run in a tmux session so Claude can read logs:

```bash
# Start both servers in tmux (job-server + Next.js)
tmux new-session -d -s streamystats-dev -n dev
tmux send-keys -t streamystats-dev:dev "bun run dev" Enter

# Read logs (last 50 lines)
tmux capture-pane -t streamystats-dev:dev -p -S -50

# Read more history (last 200 lines)
tmux capture-pane -t streamystats-dev:dev -p -S -200
```

To attach and watch live: `tmux attach -t streamystats-dev`

This allows Claude to monitor server output, debug issues, and verify changes in real-time.

## Communication Style

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.
