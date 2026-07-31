#!/usr/bin/env bash
# Install Nginx + Certbot, proxy api.twerz.com → 127.0.0.1:8080, and enable HTTPS.
#
# Prerequisites:
#   - DNS A record: api.twerz.com → this VM's public IP
#   - OCI Ingress Rule: TCP 443 from 0.0.0.0/0 (alongside existing port 80)
#   - API running: curl -sf http://127.0.0.1:8080/health
#
# Usage:
#   sudo ./infra/setup-nginx-ssl.sh api.twerz.com you@example.com
#   sudo ./infra/setup-nginx-ssl.sh api.twerz.com   # certbot prompts for email
set -euo pipefail

API_DOMAIN="${1:-}"
CERTBOT_EMAIL="${2:-}"

if [[ -z "$API_DOMAIN" ]]; then
  echo "Usage: sudo $0 api.twerz.com [certbot-email]" >&2
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo $0 $*" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="/etc/nginx/sites-available/twerz-api"

echo "==> Installing nginx + certbot..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Configuring Nginx for ${API_DOMAIN}..."
sed "s/api.yourdomain.com/${API_DOMAIN}/g" "${ROOT}/infra/nginx/twerz-api.conf" > "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/twerz-api
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> HTTP proxy OK — verifying local upstream..."
if ! curl -sf "http://127.0.0.1:8080/health" >/dev/null; then
  echo "ERROR: API not healthy on 127.0.0.1:8080. Start the stack first:" >&2
  echo "  cd ${ROOT} && ./infra/deploy-oracle.sh" >&2
  exit 1
fi

echo "==> Obtaining Let's Encrypt certificate..."
CERTBOT_ARGS=(--nginx -d "${API_DOMAIN}" --non-interactive --agree-tos --redirect)
if [[ -n "$CERTBOT_EMAIL" ]]; then
  CERTBOT_ARGS+=(--email "$CERTBOT_EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

if ! certbot "${CERTBOT_ARGS[@]}"; then
  echo "" >&2
  echo "Certbot failed. Common fixes:" >&2
  echo "  1. OCI Security List → Ingress: allow TCP 443 from 0.0.0.0/0" >&2
  echo "  2. DNS: dig +short ${API_DOMAIN} must match this VM's public IP" >&2
  echo "  3. Retry: sudo certbot --nginx -d ${API_DOMAIN}" >&2
  exit 1
fi

echo "==> Verifying HTTPS..."
sleep 2
if curl -sf "https://${API_DOMAIN}/health" | grep -q '"status"'; then
  echo "==> SUCCESS: https://${API_DOMAIN}/health"
else
  echo "WARNING: HTTPS cert installed but health check failed. Check:" >&2
  echo "  curl -v https://${API_DOMAIN}/health" >&2
  exit 1
fi

echo ""
echo "Next on VM (.env should already have HTTPS URLs):"
echo "  grep -E 'FRONTEND_URL|API_BASE_URL|TRUST_PROXY' ${ROOT}/.env"
echo "  cd ${ROOT} && ./infra/deploy-oracle.sh"
echo ""
echo "Cert auto-renewal: systemctl status certbot.timer"
