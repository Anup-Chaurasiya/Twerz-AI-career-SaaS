# Oracle VM — Connect & Operations

Quick reference for SSH access and day-to-day management of the **Twerz API** on Oracle Cloud (A1 Flex VM).

For first-time setup (DNS, Vercel, OAuth, Razorpay), see [DEPLOY.md](./DEPLOY.md).

---

## Quick connect (from your Mac)

```bash
ssh -i ~/.ssh/id_ed25519 opc@137.23.49.85
```

After connecting:

```bash
cd ~/GobioGo
```

### Debug login issues

Tail API logs while reproducing the login failure on the website:

```bash
docker compose --env-file .env \
  -f infra/docker-compose.prod.yml \
  logs -f api
```

Open a shell inside the API container:

```bash
docker compose --env-file .env \
  -f infra/docker-compose.prod.yml \
  exec api sh
```

Try logging in from [twerz.com](https://www.twerz.com/login) and watch the logs for OAuth or auth errors.

---

## Architecture (what runs where)

| Component | Where | URL / port |
|-----------|-------|------------|
| Next.js frontend | Vercel | `https://www.twerz.com` |
| FastAPI | Oracle VM (Docker) | API on `127.0.0.1:8080` |
| PostgreSQL | **Supabase** (hosted) | `DATABASE_URL` in `.env` |
| Reverse proxy | Nginx or Caddy on VM | `https://api.twerz.com` → `:8080` |

Repo on VM: **`~/GobioGo`**  
Default user: **`opc`** (this VM) — Ubuntu images use **`ubuntu`**

---

## Connect to the VM

### From your laptop (SSH)

```bash
# This VM (Oracle Linux)
ssh -i ~/.ssh/id_ed25519 opc@137.23.49.85

# Generic (Ubuntu image)
ssh -i ~/.ssh/oracle_twerz ubuntu@YOUR_VM_PUBLIC_IP
```

**First-time SSH key setup (Oracle Console):**

1. Generate a key pair locally if needed:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/oracle_twerz -C "twerz-vm"
   ```
2. Oracle Console → **Compute → Instances → your instance → Edit**
3. Paste the contents of `~/.ssh/oracle_twerz.pub` into **SSH keys**
4. Ensure OCI **Security List** allows **TCP 22** from your IP (or `0.0.0.0/0` for testing)

**SSH config shortcut** (`~/.ssh/config`):

```
Host twerz-vm
  HostName 137.23.49.85
  User opc
  IdentityFile ~/.ssh/id_ed25519
```

Then:

```bash
ssh twerz-vm
cd ~/GobioGo
```

### From GitHub Actions (CI/CD)

Push to `main` triggers [.github/workflows/deploy-oracle.yml](../.github/workflows/deploy-oracle.yml) via SSH secrets:

| GitHub secret | Value |
|---------------|-------|
| `ORACLE_HOST` | VM public IP |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | Private key (full PEM) |
| `ORACLE_APP_PATH` | `/home/ubuntu/GobioGo` |

Manual trigger: GitHub → **Actions → Deploy Oracle VM → Run workflow**.

---

## Essential commands (run on VM)

All commands assume you are in the app directory:

```bash
cd ~/GobioGo
```

Define the compose alias once per session (used throughout this doc):

```bash
COMPOSE="docker compose --env-file .env -f infra/docker-compose.prod.yml"
```

### Deploy / restart API

```bash
git pull
./infra/deploy-oracle.sh              # build + restart (normal deploy)
./infra/deploy-oracle.sh --preflight  # deploy + run infra/preflight.py checks
```

First deploy only (runs Alembic migrations):

```bash
./infra/deploy-oracle.sh --migrate --preflight
# then set RUN_MIGRATIONS=false in .env and redeploy
```

### Health checks

```bash
# API container (direct)
curl -s http://127.0.0.1:8080/health

# Through Nginx (public)
curl -s https://api.twerz.com/health

# Full smoke test
./infra/smoke-test.sh https://api.twerz.com
```

Expected: `{"status":"ok"}`

### View logs

```bash
$COMPOSE logs -f api          # follow API logs
$COMPOSE logs -f db           # Postgres logs
$COMPOSE logs --tail=100 api  # last 100 lines

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Container status

```bash
$COMPOSE ps
$COMPOSE top
docker stats                  # CPU / memory live
```

### Stop / start stack

```bash
$COMPOSE stop                 # stop containers (data preserved)
$COMPOSE start                # start again
$COMPOSE down                 # stop + remove containers (volumes kept)
$COMPOSE up -d                # start detached
```

### Shell into containers

```bash
$COMPOSE exec api bash        # API container shell
# Postgres is on Supabase — use Supabase SQL Editor or psql with DATABASE_URL
```

### Run migrations manually

```bash
$COMPOSE exec api uv run alembic upgrade head
$COMPOSE exec api uv run alembic current
$COMPOSE exec api uv run alembic history --verbose
```

### Preflight (config + deps check)

```bash
$COMPOSE exec api uv run python infra/preflight.py
```

---

## Environment & secrets

```bash
# Edit production env (never commit .env)
nano ~/GobioGo/.env

# After changing .env, redeploy
./infra/deploy-oracle.sh
```

Important variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres URI (`postgresql+asyncpg://...?ssl=require`, port **5432**) |
| `FRONTEND_URL` | OAuth redirect base — must match Google Console & Vercel domain |
| `API_BASE_URL` | Public API URL (`https://api.twerz.com`) |
| `RUN_MIGRATIONS` | `true` only on first deploy / schema changes |
| `TRUST_PROXY_HEADERS` | Must be `true` behind Nginx/Caddy |

Template: [infra/.env.production.example](./.env.production.example)

---

## Database (Supabase)

Production Postgres runs on **Supabase** — there is no `db` container on the VM.

### First-time / schema migrations

```bash
# .env must have Supabase DATABASE_URL (direct connection, port 5432)
grep DATABASE_URL .env

./infra/deploy-oracle.sh --migrate --preflight
# then set RUN_MIGRATIONS=false and redeploy
```

### Backup

Supabase dashboard: **Project → Database → Backups** (daily).

Optional manual dump:

```bash
./infra/backup-db.sh
```

### Restore (careful — overwrites Supabase data)

```bash
gunzip -c ~/backups/twerz/twerz_LATEST.sql.gz | \
  docker run -i --rm postgres:16 psql "$PGURL"
# PGURL = DATABASE_URL with postgresql+asyncpg → postgresql and sslmode=require
```

---

## Nginx & HTTPS

API must be reachable over **HTTPS** — Vercel rewrites to `https://api.twerz.com` and will **502** if only HTTP (port 80) works.

Symptoms when HTTPS is missing:

```text
curl https://api.twerz.com/health          → connection refused
curl https://www.twerz.com/auth/google/login → 502 ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR
ss -tlnp | grep 443                        → nothing listening
```

### Option A — Caddy (recommended on Oracle Linux)

Oracle Linux often lacks `certbot` and `snapd`. **Caddy** obtains and renews Let's Encrypt certs automatically — no certbot needed.

**Prerequisites:**

- DNS: `api.twerz.com` → VM public IP (`dig +short api.twerz.com`)
- OCI Security List: **TCP 80 and 443** open from `0.0.0.0/0`
- API running: `curl http://127.0.0.1:8080/health`

**One command (SSH into VM):**

```bash
cd ~/GobioGo
git pull
chmod +x infra/setup-caddy-ssl.sh
sudo ./infra/setup-caddy-ssl.sh api.twerz.com support@twerz.com
```

This script:

1. Stops and disables Nginx (frees ports 80/443)
2. Installs Caddy via `dnf copr`
3. Writes `/etc/caddy/Caddyfile` → reverse proxy to `127.0.0.1:8080`
4. Obtains TLS cert automatically
5. Verifies `https://api.twerz.com/health`

**After success — test login path:**

```bash
curl -s https://api.twerz.com/health
curl -s https://www.twerz.com/auth/google/login | head -c 200
# Should return JSON with "url":"https://accounts.google.com/..."
```

**Caddy maintenance:**

```bash
sudo systemctl status caddy
sudo systemctl reload caddy
sudo journalctl -u caddy -f
caddy validate --config /etc/caddy/Caddyfile
```

Config template: [infra/Caddyfile](./Caddyfile)

### Option B — Nginx + Certbot (Ubuntu/Debian only)

```bash
sudo ./infra/setup-nginx-ssl.sh api.twerz.com support@twerz.com
curl https://api.twerz.com/health
```

### Nginx maintenance (if still using Nginx)

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
sudo certbot renew --dry-run
```

Config template: [infra/nginx/twerz-api.conf](./nginx/twerz-api.conf)

---

## Disk & system maintenance

```bash
df -h                           # disk usage
docker system df                # Docker disk usage
docker system prune -f          # remove unused images/containers (safe-ish)

# Clear old Docker build cache if disk is low
docker builder prune -f

free -h                         # memory
htop                            # interactive (install: sudo apt install htop)
```

---

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Vercel login: **502** on `/auth/google/login` | API not reachable over HTTPS | Run `curl https://api.twerz.com/health`; run `setup-nginx-ssl.sh` if HTTP-only |
| **502** from Nginx | API container down | `$COMPOSE ps`; `$COMPOSE logs api`; `./infra/deploy-oracle.sh` |
| Google **redirect_uri_mismatch** | URI ≠ `FRONTEND_URL/auth/google/callback` | Align Google Console, `.env` `FRONTEND_URL`, and Vercel domain (www vs non-www) |
| **Invalid OAuth state** | CSRF cookie lost (domain mismatch) | Use one canonical frontend URL (`https://www.twerz.com` or `https://twerz.com`) everywhere |
| Migrations fail | Check Supabase `DATABASE_URL` (port 5432, `?ssl=require`); `RUN_MIGRATIONS=true` |
| OCI storage errors | Missing `~/.oci` mount | Run `oci setup config` on VM; verify `OCI_CONFIG_DIR` in `.env` |
| Certbot fails | Port 443 blocked or DNS wrong | OCI ingress rule for 443; `dig +short api.twerz.com` |
| Out of memory | A1 Flex limits | `$COMPOSE restart api`; check `docker stats`; reduce concurrent jobs |

### Quick diagnostic one-liner

```bash
cd ~/GobioGo && \
  echo "=== health ===" && curl -sf http://127.0.0.1:8080/health && \
  echo && echo "=== containers ===" && docker compose --env-file .env -f infra/docker-compose.prod.yml ps && \
  echo "=== nginx ===" && curl -sf https://api.twerz.com/health
```

---

## Useful paths

| Path | What |
|------|------|
| `~/GobioGo/.env` | Production secrets |
| `~/GobioGo/infra/docker-compose.prod.yml` | Docker stack definition |
| `~/GobioGo/infra/deploy-oracle.sh` | Main deploy script |
| `~/backups/twerz/` | Database backups |
| `~/.oci/` | Oracle Object Storage API keys |
| `/etc/nginx/sites-available/twerz-api` | Nginx site config |
| `/var/log/nginx/` | Nginx logs |

---

## Related docs

- [DEPLOY.md](./DEPLOY.md) — full production setup runbook
- [AGENTS.md](../AGENTS.md) — app architecture & API overview
- [COMMANDS.md](../COMMANDS.md) — local dev commands
