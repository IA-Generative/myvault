"""AES-256-GCM encryption with per-user key derivation via HKDF-SHA256."""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from app.core.config import settings

NONCE_SIZE = 12  # 96 bits for AES-GCM
KEY_SIZE = 32    # 256 bits


def _get_master_key() -> bytes:
    return bytes.fromhex(settings.myvault_master_key)


def derive_user_key(user_id: str) -> bytes:
    """Derive a unique encryption key for a user from the master key using HKDF."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=None,
        info=f"myvault-user-{user_id}".encode(),
    )
    return hkdf.derive(_get_master_key())


def encrypt_value(plaintext: str, user_id: str) -> str:
    """Encrypt a plaintext value. Returns base64-encoded nonce+ciphertext."""
    key = derive_user_key(user_id)
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_value(encrypted: str, user_id: str) -> str:
    """Decrypt a base64-encoded nonce+ciphertext value."""
    key = derive_user_key(user_id)
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
