#!/usr/bin/env bash
# Production smoke test — run after deploy (from VM or laptop).
# Usage: ./infra/smoke-test.sh [https://api.yourdomain.com]
set -euo pipefail

API_BASE="${1:-http://127.0.0.1:8080}"
API_BASE="${API_BASE%/}"

echo "==> Smoke test: ${API_BASE}"

echo -n "GET /health ... "
HEALTH="$(curl -sf "${API_BASE}/health")"
echo "OK (${HEALTH})"

echo -n "GET /public/stats ... "
STATS_CODE="$(curl -sf -o /dev/null -w '%{http_code}' "${API_BASE}/public/stats")"
if [[ "$STATS_CODE" != "200" ]]; then
  echo "FAIL (HTTP ${STATS_CODE})" >&2
  exit 1
fi
echo "OK (HTTP ${STATS_CODE})"

echo ""
echo "Automated checks passed."
echo ""
echo "Manual checklist:"
echo "  [ ] https://twerz.com loads (Vercel)"
echo "  [ ] Google login → dashboard"
echo "  [ ] Upload PDF → profile ready"
echo "  [ ] Tailor job → PDF download"
echo "  [ ] Razorpay test payment → credits"
echo "  [ ] Sentry receives test error"
