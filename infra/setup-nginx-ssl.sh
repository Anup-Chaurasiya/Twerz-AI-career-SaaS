#!/usr/bin/env bash
# Install Nginx + Certbot and enable API reverse proxy on Ubuntu (Oracle VM).
# Usage: sudo ./infra/setup-nginx-ssl.sh api.yourdomain.com
set -euo pipefail

API_DOMAIN="${1:-}"
if [[ -z "$API_DOMAIN" ]]; then
  echo "Usage: sudo $0 api.yourdomain.com" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="/etc/nginx/sites-available/twerz-api"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

sed "s/api.yourdomain.com/${API_DOMAIN}/g" "${ROOT}/infra/nginx/twerz-api.conf" > "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/twerz-api
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Nginx proxying http://${API_DOMAIN} -> 127.0.0.1:8080"
echo "==> Run certbot when DNS A record points to this VM:"
echo "    certbot --nginx -d ${API_DOMAIN}"
