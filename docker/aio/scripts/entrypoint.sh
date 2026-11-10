#!/bin/bash
set -e

# Keep the historical "postgres" default unless a password is provided, either
# directly or through POSTGRES_PASSWORD_FILE. The postgres entrypoint reads the
# _FILE variant itself, and the apps derive DATABASE_URL from POSTGRES_*.
if [ -z "${POSTGRES_PASSWORD:-}" ] && [ -z "${POSTGRES_PASSWORD_FILE:-}" ]; then
    export POSTGRES_PASSWORD=postgres
fi

# Ensure postgres user owns the data directory
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql/data
mkdir -p /var/run/postgresql
chown -R postgres:postgres /var/run/postgresql

echo "[AIO] Starting Streamystats All-in-One..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
