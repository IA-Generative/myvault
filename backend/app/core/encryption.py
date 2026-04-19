"""AES-256-GCM encryption with per-user key derivation via HKDF-SHA256.

Optionally, a caller can pass `mp_key` (a password-derived key, typically the
output of `derive_mp_key`) to mix the user's master password into key
derivation. Without that key, ciphertext produced while the master password
was active cannot be decrypted — even by the server holding the master key.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from app.core.config import settings

NONCE_SIZE = 12  # 96 bits for AES-GCM
KEY_SIZE = 32    # 256 bits
PBKDF2_ITERATIONS = 200_000


def _get_master_key() -> bytes:
    return bytes.fromhex(settings.myvault_master_key)


def derive_user_key(user_id: str, mp_key: bytes | None = None) -> bytes:
    """Derive a unique encryption key for a user from the master key.

    When `mp_key` is provided it is mixed in as HKDF salt so the resulting key
    depends on the user's master password — this is the "sel supplémentaire"
    that protects entries when the master password feature is active.
    """
    info = f"myvault-user-{user_id}".encode()
    salt: bytes | None = None
    if mp_key is not None:
        info = f"myvault-user-{user_id}-mp".encode()
        salt = mp_key
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=salt,
        info=info,
    )
    return hkdf.derive(_get_master_key())


def derive_mp_key(password: str, salt_hex: str) -> bytes:
    """PBKDF2-SHA256 of the user's master password. Returns a 32-byte key."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=bytes.fromhex(salt_hex),
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_value(plaintext: str, user_id: str, mp_key: bytes | None = None) -> str:
    """Encrypt a plaintext value. Returns base64-encoded nonce+ciphertext."""
    key = derive_user_key(user_id, mp_key)
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_value(encrypted: str, user_id: str, mp_key: bytes | None = None) -> str:
    """Decrypt a base64-encoded nonce+ciphertext value."""
    key = derive_user_key(user_id, mp_key)
    raw = base64.b64decode(encrypted)
    nonce = raw[:NONCE_SIZE]
    ciphertext = raw[NONCE_SIZE:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")


def re_encrypt_value(encrypted: str, old_user_id: str, new_user_id: str) -> str:
    """Re-encrypt a value with a new user key (for key rotation)."""
    plaintext = decrypt_value(encrypted, old_user_id)
    return encrypt_value(plaintext, new_user_id)


def new_salt_hex() -> str:
    """Generate a fresh 128-bit salt encoded as hex."""
    return os.urandom(16).hex()
