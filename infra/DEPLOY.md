# Oracle Cloud Production Deployment Runbook

Step-by-step guide for the **A1 Flex VM** (2 OCPU / 6 GB). Assumes VM, Docker, Git, and OCI config are already set up.

## Quick deploy (VM)

```bash
cd ~/GobioGo
git pull
cp infra/.env.production.example .env   # skip if .env exists
# edit .env with real secrets

chmod +x infra/deploy-oracle.sh infra/backup-db.sh infra/setup-nginx-ssl.sh
./infra/deploy-oracle.sh --migrate --preflight   # first time only
./infra/deploy-oracle.sh                         # subsequent deploys
```

After first `--migrate` success, set `RUN_MIGRATIONS=false` in `.env`.

---

## Phase 5 — Docker build & start

```bash
docker compose -f infra/docker-compose.prod.yml build
docker compose -f infra/docker-compose.prod.yml up -d
curl http://127.0.0.1:8080/health
docker compose -f infra/docker-compose.prod.yml exec api uv run python infra/preflight.py
```

---

## Phase 6 — Porkbun DNS + HTTPS

### DNS (Porkbun dashboard)

| Host | Type | Value |
|------|------|-------|
| `@` / `www` | per Vercel | frontend |
| `api` | A | VM public IP |

### Option A — Nginx + Certbot (recommended)

```bash
sudo ./infra/setup-nginx-ssl.sh api.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com
```

Config template: [infra/nginx/twerz-api.conf](nginx/twerz-api.conf)

### Option B — Caddy

Edit [infra/Caddyfile](Caddyfile) with your domain and email, then:

```bash
sudo apt install -y caddy
sudo cp infra/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Update `.env`:

```env
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://api.yourdomain.com
TRUST_PROXY_HEADERS=true
```

Restart API: `./infra/deploy-oracle.sh`

---

## Phase 7 — Vercel frontend

1. [vercel.com](https://vercel.com) → Import repo → **Root Directory: `frontend`**
2. Environment variables — see [frontend/.env.production.example](../frontend/.env.production.example)
3. Add custom domain → copy DNS records to Porkbun
4. Redeploy

---

## Phase 8 — Google OAuth + Razorpay

### Google Cloud Console → Credentials

| Setting | Value |
|---------|-------|
| Authorized JavaScript origins | `https://yourdomain.com` |
| Authorized redirect URIs | `https://yourdomain.com/auth/google/callback` |

Backend `.env`: `FRONTEND_URL=https://yourdomain.com`

### Razorpay Dashboard → Webhooks

| Setting | Value |
|---------|-------|
| Webhook URL | `https://api.yourdomain.com/payments/webhook` |
| Event | `payment.captured` |

Set `RAZORPAY_WEBHOOK_SECRET` in `.env` to match dashboard.

---

## Phase 9 — Sentry + uptime monitoring

1. Create project at [sentry.io](https://sentry.io) (Python/FastAPI)
2. Add to `.env`: `SENTRY_DSN=https://...@sentry.io/...`
3. Rebuild: `./infra/deploy-oracle.sh`
4. Optional frontend: `cd frontend && npx @sentry/wizard@latest -i nextjs`
5. [UptimeRobot](https://uptimerobot.com) — monitor `https://api.yourdomain.com/health` every 5 min

---

## Phase 10 — GitHub Actions CI/CD

Add repository secrets:

| Secret | Example |
|--------|---------|
| `ORACLE_HOST` | VM public IP |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | private key contents |
| `ORACLE_APP_PATH` | `/home/ubuntu/GobioGo` |

Push to `main` triggers [.github/workflows/deploy-oracle.yml](../.github/workflows/deploy-oracle.yml).

---

## Phase 11 — Production smoke test

```bash
./infra/smoke-test.sh https://api.yourdomain.com
```

Manual checklist:

- [ ] Google login works
- [ ] Upload PDF → profile structured
- [ ] Create job → tailor resume
- [ ] Generate + download PDF
- [ ] Razorpay test payment → credits added
- [ ] Error appears in Sentry (trigger once, then fix)

---

## Backups

```bash
./infra/backup-db.sh
# Cron: 0 3 * * * /home/ubuntu/GobioGo/infra/backup-db.sh
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OCI storage fails in container | Ensure `~/.oci` mounted; `OCI_CONFIG_PATH=/root/.oci/config` |
| Migrations fail | Set `RUN_MIGRATIONS=true`, check `POSTGRES_PASSWORD` matches db service |
| 502 from Nginx | `docker compose ... logs api`; confirm API on :8080 |
| OAuth redirect mismatch | Google Console URI must exactly match `FRONTEND_URL/auth/google/callback` |
