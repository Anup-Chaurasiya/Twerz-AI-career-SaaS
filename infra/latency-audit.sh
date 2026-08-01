#!/usr/bin/env bash
# Measure latency for common API endpoints; flag responses >300ms.
#
# Usage:
#   ./infra/latency-audit.sh                          # external default
#   ./infra/latency-audit.sh http://127.0.0.1:8080    # from VM localhost
#   THRESHOLD_MS=500 ./infra/latency-audit.sh

set -euo pipefail

BASE="${1:-https://api.twerz.com}"
THRESHOLD_MS="${THRESHOLD_MS:-300}"

echo "Latency audit — base: ${BASE} (threshold: ${THRESHOLD_MS}ms)"
echo ""

endpoints=(
  "GET /health"
  "GET /health/ready"
  "GET /auth/google/login"
  "GET /credits/packs"
  "GET /public/stats"
  "GET /credits/subscriptions"
)

slow=0
total=0

for entry in "${endpoints[@]}"; do
  method="${entry%% *}"
  path="${entry#* }"
  url="${BASE}${path}"

  if [[ "$method" == "GET" ]]; then
    timing=$(curl -s -o /dev/null -w "%{time_total}" "$url" 2>/dev/null || echo "999")
  else
    timing=$(curl -s -o /dev/null -w "%{time_total}" -X "$method" "$url" 2>/dev/null || echo "999")
  fi

  ms=$(awk "BEGIN {printf \"%.0f\", $timing * 1000}")
  total=$((total + ms))

  if [[ "$ms" -gt "$THRESHOLD_MS" ]]; then
    flag=" SLOW"
    slow=$((slow + 1))
  else
    flag=""
  fi

  printf "  %4dms  %s %s%s\n" "$ms" "$method" "$path" "$flag"
done

echo ""
echo "Total: ${total}ms across ${#endpoints[@]} endpoints; ${slow} exceeded ${THRESHOLD_MS}ms"
if [[ "$slow" -gt 0 ]]; then
  exit 1
fi
