# ATS Beater - Command Reference

## 🚀 Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
uv sync --extra dev

# 3. Run migrations
uv run alembic upgrade head

# 4. Start development server
uv run uvicorn app.main:app --reload --port 8000
# Or: uv run python -m app.main

# 5. Access API
# API Docs: http://localhost:8000/docs
# Health Check: http://localhost:8000/health
```

## 📦 Database Commands

```bash
# Run all pending migrations
uv run alembic upgrade head

# Rollback one migration
uv run alembic downgrade -1

# Show migration history
uv run alembic history

# Create a new migration
uv run alembic revision -m "description_of_change"

# Auto-generate migration from model changes
uv run alembic revision --autogenerate -m "description"

# Check current version
uv run alembic current

# Show SQL for migration (don't run)
uv run alembic upgrade head --sql
```

## 🧪 Testing Commands

```bash
# Run all unit tests (fast, in-memory SQLite)
uv run pytest tests/ -v --ignore=tests/integration

# Run with coverage
uv run pytest tests/ --cov=app --cov-report=html --ignore=tests/integration

# Run integration tests (requires real DB + Gemini API key + pdflatex)
INTEGRATION=1 uv run pytest tests/integration/ -v

# Run specific test file
uv run pytest tests/test_api/test_jobs.py -v

# Run specific test function
uv run pytest tests/test_api/test_jobs.py::test_create_job -v

# Run tests matching a pattern
uv run pytest -k "test_credit" -v

# Show print statements during tests
uv run pytest tests/ -v -s
```

## 🔧 Development Commands

```bash
# Install new dependency
uv add package-name

# Install dev dependency
uv add --dev package-name

# Update all dependencies
uv lock --upgrade

# Sync dependencies (after pulling changes)
uv sync

# Run Python REPL with app context
uv run python

# Format code with black
uv run black app/ tests/

# Lint with ruff
uv run ruff check app/ tests/

# Type check with mypy
uv run mypy app/
```

## 🐳 Docker Commands

```bash
# Start PostgreSQL only
docker compose up -d

# Stop PostgreSQL
docker compose down

# View logs
docker compose logs -f

# Rebuild containers
docker compose up -d --build

# Remove volumes (WARNING: deletes data)
docker compose down -v

# Connect to PostgreSQL
docker exec -it gobiogo-db-1 psql -U postgres -d custom_resume_dev
```

## 📊 Database Management

```bash
# Access PostgreSQL CLI
docker exec -it gobiogo-db-1 psql -U postgres -d custom_resume_dev

# Common psql commands (once inside):
\dt                  # List all tables
\d table_name        # Describe table schema
\d+ table_name       # Detailed table info
\l                   # List databases
\q                   # Quit

# SQL queries examples:
SELECT * FROM users LIMIT 5;
SELECT * FROM jobs WHERE status = 'READY' LIMIT 10;
SELECT * FROM credit_transactions ORDER BY created_at DESC LIMIT 20;
SELECT COUNT(*) FROM users;
SELECT status, COUNT(*) FROM jobs GROUP BY status;
```

## 🔐 Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
nano .env
# or
vim .env
# or
code .env

# Required variables for basic dev:
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/custom_resume_dev
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
JWT_SECRET=change-this-to-random-secret
DEV_AUTH_BYPASS=true  # Skip OAuth in development
```

## 🚢 Production Deployment

```bash
# Build for production (Cloud Run example)
docker build -t ats-beater .

# Tag for Google Container Registry
docker tag ats-beater gcr.io/your-project/ats-beater

# Push to registry
docker push gcr.io/your-project/ats-beater

# Deploy to Cloud Run
gcloud run deploy ats-beater \
  --image gcr.io/your-project/ats-beater \
  --platform managed \
  --region us-central1 \
  --set-env-vars "DATABASE_URL=your_production_db_url"

# See full deployment script
./infra/deploy-cloudrun.sh
```

## 🔍 Debugging Commands

```bash
# Check Python version
python --version

# Check UV version
uv --version

# Check pdflatex installation
which pdflatex
pdflatex --version

# Check if port 8000 is in use
lsof -i :8000

# Kill process on port 8000
kill -9 $(lsof -t -i:8000)

# Check PostgreSQL connection
docker exec -it gobiogo-db-1 pg_isready -U postgres

# View recent logs
tail -f logs/app.log  # if logging to file

# Check disk space (PDFs can accumulate)
du -sh app/data/pdfs/
```

## 📝 Migration Workflow

```bash
# 1. Make changes to models in app/models/
# Example: Add new column to User model

# 2. Generate migration
uv run alembic revision --autogenerate -m "add_new_user_field"

# 3. Review generated migration in alembic/versions/
# Edit if needed (auto-generate isn't perfect)

# 4. Test migration up
uv run alembic upgrade head

# 5. Test migration down
uv run alembic downgrade -1

# 6. Re-apply if okay
uv run alembic upgrade head

# 7. Commit migration file
git add alembic/versions/xxx_add_new_user_field.py
git commit -m "Add new user field migration"
```

## 🧹 Cleanup Commands

```bash
# Remove __pycache__ directories
find . -type d -name __pycache__ -exec rm -rf {} +

# Remove pytest cache
rm -rf .pytest_cache

# Remove coverage files
rm -rf htmlcov .coverage

# Remove temporary PDF files
rm -rf app/data/pdfs/*.pdf

# Clean Docker volumes (WARNING: deletes DB data)
docker compose down -v

# Full clean (start fresh)
docker compose down -v
rm -rf .pytest_cache __pycache__ htmlcov .coverage
find . -type d -name __pycache__ -exec rm -rf {} +
```

## 📈 Monitoring & Analytics

```bash
# Check API health
curl http://localhost:8000/health

# Get current user (requires token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/auth/me

# Admin overview (requires super admin token)
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  http://localhost:8000/admin/overview

# Monitor database size
docker exec -it gobiogo-db-1 psql -U postgres -d custom_resume_dev \
  -c "SELECT pg_size_pretty(pg_database_size('custom_resume_dev'));"

# Count records in key tables
docker exec -it gobiogo-db-1 psql -U postgres -d custom_resume_dev \
  -c "SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM profiles) as profiles,
    (SELECT COUNT(*) FROM jobs) as jobs,
    (SELECT COUNT(*) FROM credit_transactions) as transactions;"
```

## 🎯 Common Development Workflows

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes to models/services/APIs
# ... edit files ...

# 3. Generate and run migration if needed
uv run alembic revision --autogenerate -m "add_new_feature_tables"
uv run alembic upgrade head

# 4. Write tests
# ... create test file in tests/ ...

# 5. Run tests
uv run pytest tests/test_api/test_new_feature.py -v

# 6. Test manually
uv run uvicorn app.main:app --reload --port 8000
# Test in browser or with curl

# 7. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

### Fixing a Bug

```bash
# 1. Reproduce the bug
# Write a failing test first

# 2. Fix the code
# ... make changes ...

# 3. Verify fix
uv run pytest tests/test_specific_bug.py -v

# 4. Run full test suite
uv run pytest tests/ -v

# 5. Commit
git commit -am "Fix bug: description"
```

### Database Reset (Development Only)

```bash
# WARNING: This deletes all data!

# 1. Stop app
# Ctrl+C if running

# 2. Drop and recreate database
docker compose down -v
docker compose up -d

# Wait for postgres to start (5-10 seconds)
sleep 10

# 3. Run migrations
uv run alembic upgrade head

# 4. Seed data if needed
uv run python scripts/seed_data.py  # if you have seed script

# 5. Restart app
uv run uvicorn app.main:app --reload --port 8000
```

## 📚 Useful SQL Queries

```sql
-- Find users with most jobs
SELECT u.email, u.name, COUNT(j.id) as job_count
FROM users u
LEFT JOIN jobs j ON j.user_id = u.id
GROUP BY u.id
ORDER BY job_count DESC
LIMIT 10;

-- Find failed jobs with error logs
SELECT id, user_id, status, pdf_error_log
FROM jobs
WHERE status = 'FAILED' AND pdf_error_log IS NOT NULL
ORDER BY created_at DESC;

-- Credit balance summary
SELECT 
  u.email,
  uc.balance as credits,
  uc.daily_free_used,
  uc.daily_free_reset_date
FROM users u
JOIN user_credits uc ON uc.user_id = u.id
ORDER BY uc.balance DESC;

-- Recent transactions
SELECT 
  u.email,
  ct.amount,
  ct.type,
  ct.description,
  ct.created_at
FROM credit_transactions ct
JOIN users u ON u.id = ct.user_id
ORDER BY ct.created_at DESC
LIMIT 20;

-- Job status breakdown
SELECT status, COUNT(*) as count
FROM jobs
GROUP BY status
ORDER BY count DESC;

-- GCS upload failures
SELECT id, user_id, status, gcs_upload_failed, pdf_gcs_path
FROM jobs
WHERE gcs_upload_failed = true
ORDER BY created_at DESC;
```

## 🔄 Recent Updates Applied

### Database Migrations
- `j1k2l3m4n5o6` - Profile enhance rate limit
- `k2l3m4n5o6p7` - PDF error log
- `l3m4n5o6p7q8` - GCS upload failed flag
- `m4n5o6p7q8r9` - Onboarding completed

### To verify migrations are applied:
```bash
uv run alembic current
# Should show: m4n5o6p7q8r9 (head)
```

## 🆘 Troubleshooting

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>
```

### Database connection issues
```bash
# Check if postgres is running
docker ps

# Restart postgres
docker compose restart

# Check logs
docker compose logs postgres
```

### Migration conflicts
```bash
# Check current state
uv run alembic current

# If stuck, rollback and reapply
uv run alembic downgrade base
uv run alembic upgrade head
```

### Tests failing
```bash
# Clear pytest cache
rm -rf .pytest_cache

# Reinstall dependencies
uv sync

# Run single test to debug
uv run pytest tests/path/to/test.py::test_name -v -s
```
