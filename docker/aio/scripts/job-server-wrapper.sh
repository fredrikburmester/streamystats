#!/bin/bash
echo "[AIO] Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-streamystats} 2>/dev/null; do
    sleep 1
done
echo "[AIO] PostgreSQL is ready. Running migrations..."
/app/migrate-bin

echo "[AIO] Starting job-server..."
exec /app/job-server

