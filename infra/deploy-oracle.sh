#!/usr/bin/env bash
# Deploy Twerz API on Oracle Cloud VM (database: Supabase — no local Postgres).
#
# Prerequisites on VM:
#   - Docker + compose plugin
#   - .env in repo root with DATABASE_URL → Supabase (see infra/.env.production.example)
#   - ~/.oci/config for STORAGE_BACKEND=oci
#
# Usage:
#   ./infra/deploy-oracle.sh              # build + up
#   ./infra/deploy-oracle.sh --migrate    # first deploy / schema change (runs alembic)
#   ./infra/deploy-oracle.sh --preflight  # run checks inside api container

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose --env-file ${ROOT}/.env -f ${ROOT}/infra/docker-compose.prod.yml"
MIGRATE=false
PREFLIGHT=false

for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    --preflight) PREFLIGHT=true ;;
    -h|--help)
      echo "Usage: $0 [--migrate] [--preflight]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy infra/.env.production.example to .env and fill in secrets." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a && source "${ROOT}/.env" && set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in .env (Supabase connection string)." >&2
  exit 1
fi

if [[ "${DATABASE_URL}" == *"@db:5432"* ]] || [[ "${DATABASE_URL}" == *"@localhost:5432"* ]]; then
  echo "ERROR: DATABASE_URL still points at local Docker Postgres." >&2
  echo "  Set Supabase URI from Project Settings → Database → Direct connection (port 5432)." >&2
  exit 1
fi

if [[ "${DATABASE_URL}" != *"+asyncpg"* ]]; then
  echo "WARNING: DATABASE_URL should use postgresql+asyncpg:// for this app." >&2
fi

if [[ ! -d "${OCI_CONFIG_DIR:-$HOME/.oci}" ]]; then
  echo "Warning: OCI config dir not found. Set OCI_CONFIG_DIR or run 'oci setup config'." >&2
fi

export RUN_MIGRATIONS=$([[ "$MIGRATE" == true ]] && echo true || echo false)

echo "==> Building images..."
$COMPOSE build

echo "==> Starting API (RUN_MIGRATIONS=${RUN_MIGRATIONS})..."
$COMPOSE up -d --remove-orphans

echo "==> Waiting for health..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8080/health" >/dev/null 2>&1; then
    echo "==> Health OK"
    curl -s "http://127.0.0.1:8080/health"
    echo ""
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Health check failed after 30 attempts. Logs:" >&2
    $COMPOSE logs --tail=80 api
    exit 1
  fi
  sleep 2
done

if [[ "$PREFLIGHT" == true ]]; then
  echo "==> Running preflight inside api container..."
  $COMPOSE exec -T api uv run python infra/preflight.py
fi

if [[ "$MIGRATE" == true ]]; then
  echo ""
  echo "Migrations complete. Set RUN_MIGRATIONS=false in .env for normal deploys:"
  echo "  sed -i 's/RUN_MIGRATIONS=true/RUN_MIGRATIONS=false/' .env"
  echo "  $0"
fi

echo "==> Done. API listening on http://127.0.0.1:8080"
