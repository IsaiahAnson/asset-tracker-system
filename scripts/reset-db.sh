#!/usr/bin/env bash
# Reset the local Asset Tracker System database to a clean, seeded state.
#
# Use during the demo for fast recovery if data gets into a bad shape mid-walkthrough.
# Drops the database, recreates it, then applies every SQL file in db/init/ in order.
#
# Env overrides (optional):
#   DB_NAME   target database name        (default: asset_tracker)
#   DB_OWNER  role to own the new DB      (default: asset_tracker; falls back to current user if missing)
#
# Requires: local PostgreSQL reachable via psql with the current shell user (trust auth on
# Homebrew Postgres is the typical setup). Stop the Next.js dev server first if any
# stale connections survive the pg_terminate_backend below.

set -euo pipefail

DB_NAME="${DB_NAME:-asset_tracker}"
DB_OWNER="${DB_OWNER:-asset_tracker}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INIT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )/db/init"

start=$SECONDS

echo "==> reset target: $DB_NAME (init dir: $INIT_DIR)"

# Kill any open connections to the target DB so DROP DATABASE works
# even if the dev server is still running. Ignore errors (no connections, etc.).
psql -d postgres -q -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

echo "==> dropping $DB_NAME (if exists)"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"

# Create the DB. If the configured owner role exists, use it; otherwise fall back to
# the current user so the script still works on a fresh laptop without setup.
if psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_OWNER'" | grep -q 1; then
  echo "==> creating $DB_NAME owned by $DB_OWNER"
  psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_OWNER\";"
else
  echo "==> role $DB_OWNER not found; creating $DB_NAME with default owner"
  psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$DB_NAME\";"
fi

echo "==> applying SQL from db/init/ in lexicographic order"
shopt -s nullglob
for f in "$INIT_DIR"/*.sql; do
  printf "    %s\n" "$(basename "$f")"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done

# Grant the app role access to everything just created. Migrations are applied
# as the current shell user (a superuser via trust auth), so tables/sequences
# end up owned by that user. The app connects as DB_OWNER (asset_tracker) and
# needs explicit privileges, including on future objects. Skipped if the role
# is absent (fresh laptop fallback above created the DB with the default owner).
if psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_OWNER'" | grep -q 1; then
  echo "==> granting privileges on all objects to $DB_OWNER"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -c "
    GRANT USAGE ON SCHEMA public TO \"$DB_OWNER\";
    GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$DB_OWNER\";
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"$DB_OWNER\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_OWNER\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_OWNER\";
  " >/dev/null
fi

echo "==> reset complete in $(( SECONDS - start ))s"
