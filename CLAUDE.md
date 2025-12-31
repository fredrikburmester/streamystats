# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Streamystats is a Jellyfin analytics platform providing watch statistics, AI-powered recommendations, and data visualization. It's a Bun monorepo with two services: a Next.js web app and a Hono job server.

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
        ├── jobs/        # Job definitions (scheduler, session-poller, embeddings)
        └── routes/      # HTTP endpoints for job management

packages/
└── database/            # Shared database layer
    └── src/
        ├── schema.ts    # Drizzle ORM schema (single source of truth)
        └── connection.ts
```

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

See `docs/STATISTICS_EXCLUSIONS.md` for complete patterns.

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
