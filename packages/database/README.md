# @streamystats/database

This package contains the database schema, migrations, and connection logic for StreamyStats.

## Overview

- **Schema Definition**: Uses Drizzle ORM to define database tables and relationships
- **Migrations**: SQL migration files managed by Drizzle Kit
- **Connection Management**: Shared database connection logic for all services

## Key Concepts

### Migrations in Production

Database migrations in production are handled by the **job-server container on startup**:
- The job-server image bundles a compiled migration runner (`migrate-bin`) built from `packages/database/src/migrate-entrypoint.ts`
- Migration SQL files live in `packages/database/drizzle/` and are copied into the container
- The Next.js app starts only after the job-server is healthy (so migrations are done)

### Local Development

For local development, you can use the npm scripts in this package:

```bash
# Generate a new migration from schema changes
bun run db:generate

# Apply migrations to your local database
bun run db:migrate

# Open Drizzle Studio to explore your database
bun run db:studio

# Check migration status
bun run db:status
```

## Project Structure

```
packages/database/
├── src/
│   ├── index.ts          # Main exports
│   ├── schema.ts         # Database schema definitions
│   └── connection.ts     # Database connection logic
├── drizzle/
│   ├── 0000_*.sql       # Migration files (auto-generated)
│   └── meta/            # Drizzle metadata
├── scripts/
│   └── check-migration-status.ts  # Development utility
├── drizzle.config.ts    # Drizzle configuration
└── package.json
```

## Making Schema Changes

1. **Edit the schema** in `src/schema.ts`
2. **Generate migration**: `bun run db:generate`
3. **Review the generated SQL** in `drizzle/` folder
4. **Test locally**: `bun run db:migrate`
5. **Commit** both schema changes and migration files
6. **Deploy**: The job-server will automatically apply new migrations on startup

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |

## Important Notes

- **Never edit migration files** after they've been committed
- **Always review generated migrations** before applying
- **Test migrations** on a local database first
- If you see `FATAL:  role "root" does not exist` in Postgres logs, something is connecting with user `root` (typically missing/incorrect `DATABASE_URL`, or `POSTGRES_USER` changed after the DB volume was initialized).
- The `scripts/` folder contains development utilities that are NOT used in production

## Common Commands

```bash
# Install dependencies
bun install

# Build the package
bun run build

# Watch mode for development
bun run dev

# Generate new migration from schema changes
bun run db:generate

# Apply migrations locally
bun run db:migrate

# Open database studio
bun run db:studio

# Check migration status
bun run db:status
```

## Production Migration Process

See `/packages/database/MIGRATIONS.md` for detailed documentation about how migrations work in production. 