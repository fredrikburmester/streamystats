# Database Migrations Guide

This document explains how database migrations work in the Streamystats project.

## Overview

We use [Drizzle ORM](https://orm.drizzle.team/) for database migrations with a dedicated, self-contained migration service in Docker Compose.

## Migration Strategy

### Production Setup
- **Self-Contained Migration Service**: A standalone Docker container with embedded migration logic
- **No External Dependencies**: Migration service doesn't depend on application code or scripts
- **Exit Code Based**: Services wait for successful completion (exit code 0) via `service_completed_successfully`
- **Resource Limits**: Migration service has memory and CPU limits to prevent resource exhaustion
- **Idempotent**: Migrations can be run multiple times safely

### How It Works

1. **Database Startup**: PostgreSQL starts first with health checks
2. **Migration Service**: 
   - Contains all migration logic in an embedded shell script
   - Waits for database to be ready
   - Creates database if it doesn't exist
   - Creates required extensions (vector, uuid-ossp)
   - Runs all pending migrations using drizzle-kit
   - Exits with code 0 on success
3. **Application Services**: Start only after migration service completes successfully

## Architecture

The migration service is **completely self-contained**:
- Built from `migration.Dockerfile`
- Contains only the minimal files needed for migrations
- Embeds the migration logic directly in the Docker image
- Does not depend on TypeScript or application code

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
pnpm db:generate
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
pnpm db:migrate
```

### 5. Deploy
Migrations run automatically when deploying with Docker Compose:
```bash
docker-compose up
```

The migration service will automatically pick up new migration files.

## Migration Scripts

### Local Development Scripts (in `package.json`)

These scripts are for **local development only**:

- **`db:generate`** - Generates new migration files based on schema changes
- **`db:migrate`** - Applies migrations locally using Drizzle Kit
- **`db:studio`** - Opens Drizzle Studio for database exploration
- **`db:status`** - Checks migration status (debugging tool)

### Production Migration (in Docker)

Production migrations are handled by the self-contained migration service:
- Uses embedded shell script in the Docker image
- Runs `npx drizzle-kit migrate` directly
- No dependency on package.json scripts or TypeScript

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
1. Check logs: `docker-compose logs migrate`
2. Fix the issue in schema
3. Generate a new migration
4. Never edit failed migration files

## Troubleshooting

### Check Migration Status Locally
```bash
cd packages/database
pnpm db:status
```

### Migration Service Keeps Restarting
```bash
# Check logs
docker-compose logs migrate

# Common issues:
# - Database not ready
# - Wrong credentials
# - Network issues
# - Invalid SQL in migration files
```

### Manually Run Migration Service
```bash
# Run migration service manually
docker-compose run --rm migrate

# Check what's in the container
docker-compose run --rm migrate ls -la /app/packages/database/drizzle
```

### Check Applied Migrations
```bash
# Connect to database and check migration table
docker exec -it <postgres-container> psql -U postgres -d streamystats \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;"
```

## Environment Variables

The migration service supports these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (preferred) | - |
| `POSTGRES_USER` | Database user | postgres |
| `POSTGRES_PASSWORD` | Database password | postgres |
| `POSTGRES_DB` | Database name | streamystats |
| `DB_HOST` | Database host (extracted from DATABASE_URL) | vectorchord |
| `DB_PORT` | Database port (extracted from DATABASE_URL) | 5432 |
| `NODE_ENV` | Environment | production |

## Docker Compose Configuration

### Production
```yaml
migrate:
  image: your-registry/migrate:latest
  environment:
    - DATABASE_URL=postgresql://user:pass@host:5432/db
  depends_on:
    postgres:
      condition: service_healthy
  restart: "no"
  deploy:
    resources:
      limits:
        memory: 512M

# Other services depend on migrate completing successfully
app:
  depends_on:
    migrate:
      condition: service_completed_successfully
```

### Development
```yaml
migrate:
  build:
    context: .
    dockerfile: migration.Dockerfile
  volumes:
    # Mount migrations for live updates during development
    - ./packages/database/drizzle:/app/packages/database/drizzle:ro
```

## How the Self-Contained Migration Service Works

The migration Dockerfile:

1. **Build Stage**: Compiles the database package
2. **Runtime Stage**: 
   - Installs only essential dependencies (drizzle-kit, drizzle-orm, postgres)
   - Copies migration files and config
   - Embeds migration script directly in the image
   - No dependency on pnpm or application code

The embedded script:
1. Parses DATABASE_URL or uses individual env vars
2. Waits for PostgreSQL to be ready
3. Creates database if needed
4. Creates extensions
5. Runs `npx drizzle-kit migrate`
6. Exits with appropriate code (0 for success, 1 for failure)

## Advanced Topics

### Zero-Downtime Migrations
For large tables:
1. Add new columns as nullable
2. Backfill data in batches
3. Add constraints in separate migration
4. Deploy application changes

### Debugging Migration Issues
```bash
# Run migration container with shell
docker-compose run --rm --entrypoint sh migrate

# Inside container, manually run steps:
cd /app/packages/database
npx drizzle-kit migrate --config drizzle.config.ts
```

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Main_Page)
- [Docker Compose Health Checks](https://docs.docker.com/compose/compose-file/05-services/#healthcheck)
