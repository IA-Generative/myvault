"""Unit tests for AES-256-GCM encryption with per-user key derivation."""

import os
import pytest

# Set test master key before importing encryption module
os.environ["MYVAULT_MASTER_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

from app.core.encryption import encrypt_value, decrypt_value, derive_user_key


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "sk-test-api-key-12345"
        user_id = "user-001"

        encrypted = encrypt_value(plaintext, user_id)
        decrypted = decrypt_value(encrypted, user_id)

        assert decrypted == plaintext
        assert encrypted != plaintext

    def test_different_users_different_ciphertext(self):
        plaintext = "shared-secret"
        enc_a = encrypt_value(plaintext, "user-A")
        enc_b = encrypt_value(plaintext, "user-B")

        assert enc_a != enc_b

    def test_same_user_different_nonces(self):
        plaintext = "my-secret"
        user_id = "user-001"

        enc1 = encrypt_value(plaintext, user_id)
        enc2 = encrypt_value(plaintext, user_id)

        # Different nonces produce different ciphertexts
        assert enc1 != enc2
        # But both decrypt to the same value
        assert decrypt_value(enc1, user_id) == plaintext
        assert decrypt_value(enc2, user_id) == plaintext

    def test_wrong_user_cannot_decrypt(self):
        plaintext = "secret-for-alice"
        encrypted = encrypt_value(plaintext, "alice")

        with pytest.raises(Exception):
            decrypt_value(encrypted, "bob")

    def test_derive_user_key_deterministic(self):
        key1 = derive_user_key("user-001")
        key2 = derive_user_key("user-001")
        assert key1 == key2

    def test_derive_user_key_unique_per_user(self):
        key_a = derive_user_key("user-A")
        key_b = derive_user_key("user-B")
        assert key_a != key_b

    def test_unicode_content(self):
        plaintext = "clé-secrète-très-confidentielle-🔐"
        user_id = "user-fr"

        encrypted = encrypt_value(plaintext, user_id)
        decrypted = decrypt_value(encrypted, user_id)

        assert decrypted == plaintext

    def test_empty_string(self):
        encrypted = encrypt_value("", "user-001")
        decrypted = decrypt_value(encrypted, "user-001")
        assert decrypted == ""

    def test_long_value(self):
        plaintext = "x" * 10000
        encrypted = encrypt_value(plaintext, "user-001")
        decrypted = decrypt_value(encrypted, "user-001")
        assert decrypted == plaintext
