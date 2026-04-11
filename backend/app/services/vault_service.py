"""Business logic for vault operations: encrypt, decrypt, store, retrieve secrets."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_secret_access
from app.core.encryption import decrypt_value, encrypt_value
from app.models.database_models import (
    ENCRYPTED_TYPES,
    Application,
    RequiredVariable,
    UserVaultEntry,
)


async def get_user_apps(
    db: AsyncSession, user_id: str
) -> list[dict]:
    """List all active applications with the user's configuration status."""
    result = await db.execute(
        select(Application)
        .where(Application.status == "active")
        .options(selectinload(Application.required_variables))
        .order_by(Application.name)
    )
    apps = result.scalars().all()

    entries_result = await db.execute(
        select(UserVaultEntry).where(UserVaultEntry.user_id == user_id)
    )
    entries = {e.app_id: e for e in entries_result.scalars().all()}

    items = []
    for app in apps:
        entry = entries.get(app.id)
        items.append({
            "id": app.id,
            "name": app.name,
            "description": app.description,
            "icon_url": app.icon_url,
            "friendly_slug": app.friendly_slug,
            "status": app.status,
            "required_variables": [
                {
                    "key": v.key,
                    "label": v.label,
                    "var_type": v.var_type,
                    "required": v.required,
                    "description": v.description,
                    "default_value": v.default_value,
                    "choices": v.choices,
                }
                for v in app.required_variables
            ],
            "user_configured": entry is not None,
            "user_enabled": entry.enabled if entry else False,
            "check_status": entry.check_status if entry else "untested",
        })
    return items


async def get_user_entry(
    db: AsyncSession, user_id: str, app_slug: str
) -> dict | None:
    """Get a user's vault entry for a specific app, decrypting secret fields."""
    app = await _get_app_by_slug(db, app_slug)
    if app is None:
        return None

    result = await db.execute(
        select(UserVaultEntry).where(
            UserVaultEntry.user_id == user_id,
            UserVaultEntry.app_id == app.id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None

    encrypted_keys = _get_encrypted_keys(app)
    decrypted_values = {}
    for key, value in entry.values.items():
        if key in encrypted_keys and value:
            decrypted_values[key] = decrypt_value(value, user_id)
        else:
            decrypted_values[key] = value

    log_secret_access(user_id, app_slug, "READ")

    return {
        "entry_id": entry.id,
        "app_id": app.id,
        "app_name": app.name,
        "app_slug": app.friendly_slug,
        "enabled": entry.enabled,
        "values": decrypted_values,
        "last_check": entry.last_check,
        "check_status": entry.check_status,
        "updated_at": entry.updated_at,
    }


async def save_user_entry(
    db: AsyncSession, user_id: str, app_slug: str, values: dict[str, str], enabled: bool
) -> dict:
    """Save or update a user's vault entry, encrypting secret fields."""
    app = await _get_app_by_slug(db, app_slug)
    if app is None:
        raise ValueError(f"Application '{app_slug}' not found")

    encrypted_keys = _get_encrypted_keys(app)
    stored_values = {}
    for key, value in values.items():
        if key in encrypted_keys and value:
            stored_values[key] = encrypt_value(value, user_id)
        else:
            stored_values[key] = value

    result = await db.execute(
        select(UserVaultEntry).where(
            UserVaultEntry.user_id == user_id,
            UserVaultEntry.app_id == app.id,
        )
    )
    entry = result.scalar_one_or_none()

    if entry is None:
        entry = UserVaultEntry(
            user_id=user_id,
            app_id=app.id,
            enabled=enabled,
            values=stored_values,
        )
        db.add(entry)
    else:
        entry.values = stored_values
        entry.enabled = enabled
        entry.updated_at = datetime.now(timezone.utc)

    await db.flush()

    log_secret_access(user_id, app_slug, "WRITE")

    return {
        "entry_id": entry.id,
        "app_id": app.id,
        "app_name": app.name,
        "app_slug": app.friendly_slug,
        "enabled": entry.enabled,
        "values": values,  # Return unencrypted for immediate use
        "last_check": entry.last_check,
        "check_status": entry.check_status,
        "updated_at": entry.updated_at,
    }


async def toggle_entry(
    db: AsyncSession, user_id: str, app_slug: str
) -> bool:
    """Toggle the enabled state of a user's vault entry. Returns new state."""
    app = await _get_app_by_slug(db, app_slug)
    if app is None:
        raise ValueError(f"Application '{app_slug}' not found")

    result = await db.execute(
        select(UserVaultEntry).where(
            UserVaultEntry.user_id == user_id,
            UserVaultEntry.app_id == app.id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise ValueError("No entry found for this application")

    entry.enabled = not entry.enabled
    entry.updated_at = datetime.now(timezone.utc)
    await db.flush()

    log_secret_access(user_id, app_slug, "TOGGLE", detail=f"enabled={entry.enabled}")
    return entry.enabled


async def get_all_user_entries(
    db: AsyncSession, user_id: str
) -> list[dict]:
    """Get all vault entries for a user across all apps."""
    result = await db.execute(
        select(UserVaultEntry)
        .where(UserVaultEntry.user_id == user_id)
        .options(selectinload(UserVaultEntry.application))
    )
    entries = result.scalars().all()

    items = []
    for entry in entries:
        app = entry.application
        encrypted_keys = _get_encrypted_keys(app)
        decrypted = {}
        for key, value in entry.values.items():
            if key in encrypted_keys and value:
                decrypted[key] = decrypt_value(value, user_id)
            else:
                decrypted[key] = value

        items.append({
            "entry_id": entry.id,
            "app_id": app.id,
            "app_name": app.name,
            "app_slug": app.friendly_slug,
            "enabled": entry.enabled,
            "values": decrypted,
            "last_check": entry.last_check,
            "check_status": entry.check_status,
            "updated_at": entry.updated_at,
        })

    return items


async def get_credentials_for_tool(
    db: AsyncSession, app_slug: str, user_id: str
) -> dict | None:
    """Machine-to-machine: retrieve a user's credentials for a tool."""
    app = await _get_app_by_slug(db, app_slug)
    if app is None:
        return None

    result = await db.execute(
        select(UserVaultEntry).where(
            UserVaultEntry.user_id == user_id,
            UserVaultEntry.app_id == app.id,
            UserVaultEntry.enabled == True,  # noqa: E712
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None

    encrypted_keys = _get_encrypted_keys(app)
    decrypted = {}
    for key, value in entry.values.items():
        if key in encrypted_keys and value:
            decrypted[key] = decrypt_value(value, user_id)
        else:
            decrypted[key] = value

    log_secret_access(user_id, app_slug, "TOOL_READ", accessed_by=f"tool:{app.client_id}")
    return decrypted


async def update_check_status(
    db: AsyncSession, user_id: str, app_id: uuid.UUID, status: str, detail: str = ""
) -> None:
    """Update the check_connection status for a user's entry."""
    result = await db.execute(
        select(UserVaultEntry).where(
            UserVaultEntry.user_id == user_id,
            UserVaultEntry.app_id == app_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.check_status = status
        entry.last_check = datetime.now(timezone.utc)
        await db.flush()


# --- Helpers ---


async def _get_app_by_slug(db: AsyncSession, slug: str) -> Application | None:
    result = await db.execute(
        select(Application)
        .where(Application.friendly_slug == slug)
        .options(selectinload(Application.required_variables))
    )
    return result.scalar_one_or_none()


def _get_encrypted_keys(app: Application) -> set[str]:
    return {
        v.key for v in app.required_variables if v.var_type in ENCRYPTED_TYPES
    }
