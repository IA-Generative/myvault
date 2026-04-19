"""Master password: verification, unlock session cache, and guard dependency.

The plaintext master password is never stored. The server keeps:
  - bcrypt(password)           — for verifying "is this the right password?"
  - a KDF salt                  — used with PBKDF2 to derive the AES key
  - an in-memory unlock cache   — holds the derived AES key for 15 min after
                                  unlock. Lost on process restart (by design).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import Depends, HTTPException, status
from passlib.hash import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.models.database_models import UserSecurity

UNLOCK_TTL = timedelta(minutes=15)


@dataclass
class _Session:
    mp_key: bytes
    expires_at: datetime


_sessions: dict[str, _Session] = {}
_lock = Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def unlock_session(user_id: str, mp_key: bytes) -> None:
    with _lock:
        _sessions[user_id] = _Session(
            mp_key=mp_key, expires_at=_now() + UNLOCK_TTL
        )


def lock_session(user_id: str) -> None:
    with _lock:
        _sessions.pop(user_id, None)


def get_session_key(user_id: str) -> bytes | None:
    """Return the cached mp_key, extending the TTL. None if locked/expired."""
    with _lock:
        sess = _sessions.get(user_id)
        if sess is None:
            return None
        if sess.expires_at <= _now():
            _sessions.pop(user_id, None)
            return None
        sess.expires_at = _now() + UNLOCK_TTL
        return sess.mp_key


def is_unlocked(user_id: str) -> bool:
    return get_session_key(user_id) is not None


async def get_user_security(
    db: AsyncSession, user_id: str
) -> UserSecurity | None:
    result = await db.execute(
        select(UserSecurity).where(UserSecurity.user_id == user_id)
    )
    return result.scalar_one_or_none()


def verify_password(password: str, hash_str: str) -> bool:
    if not hash_str:
        return False
    try:
        return bcrypt.verify(password, hash_str)
    except ValueError:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


async def require_vault_key(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> bytes | None:
    """Dependency used by credential endpoints.

    - Returns None when the user has not enabled master password (legacy flow).
    - Returns the cached mp_key when the user is unlocked.
    - Raises 423 Locked when master password is enabled but the session is not
      unlocked (or has expired). The frontend detects this and prompts.
    """
    sec = await get_user_security(db, user.user_id)
    if sec is None or not sec.master_password_enabled:
        return None
    mp_key = get_session_key(user.user_id)
    if mp_key is None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "error": "vault_locked",
                "message": "Master password required to unlock vault",
            },
        )
    return mp_key
