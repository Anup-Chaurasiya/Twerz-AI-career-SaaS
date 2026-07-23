"""Alerting service — Phase 7: Reliability & Observability.

Fires alert webhooks (Slack/Discord compatible JSON payload) and
captures messages/exceptions to Sentry when configured.
No-op when ALERT_WEBHOOK_URL and SENTRY_DSN are not set.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


async def alert(message: str, *, level: str = "warning", context: dict[str, Any] | None = None) -> None:
    """Send an operational alert to Slack/webhook and Sentry.

    Args:
        message: Human-readable alert summary.
        level: 'info' | 'warning' | 'error' | 'critical'
        context: Optional dictionary of debugging context (job_id, user_id, error, etc.)
    """
    settings = get_settings()

    # 1. Log locally
    log_fn = getattr(logger, level.lower(), logger.warning)
    log_fn("[ALERT] %s (context=%s)", message, context or {})

    # 2. Sentry capture (if SENTRY_DSN set)
    if settings.SENTRY_DSN:
        try:
            import sentry_sdk

            with sentry_sdk.push_scope() as scope:
                if context:
                    scope.set_extra("alert_context", context)
                sentry_sdk.capture_message(message, level=level)
        except Exception as exc:
            logger.debug("Failed to report alert to Sentry: %s", exc)

    # 3. Webhook alert (if ALERT_WEBHOOK_URL set)
    if settings.ALERT_WEBHOOK_URL:
        try:
            import httpx

            payload = {
                "text": f"*:warning: ATS Beater Alert [{level.upper()}]*\n{message}",
                "attachments": [
                    {
                        "color": "#f97316" if level in ("warning", "error") else "#ef4444",
                        "fields": [
                            {"title": k, "value": str(v), "short": True}
                            for k, v in (context or {}).items()
                        ],
                    }
                ]
                if context
                else [],
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(settings.ALERT_WEBHOOK_URL, json=payload)
        except Exception as exc:
            logger.debug("Failed to post alert webhook: %s", exc)
