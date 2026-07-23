# Production Setup Guide - Critical Services

This document outlines what external services you **must** configure before deploying to production with multiple Cloud Run instances.

---

## ✅ Already Configured (No Action Needed)

These are already set up in your `.env` and work out of the box:

- ✅ **PostgreSQL** - Cloud SQL or local
- ✅ **Google OAuth** - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- ✅ **GCS Storage** - `GCS_BUCKET_NAME`, service account JSON
- ✅ **Razorpay** - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- ✅ **LiteLLM** - `LLM_FLASH_MODEL`, `LLM_PRO_MODEL` with provider API keys

---

## 🚨 REQUIRED for Production (Currently Missing)

### 1. **Sentry - Error Tracking & Monitoring** 

**Why it's critical:**
- Catches exceptions in production before users report them
- Tracks performance bottlenecks (slow API calls, memory leaks)
- Alerts you when something breaks (Slack/email integration)

**Status:** ✅ Code is ready, just needs configuration

**Setup Steps:**

1. **Create Sentry Account**
   ```bash
   # Go to https://sentry.io and sign up (free tier available)
   # Create a new project → Select "FastAPI"
   # Copy the DSN (looks like: https://abc123@o123.ingest.sentry.io/456)
   ```

2. **Install Sentry SDK**
   ```bash
   uv add sentry-sdk
   ```

3. **Add to .env**
   ```bash
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   ENVIRONMENT=production  # or staging, dev
   ```

4. **Verify it works**
   ```bash
   # Start your server and trigger an error
   # Check Sentry dashboard - you should see the error appear within seconds
   ```

**What gets tracked:**
- All unhandled exceptions (500 errors)
- Background task failures
- GCS upload failures
- LaTeX compilation errors
- LLM API failures

**Alerts to configure in Sentry:**
- Slack webhook when error rate > 5/min
- Email notification for new error types
- Performance alert when p95 latency > 5s

---

### 2. **Redis - Distributed Rate Limiting**

**Why it's critical:**
- In-memory rate limiter doesn't work with multiple Cloud Run instances
- Without Redis: "30 req/min" becomes "30 req/min **per instance**" (no real limit!)
- Public endpoints (/public/ats-check) will be abused without proper rate limiting

**Status:** ✅ Code is ready, just needs configuration

**Setup Steps:**

#### **Option A: Google Cloud Memorystore (Recommended for production)**
```bash
# 1. Create Memorystore Redis instance
gcloud redis instances create atsbeater-redis \
    --size=1 \
    --region=us-central1 \
    --tier=basic \
    --redis-version=redis_7_0

# 2. Get connection info
gcloud redis instances describe atsbeater-redis --region=us-central1

# 3. Add to .env (use internal IP if in same VPC)
REDIS_URL=redis://10.0.0.3:6379
```

**Cost:** ~$40/month for 1GB basic tier

#### **Option B: Redis Cloud (Easier, free tier available)**
```bash
# 1. Go to https://redis.com/try-free/
# 2. Create free 30MB database (enough for rate limiting)
# 3. Copy connection string

# 4. Add to .env
REDIS_URL=redis://default:password@redis-12345.cloud.redislabs.com:12345
```

**Cost:** Free for 30MB, $5/month for 100MB

#### **Option C: Self-hosted (Not recommended - operational burden)**
```bash
# Only use for testing, NOT production
docker run -d -p 6379:6379 redis:7-alpine
REDIS_URL=redis://localhost:6379
```

**Install Redis client:**
```bash
uv add redis
```

**Verify it works:**
```bash
# After starting server, check logs:
# "Redis rate limiter initialized successfully" ✅
# NOT "REDIS_URL not configured - rate limiting disabled" ❌
```

**What's rate limited:**
- `/public/ats-check` - 30 req/min per IP (prevents abuse)
- `/roasts/shared/{id}` - 30 req/min per IP (prevents scraping)

---

### 3. **Alert Webhook (Optional but Recommended)**

**Why it's useful:**
- Get Slack/Discord notifications for critical errors
- Faster response time than checking Sentry dashboard
- Can trigger PagerDuty for on-call rotation

**Setup Steps:**

#### **For Slack:**
```bash
# 1. Go to https://api.slack.com/messaging/webhooks
# 2. Create incoming webhook for your channel
# 3. Copy webhook URL

# 4. Add to .env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

#### **For Discord:**
```bash
# 1. Server Settings → Integrations → Webhooks → New Webhook
# 2. Copy webhook URL

# 3. Add to .env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/token
```

**What gets alerted:**
- Repeated PDF generation failures (>3 in 5 minutes)
- GCS upload failures after all retries
- Stuck job recovery on server restart
- Credit refund failures (manual review needed)

---

## 📊 Monitoring Dashboard (Recommended)

Once Sentry is configured, set up these dashboards:

### **Key Metrics to Monitor:**

1. **Error Rate**
   - Target: < 1% of requests
   - Alert if: > 5% for 5 minutes

2. **P95 Latency**
   - Resume generation: < 30s
   - PDF compilation: < 10s
   - API requests: < 500ms

3. **Background Task Queue**
   - Target: tasks complete within 2 minutes
   - Alert if: queue depth > 100

4. **Credit System Health**
   - Daily free reset success rate: 100%
   - Refund success rate: 100%
   - Failed transactions requiring manual review

5. **Storage Health**
   - GCS upload success rate: > 95%
   - Local PDF cleanup (shouldn't grow unbounded)

---

## 🔧 Configuration Summary

Add these to your `.env` file before production deployment:

```bash
# === CRITICAL FOR PRODUCTION ===

# 1. Error tracking (REQUIRED)
SENTRY_DSN=https://your-key@sentry.io/project-id
ENVIRONMENT=production  # or staging

# 2. Rate limiting (REQUIRED for multi-instance)
REDIS_URL=redis://your-redis-host:6379

# 3. Alerting (highly recommended)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK

# === OPTIONAL BUT USEFUL ===

# Model pinning (prevents surprise API changes)
LLM_FLASH_MODEL=gemini-2.0-flash-exp  # Pin exact version, not "latest"
LLM_PRO_MODEL=gemini-2.0-flash-thinking-exp

# Rate limit tuning (default: 30)
RATE_LIMIT_PUBLIC_RPM=50  # Increase if legitimate traffic hits limit
```

---

## 🧪 Pre-Production Checklist

Before going live, verify:

- [ ] Sentry DSN is set and errors appear in dashboard
- [ ] Redis URL is set and rate limiting works across multiple test instances
- [ ] Alert webhook fires correctly (test by triggering a mock error)
- [ ] All 283 tests pass: `uv run pytest tests/ --ignore=tests/integration`
- [ ] Golden JD matrix passes: `INTEGRATION=1 GOLDEN_STRICT=1 uv run pytest tests/integration/test_golden_jd_matrix.py`
- [ ] Load test public endpoints (should get 429 after 30 req/min per IP)
- [ ] Monitor Sentry for first 24 hours after deployment

---

## 🚀 Deployment Commands

```bash
# 1. Set all required env vars in Cloud Run
gcloud run services update atsbeater-api \
  --update-env-vars SENTRY_DSN=https://...,REDIS_URL=redis://...,ENVIRONMENT=production

# 2. Deploy new version
gcloud run deploy atsbeater-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# 3. Verify deployment
curl https://your-api.run.app/health
# Should return: {"status": "ok"}

# 4. Check logs for successful initialization
gcloud run logs read --service=atsbeater-api --limit=50 | grep -E "Sentry|Redis"
# Look for:
# "Sentry initialized successfully (DSN configured)" ✅
# "Redis rate limiter initialized successfully" ✅
```

---

## 📞 Support Resources

- **Sentry Docs:** https://docs.sentry.io/platforms/python/guides/fastapi/
- **Redis Cloud:** https://redis.com/try-free/
- **Google Memorystore:** https://cloud.google.com/memorystore/docs/redis
- **Slack Webhooks:** https://api.slack.com/messaging/webhooks

---

## 💡 Cost Summary

Minimal production setup:

| Service | Cost | Required? |
|---------|------|-----------|
| Sentry (free tier) | $0/month | ✅ Yes |
| Redis Cloud (30MB) | $0/month | ✅ Yes |
| Slack webhooks | $0/month | ⚠️ Recommended |
| **Total** | **$0/month** | |

Production-ready setup:

| Service | Cost | Required? |
|---------|------|-----------|
| Sentry (team tier) | $26/month | ✅ Yes |
| Memorystore (1GB) | $40/month | ✅ Yes |
| Slack (free) | $0/month | ⚠️ Recommended |
| **Total** | **$66/month** | |

Choose based on your scale and budget. Free tier is fine for < 10K requests/day.
