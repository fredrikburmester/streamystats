# Streamystats All-in-One (AIO) Container

Single container deployment with PostgreSQL, Job Server, and Next.js bundled together.

## Quick Start

### Docker Compose (Recommended)

```bash
# Create .env file
cat > .env << EOF
SESSION_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=your-secure-password
EOF

# Start
docker compose -f docker-compose.aio.yml up -d
```

### Docker Run

```bash
docker run -d \
  --name streamystats \
  -p 3000:3000 \
  -v streamystats_data:/var/lib/postgresql/data \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e POSTGRES_PASSWORD="your-secure-password" \
  fredrikburmester/streamystats-v2-aio:latest
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | - | Required. Secret for session encryption |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_DB` | `streamystats` | Database name |

## Architecture

```
┌─────────────────────────────────────────┐
│           AIO Container                 │
│  ┌─────────────────────────────────┐    │
│  │         supervisord             │    │
│  └─────────────────────────────────┘    │
│       │         │          │            │
│       ▼         ▼          ▼            │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │PostgreSQL│ │Job     │ │Next.js │ ◄── Port 3000
│  │(VectorChord)│Server  │ │        │    │
│  └────────┘ └────────┘ └────────┘       │
│       │                                  │
│       ▼                                  │
│  /var/lib/postgresql/data (Volume)      │
└─────────────────────────────────────────┘
```

## Startup Order

1. **PostgreSQL** starts first
2. **Migrations** run after PostgreSQL is ready
3. **Job Server** starts after migrations complete
4. **Next.js** starts after Job Server is healthy

## Data Persistence

Database data is stored in `/var/lib/postgresql/data`. Mount a volume to persist data:

```bash
-v streamystats_data:/var/lib/postgresql/data
```

## Health Checks

The container exposes a health check that verifies:

- Next.js API (`http://localhost:3000/api/health`)
- Job Server (`http://localhost:3005/health`)
- PostgreSQL (`pg_isready`)

## Backup & Restore

### Backup

```bash
docker exec streamystats pg_dump -U postgres \
  --clean --if-exists --no-owner \
  streamystats > backup.sql
```

| Flag | Purpose |
|------|---------|
| `--clean` | Adds DROP statements before CREATE (enables restore to existing DB) |
| `--if-exists` | Adds IF EXISTS to DROP (prevents errors if objects don't exist) |
| `--no-owner` | Omits ownership commands (portable across different users) |

### Restore

```bash
cat backup.sql | docker exec -i streamystats psql -U postgres streamystats
```

### Compressed Backup

```bash
docker exec streamystats pg_dump -U postgres \
  --clean --if-exists --no-owner -Fc \
  streamystats > backup.dump

# Restore compressed
docker exec -i streamystats pg_restore -U postgres \
  --clean --if-exists -d streamystats < backup.dump
```

## Logs

View all service logs:

```bash
docker logs -f streamystats
```

## When to Use AIO vs Standard Deployment

| Use AIO | Use Standard (docker-compose.yml) |
|---------|-----------------------------------|
| Home server / personal use | Production environments |
| Quick demos / testing | Need horizontal scaling |
| Simple single-node setup | Separate DB backups needed |
| Limited resources | High availability required |

## Limitations

- All services share CPU/memory
- Single point of failure
- Harder to scale individual components
- Database runs as root user inside container

## Troubleshooting

### Container won't start

Check logs: `docker logs streamystats`

### Database connection errors

Wait 60-90 seconds for all services to initialize. The health check has a 90s start period.

### `FATAL:  role "root" does not exist`

This means something is trying to connect to PostgreSQL using the username `root`.

Common causes:
- `DATABASE_URL` is missing or doesn’t include a username (some clients fall back to the OS user, which is often `root` in containers).
- You changed `POSTGRES_USER` / `DATABASE_URL` after the database volume was already initialized. PostgreSQL only creates the initial user on first init; existing volumes won’t auto-create the new role.

Fix:
- Ensure `DATABASE_URL` includes the correct user (default is `postgres`) and matches your DB:
  - Example: `postgresql://postgres:<password>@localhost:5432/streamystats`
- If you intentionally changed the DB user, either create that role in Postgres or delete the volume and re-initialize the database.

### Permission errors on volume

```bash
docker run --rm -v streamystats_data:/data alpine chown -R 999:999 /data
```
