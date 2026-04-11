"""Routes for authenticated users to manage their own vault entries."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.models.schemas import EntryResponse, EntrySave
from app.services import vault_service

router = APIRouter(prefix="/api/v1/me", tags=["User Vault"])


@router.get("/profile")
async def get_my_profile(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Return the authenticated user's identity."""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "is_admin": user.is_admin,
    }


@router.get("/apps")
async def list_my_apps(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all available applications with my configuration status."""
    return await vault_service.get_user_apps(db, user.user_id)


@router.get("/apps/{app_slug}/entries")
async def get_my_entry(
    app_slug: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get my credentials for a specific application."""
    entry = await vault_service.get_user_entry(db, user.user_id, app_slug)
    if entry is None:
        return {"values": {}, "configured": False}
    return entry


@router.put("/apps/{app_slug}/entries")
async def save_my_entry(
    app_slug: str,
    body: EntrySave,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or update my credentials for an application."""
    try:
        return await vault_service.save_user_entry(
            db, user.user_id, app_slug, body.values, body.enabled
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/apps/{app_slug}/toggle")
async def toggle_my_entry(
    app_slug: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the enabled/disabled state of my entry for an application."""
    try:
        enabled = await vault_service.toggle_entry(db, user.user_id, app_slug)
        return {"enabled": enabled}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/apps/{app_slug}/check")
async def check_my_connection(
    app_slug: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test the connection using my stored credentials."""
    import httpx

    entry = await vault_service.get_user_entry(db, user.user_id, app_slug)
    if entry is None:
        raise HTTPException(status_code=404, detail="No credentials configured")

    from app.services.app_service import get_app_by_slug

    app = await get_app_by_slug(db, app_slug)
    if app is None or not app.check_connection_endpoint:
        raise HTTPException(status_code=400, detail="No check endpoint configured")

    # Call the check endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{app.check_connection_endpoint}",
                json=entry["values"],
            )
            result = resp.json()
    except Exception as e:
        result = {"status": "error", "detail": str(e)}

    status = result.get("status", "error")
    await vault_service.update_check_status(db, user.user_id, app.id, status)

    return result


@router.get("/entries")
async def list_all_my_entries(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all my vault entries across all applications."""
    return await vault_service.get_all_user_entries(db, user.user_id)
