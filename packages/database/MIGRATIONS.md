# Database Migrations Guide

This document explains how database migrations work in the StreamyStats project.

## Overview

We use [Drizzle ORM](https://orm.drizzle.team/) for database migrations.

For Docker deployments, migrations run automatically **inside the job-server container at startup** (before the job-server starts serving HTTP and becomes healthy). The Next.js app waits for the job-server healthcheck, which enforces the start order:

**db → job-server (run migrations) → nextjs**

## Migration Strategy

### Production Setup
- **Job-server startup migration**: The job-server image bundles a compiled migration runner (`migrate-bin`) + the `drizzle/` folder.
- **Healthcheck-gated**: The job-server only becomes healthy after migrations finish and the server is running.
- **Idempotent**: Migrations can be run multiple times safely.

### How It Works

1. **Database Startup**: PostgreSQL starts first with health checks
2. **Job Server Startup**:
   - Waits for PostgreSQL to be ready
   - Runs all pending migrations (`drizzle-orm` migrator) from `./drizzle`
   - Starts the job-server HTTP API
3. **Next.js App**: Starts only after the job-server is healthy

## Architecture

Migrations are run by a small compiled binary (`migrate-bin`) built from `packages/database/src/migrate-entrypoint.ts` and executed as part of the job-server container startup.

## Files Structure

```
packages/database/
├── drizzle/              # Migration SQL files (copied to Docker image)
│   ├── 0000_*.sql       # Generated migration files
│   └── meta/            # Drizzle metadata
├── scripts/             # Development utilities (NOT used in production)
│   └── check-migration-status.ts # Local debugging tool
├── src/
│   └── schema.ts        # Database schema definitions
└── drizzle.config.ts    # Drizzle configuration
```

## Creating New Migrations

### 1. Modify Schema
Edit `packages/database/src/schema.ts`:

```typescript
export const newTable = pgTable('new_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 2. Generate Migration
```bash
cd packages/database
bun run db:generate
```

This creates a new SQL file in `drizzle/` directory.

### 3. Review Migration
Always review generated migrations before applying:
```bash
cat drizzle/0006_your_migration.sql
```

### 4. Test Locally
```bash
# Start database
docker-compose -f docker-compose.dev.yml up vectorchord

# Run migration locally (for testing)
cd packages/database
bun run db:migrate
```

### 5. Deploy
Migrations run automatically when deploying with Docker Compose:
```bash
docker-compose up
```

The job-server will automatically pick up new migration files.

## Migration Scripts

### Local Development Scripts (in `package.json`)

These scripts are for **local development only**:

- **`db:generate`** - Generates new migration files based on schema changes
- **`db:migrate`** - Applies migrations locally using Drizzle Kit
- **`db:studio`** - Opens Drizzle Studio for database exploration
- **`db:status`** - Checks migration status (debugging tool)

### Production Migration (in Docker)

Production migrations are handled by the job-server container at startup.

## Best Practices

### 1. Always Review Migrations
- Check generated SQL before applying
- Ensure no data loss
- Verify index creation

### 2. Backup Before Major Changes
```bash
pg_dump -h localhost -U postgres -d streamystats > backup.sql
```

### 3. Test Migrations
- Run migrations on a test database first
- Verify data integrity after migration
- Test rollback procedures if needed

### 4. Version Control
- Commit migration files to git
- Never modify existing migration files
- Create new migrations for changes

### 5. Handle Failed Migrations
If a migration fails:
1. Check logs: `docker-compose logs job-server`
2. Fix the issue in schema
3. Generate a new migration
4. Never edit failed migration files

## Troubleshooting

### Check Migration Status Locally
```bash
cd packages/database
bun run db:status
```

### Check Applied Migrations
```bash
# Connect to database and check migration table
docker exec -it <postgres-container> psql -U postgres -d streamystats \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;"
```

### Job-server migrations failing in Docker
- Check logs: `docker-compose logs job-server`
- Common issues:
  - Database not ready / wrong host in `DATABASE_URL`
  - Wrong credentials
  - Missing permissions to create extensions (warning is logged; migrations still run)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (required) |