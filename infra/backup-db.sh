#!/usr/bin/env bash
# Weekly/daily Postgres backup from production compose stack.
# Cron example: 0 3 * * * /home/ubuntu/GobioGo/infra/backup-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/twerz}"
COMPOSE="docker compose -f ${ROOT}/infra/docker-compose.prod.yml"
STAMP="$(date +%F_%H%M%S)"

mkdir -p "$BACKUP_DIR"

$COMPOSE exec -T db pg_dump -U twerz twerz_prod | gzip > "${BACKUP_DIR}/twerz_${STAMP}.sql.gz"

# Keep last 14 daily backups
ls -1t "${BACKUP_DIR}"/twerz_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "Backup written: ${BACKUP_DIR}/twerz_${STAMP}.sql.gz"
