#!/usr/bin/env bash
# Install Caddy, replace Nginx, and enable automatic HTTPS for api.twerz.com.
#
# Use this on Oracle Linux (or any RHEL-like) when certbot/snapd are unavailable.
# Caddy obtains and renews Let's Encrypt certificates automatically.
#
# Prerequisites:
#   - DNS A record: api.twerz.com → this VM's public IP
#   - OCI Security List: TCP 80 + 443 from 0.0.0.0/0
#   - API running: curl -sf http://127.0.0.1:8080/health
#
# Usage:
#   sudo ./infra/setup-caddy-ssl.sh api.twerz.com support@twerz.com
set -euo pipefail

API_DOMAIN="${1:-}"
LE_EMAIL="${2:-}"

if [[ -z "$API_DOMAIN" || -z "$LE_EMAIL" ]]; then
  echo "Usage: sudo $0 api.twerz.com support@twerz.com" >&2
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo $0 $*" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CADDY_DIR="/etc/caddy"
CADDYFILE="${CADDY_DIR}/Caddyfile"

echo "==> Verifying API upstream..."
if ! curl -sf "http://127.0.0.1:8080/health" >/dev/null; then
  echo "ERROR: API not healthy on 127.0.0.1:8080. Start the stack first:" >&2
  echo "  cd ${ROOT} && ./infra/deploy-oracle.sh" >&2
  exit 1
fi

echo "==> Stopping Nginx (Caddy needs ports 80 and 443)..."
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl stop nginx
  systemctl disable nginx
  echo "    Nginx stopped and disabled."
elif command -v nginx >/dev/null 2>&1; then
  nginx -s stop 2>/dev/null || true
  echo "    Nginx stopped."
else
  echo "    Nginx not installed — OK."
fi

echo "==> Installing Caddy..."
if ! command -v caddy >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y 'dnf-command(copr)' || true
    dnf copr enable -y @caddy/caddy 2>/dev/null || dnf copr enable @caddy/caddy -y
    dnf install -y caddy
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y caddy
  else
    echo "ERROR: Could not detect dnf or apt. Install Caddy manually:" >&2
    echo "  https://caddyserver.com/docs/install" >&2
    exit 1
  fi
else
  echo "    Caddy already installed: $(caddy version)"
fi

echo "==> Writing ${CADDYFILE}..."
mkdir -p "$CADDY_DIR"
cat > "$CADDYFILE" <<EOF
# Managed by infra/setup-caddy-ssl.sh — do not edit by hand without redeploying.
{
    email ${LE_EMAIL}
}

${API_DOMAIN} {
    reverse_proxy 127.0.0.1:8080 {
        flush_interval -1
    }
    request_body {
        max_size 10MB
    }
}
EOF

echo "==> Validating Caddyfile..."
caddy validate --config "$CADDYFILE"

echo "==> Enabling Caddy..."
systemctl enable caddy
systemctl restart caddy

echo "==> Waiting for certificate (up to 60s)..."
for i in $(seq 1 30); do
  if curl -sf "https://${API_DOMAIN}/health" 2>/dev/null | grep -q '"status"'; then
    echo "==> SUCCESS: https://${API_DOMAIN}/health"
    curl -s "https://${API_DOMAIN}/health"
    echo ""
    echo ""
    echo "Next steps:"
    echo "  1. Verify Vercel proxy: curl -s https://www.twerz.com/auth/google/login | head -c 200"
    echo "  2. Update .env if needed:"
    echo "       FRONTEND_URL=https://www.twerz.com"
    echo "       API_BASE_URL=https://${API_DOMAIN}"
    echo "  3. Redeploy API: cd ${ROOT} && ./infra/deploy-oracle.sh"
    echo ""
    echo "Caddy status:  systemctl status caddy"
    echo "Caddy logs:    journalctl -u caddy -f"
    exit 0
  fi
  sleep 2
done

echo "WARNING: HTTPS not ready after 60s. Check:" >&2
echo "  journalctl -u caddy --no-pager -n 50" >&2
echo "  curl -v https://${API_DOMAIN}/health" >&2
echo "  dig +short ${API_DOMAIN}  (must match VM public IP)" >&2
echo "  OCI Security List must allow TCP 443" >&2
exit 1
