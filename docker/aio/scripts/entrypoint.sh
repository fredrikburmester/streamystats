#!/bin/bash
set -e

# Ensure postgres user owns the data directory
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql/data
mkdir -p /var/run/postgresql
chown -R postgres:postgres /var/run/postgresql

echo "[AIO] Starting Streamystats All-in-One..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
