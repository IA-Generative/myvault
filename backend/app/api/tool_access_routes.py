"""Routes for machine-to-machine access (tools reading user secrets via client_credentials)."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import validate_client_credentials
from app.core.database import get_db
from app.core.master_password import get_session_key, get_user_security
from app.models.schemas import EnrollRequest
from app.services import app_service, vault_service

router = APIRouter(prefix="/api/v1", tags=["Tool Access"])


async def _authenticate_client(
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Validate client credentials from headers."""
    client = await validate_client_credentials(x_client_id, x_client_secret, db)
    if client is None:
        raise HTTPException(status_code=401, detail="Invalid client credentials")
    return client


@router.get("/vault/{app_slug}/user/{user_id}")
async def read_user_credentials(
    app_slug: str,
    user_id: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Read a user's decrypted credentials for a tool (machine-to-machine)."""
    client = await _authenticate_client(x_client_id, x_client_secret, db)

    # If the user has enabled a master password, the tool can only read
    # credentials while the user has an active unlock session.
    sec = await get_user_security(db, user_id)
    mp_key: bytes | None = None
    if sec is not None and sec.master_password_enabled:
        mp_key = get_session_key(user_id)
        if mp_key is None:
            raise HTTPException(
                status_code=423,
                detail={
                    "error": "vault_locked",
                    "message": "User vault is locked — user must unlock via web UI",
                },
            )

    creds = await vault_service.get_credentials_for_tool(db, app_slug, user_id, mp_key)
    if creds is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "credentials_not_found",
                "message": "User has not configured credentials for this application",
                "action_url": f"/app/{app_slug}",
            },
        )
    return creds


@router.post("/apps/enroll")
async def enroll_application(
    body: EnrollRequest,
    db: AsyncSession = Depends(get_db),
):
    """Auto-enroll an application (called by tools on first use)."""
    # Validate the client_secret is provided
    if not body.client_secret:
        raise HTTPException(status_code=400, detail="client_secret is required")

    app = await app_service.enroll_app(db, body)
    return {
        "app_id": app.id,
        "client_id": app.client_id,
        "friendly_slug": app.friendly_slug,
        "status": "enrolled",
    }


@router.get("/apps/{app_slug}/check/{user_id}")
async def check_user_credentials(
    app_slug: str,
    user_id: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Check if a user has valid credentials for an app."""
    await _authenticate_client(x_client_id, x_client_secret, db)

    creds = await vault_service.get_credentials_for_tool(db, app_slug, user_id)
    if creds is None:
        return {"configured": False, "enabled": False}
    return {"configured": True, "enabled": True}
