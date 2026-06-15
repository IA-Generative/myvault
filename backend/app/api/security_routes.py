"""Routes for managing the user's master password (enable/disable/change/unlock)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_secret_access
from app.core.ratelimit import limiter
from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.core.encryption import (
    decrypt_value,
    derive_mp_key,
    encrypt_value,
    new_salt_hex,
)
from app.core.master_password import (
    UNLOCK_TTL,
    get_user_security,
    hash_password,
    is_unlocked,
    lock_session,
    unlock_session,
    verify_password,
)
from app.models.database_models import (
    ENCRYPTED_TYPES,
    Application,
    PersonalEntry,
    UserSecurity,
    UserVaultEntry,
)
from app.models.schemas import (
    MasterPasswordChange,
    MasterPasswordDisable,
    MasterPasswordEnable,
    MasterPasswordUnlock,
    SecurityStatus,
)

router = APIRouter(prefix="/api/v1/me/security", tags=["Security"])


@router.get("", response_model=SecurityStatus)
async def get_status(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sec = await get_user_security(db, user.user_id)
    enabled = bool(sec and sec.master_password_enabled)
    return SecurityStatus(
        master_password_enabled=enabled,
        unlocked=is_unlocked(user.user_id) if enabled else True,
        unlock_ttl_seconds=int(UNLOCK_TTL.total_seconds()),
    )


@router.post("/enable", response_model=SecurityStatus)
async def enable_master_password(
    body: MasterPasswordEnable,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable master password protection.

    Re-encrypts every existing entry with a key derived from the new password,
    so previous ciphertexts (readable with only the server's master key)
    become unreadable without the password.
    """
    sec = await get_user_security(db, user.user_id)
    if sec and sec.master_password_enabled:
        raise HTTPException(status_code=400, detail="Master password already enabled")

    salt = new_salt_hex()
    new_key = derive_mp_key(body.password, salt)

    await _re_encrypt_all(db, user.user_id, old_key=None, new_key=new_key)

    if sec is None:
        sec = UserSecurity(user_id=user.user_id)
        db.add(sec)
    sec.master_password_enabled = True
    sec.master_password_hash = hash_password(body.password)
    sec.master_password_salt = salt
    await db.flush()

    unlock_session(user.user_id, new_key)
    log_secret_access(user.user_id, "master_password", "ENABLE")
    return SecurityStatus(
        master_password_enabled=True,
        unlocked=True,
        unlock_ttl_seconds=int(UNLOCK_TTL.total_seconds()),
    )


@router.post("/disable", response_model=SecurityStatus)
async def disable_master_password(
    body: MasterPasswordDisable,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable master password protection.

    Re-encrypts entries back to the base (password-less) key. Requires the
    current password so existing ciphertexts can still be decrypted.
    """
    sec = await get_user_security(db, user.user_id)
    if sec is None or not sec.master_password_enabled:
        raise HTTPException(status_code=400, detail="Master password is not enabled")

    if not verify_password(body.password, sec.master_password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    old_key = derive_mp_key(body.password, sec.master_password_salt)

    await _re_encrypt_all(db, user.user_id, old_key=old_key, new_key=None)

    sec.master_password_enabled = False
    sec.master_password_hash = ""
    sec.master_password_salt = ""
    await db.flush()

    lock_session(user.user_id)
    log_secret_access(user.user_id, "master_password", "DISABLE")
    return SecurityStatus(
        master_password_enabled=False,
        unlocked=True,
        unlock_ttl_seconds=int(UNLOCK_TTL.total_seconds()),
    )


@router.post("/change", response_model=SecurityStatus)
async def change_master_password(
    body: MasterPasswordChange,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the master password: re-encrypt everything with the new key."""
    sec = await get_user_security(db, user.user_id)
    if sec is None or not sec.master_password_enabled:
        raise HTTPException(status_code=400, detail="Master password is not enabled")

    if not verify_password(body.old_password, sec.master_password_hash):
        raise HTTPException(status_code=401, detail="Ancien mot de passe incorrect")

    old_key = derive_mp_key(body.old_password, sec.master_password_salt)
    new_salt = new_salt_hex()
    new_key = derive_mp_key(body.new_password, new_salt)

    await _re_encrypt_all(db, user.user_id, old_key=old_key, new_key=new_key)

    sec.master_password_hash = hash_password(body.new_password)
    sec.master_password_salt = new_salt
    await db.flush()

    unlock_session(user.user_id, new_key)
    log_secret_access(user.user_id, "master_password", "CHANGE")
    return SecurityStatus(
        master_password_enabled=True,
        unlocked=True,
        unlock_ttl_seconds=int(UNLOCK_TTL.total_seconds()),
    )


@router.post("/unlock", response_model=SecurityStatus)
@limiter.limit("10/minute")
async def unlock(
    request: Request,
    body: MasterPasswordUnlock,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sec = await get_user_security(db, user.user_id)
    if sec is None or not sec.master_password_enabled:
        raise HTTPException(status_code=400, detail="Master password is not enabled")

    if not verify_password(body.password, sec.master_password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    mp_key = derive_mp_key(body.password, sec.master_password_salt)
    unlock_session(user.user_id, mp_key)
    log_secret_access(user.user_id, "master_password", "UNLOCK")
    return SecurityStatus(
        master_password_enabled=True,
        unlocked=True,
        unlock_ttl_seconds=int(UNLOCK_TTL.total_seconds()),
    )


@router.post("/lock")
async def lock(
    user: AuthenticatedUser = Depends(get_current_user),
):
    lock_session(user.user_id)
    log_secret_access(user.user_id, "master_password", "LOCK")
    return {"status": "locked"}


# --- Internal helpers ---


async def _re_encrypt_all(
    db: AsyncSession,
    user_id: str,
    old_key: bytes | None,
    new_key: bytes | None,
) -> None:
    """Walk every encrypted value owned by the user and re-encrypt it.

    Used when enabling (old_key=None, new_key=mp), disabling (old_key=mp,
    new_key=None) or changing (old_key=old_mp, new_key=new_mp) the master
    password.
    """
    # App-linked entries
    vault_result = await db.execute(
        select(UserVaultEntry).where(UserVaultEntry.user_id == user_id)
    )
    vault_entries = vault_result.scalars().all()

    app_ids = {e.app_id for e in vault_entries}
    encrypted_keys_by_app: dict = {}
    if app_ids:
        from sqlalchemy.orm import selectinload
        apps_result = await db.execute(
            select(Application)
            .where(Application.id.in_(app_ids))
            .options(selectinload(Application.required_variables))
        )
        for app in apps_result.scalars().all():
            encrypted_keys_by_app[app.id] = {
                v.key for v in app.required_variables if v.var_type in ENCRYPTED_TYPES
            }

    for entry in vault_entries:
        keys = encrypted_keys_by_app.get(entry.app_id, set())
        new_values = {}
        for k, v in entry.values.items():
            if k in keys and v:
                plain = decrypt_value(v, user_id, old_key)
                new_values[k] = encrypt_value(plain, user_id, new_key)
            else:
                new_values[k] = v
        entry.values = new_values

    # Personal entries
    personal_result = await db.execute(
        select(PersonalEntry).where(PersonalEntry.user_id == user_id)
    )
    for p in personal_result.scalars().all():
        if p.username:
            plain = decrypt_value(p.username, user_id, old_key)
            p.username = encrypt_value(plain, user_id, new_key)
        if p.encrypted_password:
            plain = decrypt_value(p.encrypted_password, user_id, old_key)
            p.encrypted_password = encrypt_value(plain, user_id, new_key)

    await db.flush()
