# @streamystats/database

This package contains the database schema, migrations, and connection logic for Streamystats.

## Overview

- **Schema Definition**: Uses Drizzle ORM to define database tables and relationships
- **Migrations**: SQL migration files managed by Drizzle Kit
- **Connection Management**: Shared database connection logic for all services

## Key Concepts

### Migrations in Production

Database migrations in production are handled by a **self-contained Docker service** that:
- Runs independently of application code
- Contains all migration logic embedded in the Docker image
- Does NOT use the TypeScript files in this package

The migration service is defined in `/migration.Dockerfile` at the root of the monorepo.

### Local Development

For local development, you can use the npm scripts in this package:

```bash
# Generate a new migration from schema changes
pnpm db:generate

# Apply migrations to your local database
pnpm db:migrate

# Open Drizzle Studio to explore your database
pnpm db:studio

# Check migration status
pnpm db:status
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
2. **Generate migration**: `pnpm db:generate`
3. **Review the generated SQL** in `drizzle/` folder
4. **Test locally**: `pnpm db:migrate`
5. **Commit** both schema changes and migration files
6. **Deploy**: The production migration service will automatically apply new migrations

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
pnpm install

# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Generate new migration from schema changes
pnpm db:generate

# Apply migrations locally
pnpm db:migrate

# Open database studio
pnpm db:studio

# Check migration status
pnpm db:status
```

## Production Migration Process

See `/packages/database/MIGRATIONS.md` for detailed documentation about how migrations work in production.
