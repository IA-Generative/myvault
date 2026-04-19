"""Unit tests for master-password-derived encryption."""

import os

import pytest

os.environ.setdefault(
    "MYVAULT_MASTER_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)

from app.core.encryption import (
    decrypt_value,
    derive_mp_key,
    derive_user_key,
    encrypt_value,
    new_salt_hex,
)


class TestMasterPasswordEncryption:
    def test_mp_key_is_deterministic(self):
        salt = new_salt_hex()
        k1 = derive_mp_key("hunter2-long-enough", salt)
        k2 = derive_mp_key("hunter2-long-enough", salt)
        assert k1 == k2
        assert len(k1) == 32

    def test_mp_key_changes_with_salt(self):
        salt1 = new_salt_hex()
        salt2 = new_salt_hex()
        assert derive_mp_key("same-password", salt1) != derive_mp_key(
            "same-password", salt2
        )

    def test_user_key_differs_with_and_without_mp(self):
        mp = derive_mp_key("a-strong-master-password", new_salt_hex())
        key_plain = derive_user_key("u-1")
        key_with_mp = derive_user_key("u-1", mp)
        assert key_plain != key_with_mp

    def test_roundtrip_with_mp_key(self):
        mp = derive_mp_key("a-strong-master-password", new_salt_hex())
        ct = encrypt_value("top secret", "u-1", mp)
        assert decrypt_value(ct, "u-1", mp) == "top secret"

    def test_cannot_decrypt_mp_ciphertext_without_mp(self):
        mp = derive_mp_key("pw-correct-horse", new_salt_hex())
        ct = encrypt_value("top secret", "u-1", mp)
        with pytest.raises(Exception):
            decrypt_value(ct, "u-1")

    def test_cannot_decrypt_mp_ciphertext_with_wrong_mp(self):
        salt = new_salt_hex()
        mp = derive_mp_key("correct-password", salt)
        wrong = derive_mp_key("wrong-password", salt)
        ct = encrypt_value("top secret", "u-1", mp)
        with pytest.raises(Exception):
            decrypt_value(ct, "u-1", wrong)
