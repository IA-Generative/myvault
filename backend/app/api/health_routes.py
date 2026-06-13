"""Health check endpoints for liveness and readiness probes."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger("myvault.health")

router = APIRouter(tags=["Health"])


@router.get("/health/live")
async def liveness():
    """Liveness probe: application is running."""
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """Readiness probe: application can serve requests (DB connected)."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        # Log the detail server-side; do not leak DSN/host in the response.
        logger.exception("Readiness check failed")
        return {"status": "error", "database": "unavailable"}
