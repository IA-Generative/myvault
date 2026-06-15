"""Tests for OIDC token audience validation.

Keycloak access tokens default to aud="account" and carry the requesting
client in the "azp" claim (unless an Audience protocol mapper is configured).
The backend must bind the token to its own client via either aud or azp, while
still rejecting tokens issued for other realm clients.
"""

import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwt as jose_jwt
from jose.utils import base64url_encode

from app.core import auth
from app.core.config import settings

ISSUER = "https://mysso.test/realms/openwebui"
KID = "test-kid"


def _b64u_uint(n: int) -> str:
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64url_encode(raw).decode()


@pytest.fixture
def signing_key(monkeypatch):
    """Generate an RSA key, expose its public JWK to auth, return the signer."""
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub = priv.public_key().public_numbers()
    jwk = {
        "kty": "RSA", "kid": KID, "use": "sig", "alg": "RS256",
        "n": _b64u_uint(pub.n), "e": _b64u_uint(pub.e),
    }
    monkeypatch.setattr(auth, "_oidc_jwks", {"keys": [jwk]})
    monkeypatch.setattr(settings, "oidc_client_id", "myvault")
    monkeypatch.setattr(settings, "oidc_issuer_url", ISSUER)
    monkeypatch.setattr(settings, "myvault_dev_mode", False)

    pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()

    def sign(claims: dict) -> str:
        return jose_jwt.encode(claims, pem, algorithm="RS256", headers={"kid": KID})

    return sign


def _claims(**overrides) -> dict:
    base = {
        "sub": "user-1",
        "iss": ISSUER,
        "aud": "account",
        "azp": "myvault",
        "exp": int(time.time()) + 3600,
        "email": "u@example.com",
        "name": "User One",
    }
    base.update(overrides)
    return base


def test_keycloak_default_token_is_accepted_via_azp(signing_key):
    """aud='account' + azp='myvault' (default Keycloak shape) must pass."""
    token = signing_key(_claims())
    payload = auth._decode_token(token)
    assert payload["sub"] == "user-1"


def test_token_with_client_in_audience_is_accepted(signing_key):
    """aud containing the client (audience mapper configured) must pass."""
    token = signing_key(_claims(aud=["myvault", "account"], azp=None))
    payload = auth._decode_token(token)
    assert payload["sub"] == "user-1"


def test_token_for_another_client_is_rejected(signing_key):
    """A token authorized for a different realm client must be rejected."""
    token = signing_key(_claims(azp="some-other-client"))
    with pytest.raises(HTTPException) as exc:
        auth._decode_token(token)
    assert exc.value.status_code == 401


def test_expired_token_is_rejected(signing_key):
    token = signing_key(_claims(exp=int(time.time()) - 10))
    with pytest.raises(HTTPException) as exc:
        auth._decode_token(token)
    assert exc.value.status_code == 401


def test_wrong_issuer_is_rejected(signing_key):
    token = signing_key(_claims(iss="https://evil.example/realms/openwebui"))
    with pytest.raises(HTTPException) as exc:
        auth._decode_token(token)
    assert exc.value.status_code == 401
