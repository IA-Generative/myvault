"""Routes for the bridge feature: export/import credentials in multiple formats."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.models.schemas import BridgeImportRequest
from app.services import bridge_service

router = APIRouter(prefix="/api/v1/me/bridge", tags=["Bridge"])


@router.get("/{app_slug}")
async def export_credentials(
    app_slug: str,
    format: str = Query(default="json", regex="^(json|env|yaml)$"),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export user credentials for an app in the requested format."""
    result = await bridge_service.export_bridge(db, user.user_id, app_slug, format)
    if result is None:
        raise HTTPException(status_code=404, detail="No credentials found")
    return result


@router.post("/{app_slug}/import")
async def import_credentials(
    app_slug: str,
    body: BridgeImportRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import credentials from an external format (JSON, .env, YAML)."""
    try:
        mapped = await bridge_service.import_bridge(
            db, user.user_id, app_slug, body.format, body.data
        )
        return {"mapped_variables": mapped, "count": len(mapped)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
