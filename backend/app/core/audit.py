"""Audit logging for secret access events. Never logs secret values."""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("myvault.audit")


def log_secret_access(
    user_id: str,
    app_slug: str,
    action: str,
    accessed_by: str | None = None,
    detail: str = "",
) -> None:
    """Log an access event to the audit trail."""
    logger.info(
        "AUDIT | %s | user=%s | app=%s | by=%s | %s",
        action,
        user_id,
        app_slug,
        accessed_by or user_id,
        detail,
        extra={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "user_id": user_id,
            "app_slug": app_slug,
            "accessed_by": accessed_by or user_id,
            "detail": detail,
        },
    )
