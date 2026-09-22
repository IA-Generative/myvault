"""Routes for machine-to-machine access (tools reading user secrets via client_credentials)."""

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import validate_client_credentials
from app.core.database import get_db
from app.core.master_password import get_session_key, get_user_security
from app.core.ratelimit import limiter
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


async def _authorize_app_for_client(db, app_slug, client):
    """Return the app if the authenticated client owns it, else raise 403."""
    app = await app_service.get_app_by_slug(db, app_slug)
    if app is None or app.client_id != client.client_id:
        raise HTTPException(
            status_code=403,
            detail="Client not authorized for this application",
        )
    return app


async def _read_credentials_for_user(db, app_slug, user_id):
    """Shared M2M read: enforce the master-password gate then decrypt.

    Raises 423 if the vault is locked and 404 if the user has no credentials.
    """
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


@router.get("/vault/{app_slug}/user/{user_id}")
@limiter.limit("60/minute")
async def read_user_credentials(
    request: Request,
    app_slug: str,
    user_id: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Read a user's decrypted credentials for a tool (machine-to-machine)."""
    client = await _authenticate_client(x_client_id, x_client_secret, db)
    await _authorize_app_for_client(db, app_slug, client)
    return await _read_credentials_for_user(db, app_slug, user_id)


@router.get("/vault/{app_slug}/by-email/{email}")
@limiter.limit("60/minute")
async def read_user_credentials_by_email(
    request: Request,
    app_slug: str,
    email: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Read credentials by the user's e-mail rather than their OIDC subject.

    Lets tools that only receive the OpenWebUI e-mail (e.g. the Resana
    connector) fetch credentials without a Keycloak admin lookup. The e-mail is
    resolved to the user_id recorded when the user saved their vault entry; if
    no entry carries that e-mail the response is 404 with the config action URL.
    """
    client = await _authenticate_client(x_client_id, x_client_secret, db)
    await _authorize_app_for_client(db, app_slug, client)

    user_id = await vault_service.resolve_user_id_by_email(db, email)
    if user_id is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "credentials_not_found",
                "message": "No vault entry found for this e-mail",
                "action_url": f"/app/{app_slug}",
            },
        )
    return await _read_credentials_for_user(db, app_slug, user_id)


@router.post("/apps/enroll")
@limiter.limit("10/minute")
async def enroll_application(
    request: Request,
    body: EnrollRequest,
    x_enroll_secret: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Enroll an application. Requires a shared enrollment secret.

    Enrollment is disabled (503) unless MYVAULT_ENROLL_SECRET is configured;
    when set, callers must present it via the X-Enroll-Secret header. This
    closes anonymous self-enrollment (finding #1).
    """
    import secrets as _secrets

    from app.core.config import settings

    if not settings.myvault_enroll_secret:
        raise HTTPException(
            status_code=503,
            detail="Enrollment is disabled (no enrollment secret configured)",
        )
    if not _secrets.compare_digest(x_enroll_secret, settings.myvault_enroll_secret):
        raise HTTPException(status_code=401, detail="Invalid enrollment secret")

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
@limiter.limit("60/minute")
async def check_user_credentials(
    request: Request,
    app_slug: str,
    user_id: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Check if a user has valid credentials for an app."""
    client = await _authenticate_client(x_client_id, x_client_secret, db)
    await _authorize_app_for_client(db, app_slug, client)

    creds = await vault_service.get_credentials_for_tool(db, app_slug, user_id)
    if creds is None:
        return {"configured": False, "enabled": False}
    return {"configured": True, "enabled": True}


@router.get("/apps/{app_slug}/check-email/{email}")
@limiter.limit("60/minute")
async def check_user_credentials_by_email(
    request: Request,
    app_slug: str,
    email: str,
    x_client_id: str = Header(...),
    x_client_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Check whether a user (identified by e-mail) has valid credentials."""
    client = await _authenticate_client(x_client_id, x_client_secret, db)
    await _authorize_app_for_client(db, app_slug, client)

    user_id = await vault_service.resolve_user_id_by_email(db, email)
    if user_id is None:
        return {"configured": False, "enabled": False}
    creds = await vault_service.get_credentials_for_tool(db, app_slug, user_id)
    if creds is None:
        return {"configured": False, "enabled": False}
    return {"configured": True, "enabled": True}
