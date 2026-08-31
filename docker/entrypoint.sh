#!/bin/bash
set -e

mkdir -p /run/postgresql
chown postgres:postgres /run/postgresql

if [ ! -d /var/lib/postgresql/data/base ]; then
    mkdir -p /var/lib/postgresql/data
    chown postgres:postgres /var/lib/postgresql/data
    su postgres -c "initdb -D /var/lib/postgresql/data"
    su postgres -c "pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start"
    su postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '${DB_PASSWORD:-postgres}';\""
    su postgres -c "createdb ${DB_NAME:-nitr}" 2>/dev/null || true
    su postgres -c "psql -d ${DB_NAME:-nitr} -f /docker/schema.sql" 2>/dev/null || true
    su postgres -c "pg_ctl -D /var/lib/postgresql/data stop"
fi

su postgres -c "postgres -D /var/lib/postgresql/data" &
redis-server &
node /dist/index.js --prod &

trap 'kill $(jobs -p); wait' EXIT

wait