# Oracle Cloud Production Deployment Runbook

Step-by-step guide for the **A1 Flex VM** (2 OCPU / 6 GB). Assumes VM, Docker, Git, and OCI config are already set up.

**Day-to-day SSH, logs, backups, and troubleshooting:** [VM_OPS.md](./VM_OPS.md)

## Quick deploy (VM)

```bash
cd ~/GobioGo
git pull
cp infra/.env.production.example .env   # skip if .env exists
# edit .env: set DATABASE_URL to Supabase URI (see Phase 4 below)

chmod +x infra/deploy-oracle.sh infra/backup-db.sh infra/setup-nginx-ssl.sh infra/setup-caddy-ssl.sh
./infra/deploy-oracle.sh --migrate --preflight   # first time only
./infra/deploy-oracle.sh                         # subsequent deploys
```

After first `--migrate` success, set `RUN_MIGRATIONS=false` in `.env`.

---

## Phase 4 — Supabase database

Production uses **Supabase Postgres** — no `db` container on the VM.

1. [supabase.com](https://supabase.com) → your project → **Project Settings → Database**
2. Copy **Connection string → URI** (use **Direct connection**, port **5432** — not transaction pooler 6543 for migrations)
3. Convert for this app:
   - Replace `postgresql://` with `postgresql+asyncpg://`
   - Append `?ssl=require` if not present
4. Set in VM `.env` (project **krqemahdmwcvfvthceqb**):
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:YOUR-PASSWORD@db.krqemahdmwcvfvthceqb.supabase.co:5432/postgres?ssl=require
   RUN_MIGRATIONS=true
   ```
   Percent-encode special characters in the password (e.g. `@` → `%40`, `#` → `%23`).
5. Deploy and migrate:
   ```bash
   ./infra/deploy-oracle.sh --migrate --preflight
   ```
6. After success: `RUN_MIGRATIONS=false` in `.env`, redeploy `./infra/deploy-oracle.sh`

**Remove old local Postgres container** (if you previously ran the VM db service):

```bash
docker stop $(docker ps -q --filter name=db) 2>/dev/null || true
docker compose -f infra/docker-compose.prod.yml up -d --remove-orphans
```

Backups: Supabase dashboard (daily) + optional `./infra/backup-db.sh` on the VM.

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

### Option A — Caddy (recommended on Oracle Linux)

Oracle Linux lacks `certbot`/`snapd` in default repos. Use Caddy for automatic HTTPS:

```bash
cd ~/GobioGo && git pull
chmod +x infra/setup-caddy-ssl.sh
sudo ./infra/setup-caddy-ssl.sh api.twerz.com support@twerz.com
curl https://api.twerz.com/health   # expect {"status":"ok"}
curl -s https://www.twerz.com/auth/google/login | head -c 200   # expect JSON, not 502
```

Stops Nginx, installs Caddy, obtains Let's Encrypt cert, proxies `api.twerz.com` → `127.0.0.1:8080`.

### Option B — Nginx + Certbot (Ubuntu/Debian only)

**Before running:** open OCI **Networking → VCN → Security List → Ingress Rules** and add **TCP 443** from `0.0.0.0/0` (port 80 should already be open).

One command on the VM (DNS must already point `api.twerz.com` → VM IP):

```bash
cd ~/GobioGo && git pull
sudo ./infra/setup-nginx-ssl.sh api.twerz.com support@twerz.com
curl https://api.twerz.com/health   # expect {"status":"ok"}
./infra/deploy-oracle.sh            # reload if .env changed
```

Config template: [infra/nginx/twerz-api.conf](nginx/twerz-api.conf)

### Option C — Caddy manual (if script fails)

Edit [infra/Caddyfile](Caddyfile) with your domain and email, then:

```bash
sudo cp infra/Caddyfile /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy
```

Update `.env`:

```env
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://api.yourdomain.com
TRUST_PROXY_HEADERS=true
```

Restart API: `./infra/deploy-oracle.sh`

---

## Phase 7 — Vercel frontend (twerz.com)

1. [vercel.com](https://vercel.com) → Import repo → **Root Directory: `frontend`**
2. **Production** environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.twerz.com` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | your Razorpay key (same as backend `RAZORPAY_KEY_ID`) |

3. Deploy → **Settings → Domains** → add `twerz.com` and `www.twerz.com`
4. Porkbun DNS (from Vercel domain panel):

| Host | Type | Value |
|------|------|-------|
| `@` | A or ALIAS | Vercel-provided |
| `www` | CNAME | Vercel-provided |
| `api` | A | VM public IP (already set) |

5. Redeploy after env vars are saved

---

## Phase 8 — Google OAuth + Razorpay (twerz.com)

### Google Cloud Console → Credentials

Keep localhost entries for dev. Add production:

| Setting | Value |
|---------|-------|
| Authorized JavaScript origins | `https://twerz.com` |
| Authorized redirect URIs | `https://api.twerz.com/auth/google/callback` (required). Optional legacy: `https://www.twerz.com/auth/google/callback` |

VM `.env`: `FRONTEND_URL=https://www.twerz.com`

### Razorpay Dashboard → Webhooks

| Setting | Value |
|---------|-------|
| Webhook URL | `https://api.twerz.com/payments/webhook` |
| Event | `payment.captured` |

Copy webhook secret → VM `.env`: `RAZORPAY_WEBHOOK_SECRET=...` then `./infra/deploy-oracle.sh`

---

## Phase 9 — Sentry + uptime monitoring

1. Project DSN already in VM `.env` as `SENTRY_DSN=...`
2. **Verify once:** `curl https://api.twerz.com/sentry-debug` (returns 500 — intentional)
3. Confirm event in [sentry.io](https://sentry.io) dashboard
4. **Then disable debug:** set `SENTRY_DEBUG=false` in VM `.env` and redeploy
5. [UptimeRobot](https://uptimerobot.com) — monitor `https://api.twerz.com/health` every 5 min

---

## Phase 10 — GitHub Actions CI/CD

Add repository secrets:

| Secret | Example |
|--------|---------|
| `ORACLE_HOST` | `137.23.49.85` |
| `ORACLE_USER` | `opc` (Oracle Linux) or `ubuntu` (Ubuntu image) |
| `ORACLE_SSH_KEY` | Full private key PEM from your laptop (`cat ~/.ssh/id_ed25519`) |
| `ORACLE_APP_PATH` | `/home/opc/GobioGo` (this VM) or `/home/ubuntu/GobioGo` (Ubuntu) |

Push to `main` triggers [.github/workflows/deploy-oracle.yml](../.github/workflows/deploy-oracle.yml).

---

## Phase 11 — Production smoke test

```bash
./infra/smoke-test.sh https://api.twerz.com
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

Supabase provides daily backups in **Project → Database → Backups**.

Optional manual dump from the VM:

```bash
./infra/backup-db.sh
# Cron: 0 3 * * * /home/opc/GobioGo/infra/backup-db.sh
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OCI storage fails in container | Ensure `~/.oci` mounted; `OCI_CONFIG_PATH=/root/.oci/config` |
| Migrations fail | `RUN_MIGRATIONS=true`; verify Supabase `DATABASE_URL` uses port **5432** + `?ssl=require` |
| 502 from Nginx | `docker compose ... logs api`; confirm API on :8080 |
| OAuth redirect mismatch | Google Console must include `API_BASE_URL/auth/google/callback` (e.g. `https://api.twerz.com/auth/google/callback`) |
