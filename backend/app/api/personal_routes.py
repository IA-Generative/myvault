"""Routes for user's personal credential entries (not tied to admin-managed apps)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.audit import log_secret_access
from app.core.database import get_db
from app.core.encryption import encrypt_value, decrypt_value
from app.core.master_password import require_vault_key
from app.models.database_models import PersonalEntry
from app.models.schemas import PersonalEntryCreate, PersonalEntryUpdate, PersonalEntryResponse

router = APIRouter(prefix="/api/v1/me/personal", tags=["Personal Vault"])


@router.get("", response_model=list[PersonalEntryResponse])
async def list_personal_entries(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mp_key: bytes | None = Depends(require_vault_key),
):
    """List all personal entries for the authenticated user."""
    result = await db.execute(
        select(PersonalEntry)
        .where(PersonalEntry.user_id == user.user_id)
        .order_by(PersonalEntry.name)
    )
    entries = result.scalars().all()
    return [_decrypt_entry(e, user.user_id, mp_key) for e in entries]


@router.post("", response_model=PersonalEntryResponse)
async def create_personal_entry(
    body: PersonalEntryCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Create a new personal credential entry."""
    entry = PersonalEntry(
        user_id=user.user_id,
        name=body.name,
        website=body.website,
        username=encrypt_value(body.username, user.user_id, mp_key) if body.username else "",
        encrypted_password=encrypt_value(body.password, user.user_id, mp_key) if body.password else "",
        notes=body.notes,
    )
    db.add(entry)
    await db.flush()
    log_secret_access(user.user_id, f"personal:{entry.id}", "CREATE")
    return _decrypt_entry(entry, user.user_id, mp_key)


@router.put("/{entry_id}", response_model=PersonalEntryResponse)
async def update_personal_entry(
    entry_id: uuid.UUID,
    body: PersonalEntryUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    mp_key: bytes | None = Depends(require_vault_key),
):
    """Update an existing personal credential entry."""
    entry = await _get_own_entry(db, entry_id, user.user_id)

    if body.name is not None:
        entry.name = body.name
    if body.website is not None:
        entry.website = body.website
    if body.username is not None:
        entry.username = encrypt_value(body.username, user.user_id, mp_key) if body.username else ""
    if body.password is not None:
        entry.encrypted_password = encrypt_value(body.password, user.user_id, mp_key) if body.password else ""
    if body.notes is not None:
        entry.notes = body.notes

    await db.flush()
    log_secret_access(user.user_id, f"personal:{entry.id}", "UPDATE")
    return _decrypt_entry(entry, user.user_id, mp_key)


@router.delete("/{entry_id}")
async def delete_personal_entry(
    entry_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a personal credential entry."""
    entry = await _get_own_entry(db, entry_id, user.user_id)
    await db.delete(entry)
    await db.flush()
    log_secret_access(user.user_id, f"personal:{entry.id}", "DELETE")
    return {"status": "deleted"}


async def _get_own_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: str
) -> PersonalEntry:
    result = await db.execute(
        select(PersonalEntry).where(
            PersonalEntry.id == entry_id,
            PersonalEntry.user_id == user_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    return entry


def _decrypt_entry(entry: PersonalEntry, user_id: str, mp_key: bytes | None) -> dict:
    return {
        "id": entry.id,
        "name": entry.name,
        "website": entry.website,
        "username": decrypt_value(entry.username, user_id, mp_key) if entry.username else "",
        "password": decrypt_value(entry.encrypted_password, user_id, mp_key) if entry.encrypted_password else "",
        "notes": entry.notes,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }
