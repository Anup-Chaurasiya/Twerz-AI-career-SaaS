#!/usr/bin/env bash
# Backup Supabase / external Postgres using DATABASE_URL from .env.
# Requires Docker (uses postgres:16 image for pg_dump).
#
# Supabase also provides daily backups in the dashboard (Project → Database → Backups).
# Cron example: 0 3 * * * /home/opc/GobioGo/infra/backup-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/twerz}"
STAMP="$(date +%F_%H%M%S)"

if [[ ! -f "${ROOT}/.env" ]]; then
  echo "Missing ${ROOT}/.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a && source "${ROOT}/.env" && set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set in .env" >&2
  exit 1
fi

# pg_dump expects postgresql:// (not postgresql+asyncpg://)
PGURL="${DATABASE_URL/postgresql+asyncpg/postgresql}"
# pg_dump uses sslmode=, not ssl=
PGURL="${PGURL/ssl=require/sslmode=require}"
PGURL="${PGURL/ssl=true/sslmode=require}"

mkdir -p "$BACKUP_DIR"

docker run --rm postgres:16 \
  pg_dump "$PGURL" | gzip > "${BACKUP_DIR}/twerz_${STAMP}.sql.gz"

# Keep last 14 backups
ls -1t "${BACKUP_DIR}"/twerz_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "Backup written: ${BACKUP_DIR}/twerz_${STAMP}.sql.gz"
