"""Routes for authenticated users to manage their own vault entries."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.core.master_password import require_vault_key
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
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Get my credentials for a specific application."""
    entry = await vault_service.get_user_entry(db, user.user_id, app_slug, mp_key)
    if entry is None:
        return {"values": {}, "configured": False}
    return entry


@router.put("/apps/{app_slug}/entries")
async def save_my_entry(
    app_slug: str,
    body: EntrySave,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Save or update my credentials for an application."""
    try:
        return await vault_service.save_user_entry(
            db, user.user_id, app_slug, body.values, body.enabled, mp_key
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
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Test the API connection using stored credentials.

    The backend performs the test (not the browser) because it can reach
    internal services on the Docker/K8s network.
    """
    import httpx

    entry = await vault_service.get_user_entry(db, user.user_id, app_slug, mp_key)
    if entry is None:
        raise HTTPException(status_code=404, detail="Aucun identifiant configuré")

    from app.services.app_service import get_app_by_slug

    app = await get_app_by_slug(db, app_slug)
    if app is None:
        raise HTTPException(status_code=404, detail="Application non trouvée")

    values = entry["values"]

    # If app has a custom check endpoint, use it
    if app.check_connection_endpoint:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(app.check_connection_endpoint, json=values)
                result = resp.json()
        except Exception as e:
            result = {"status": "error", "detail": str(e)}
    else:
        # Generic check: try to reach the API URL
        result = await _generic_api_check(app, values)

    check_status = result.get("status", "error")
    await vault_service.update_check_status(db, user.user_id, app.id, check_status)
    return result


async def _generic_api_check(app, values: dict) -> dict:
    """Try to reach the API endpoint with available credentials."""
    import httpx
    from app.models.database_models import RequiredVariable

    # Find the API URL variable
    api_url = None
    token = None
    for v in app.required_variables:
        if v.category == "api" and v.var_type == "url" and values.get(v.key):
            api_url = values[v.key]
        if v.category == "api" and v.var_type in ("api_key", "oauth_token") and values.get(v.key):
            token = values[v.key]

    if not api_url:
        return {"status": "error", "detail": "Aucune URL API configurée"}

    try:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(api_url, headers=headers, follow_redirects=True)

        if resp.status_code < 400:
            return {"status": "ok", "detail": f"API joignable ({resp.status_code})"}
        elif resp.status_code == 401:
            return {"status": "error", "detail": "Authentification refusée (401) — vérifiez votre token"}
        elif resp.status_code == 403:
            return {"status": "error", "detail": "Accès interdit (403) — vérifiez les permissions du token"}
        else:
            return {"status": "error", "detail": f"Réponse API : {resp.status_code}"}
    except httpx.ConnectError:
        return {"status": "error", "detail": f"Impossible de joindre {api_url}"}
    except httpx.TimeoutException:
        return {"status": "error", "detail": f"Timeout en contactant {api_url}"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/entries")
async def list_all_my_entries(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Get all my vault entries across all applications."""
    return await vault_service.get_all_user_entries(db, user.user_id, mp_key)
