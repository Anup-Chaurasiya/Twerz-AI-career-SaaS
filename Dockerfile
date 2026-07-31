FROM python:3.12-slim

# System deps: TeX Live for PDF generation, poppler for pdf2image
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    lmodern \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# UV package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Install dependencies first (Docker layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY resume.cls .
COPY templates/latex/ templates/latex/
COPY infra/entrypoint.sh /entrypoint.sh
COPY infra/preflight.py infra/preflight.py

# Install project package into venv
RUN uv sync --frozen --no-dev

RUN chmod +x /entrypoint.sh

ENV LATEX_BIN_PATH=/usr/bin \
    PYTHONUNBUFFERED=1

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
