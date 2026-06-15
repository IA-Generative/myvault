"""Tests for M2M client_secret validation (hashing + legacy compatibility)."""

from types import SimpleNamespace

import pytest
from passlib.hash import bcrypt

from app.core import auth


class _Result:
    def __init__(self, obj):
        self._obj = obj

    def scalar_one_or_none(self):
        return self._obj


class _Session:
    """Minimal stand-in for an AsyncSession that returns a fixed object."""

    def __init__(self, obj):
        self._obj = obj

    async def execute(self, *args, **kwargs):
        return _Result(self._obj)


def _app(secret_stored: str):
    return SimpleNamespace(client_id="myvault-tool", client_secret=secret_stored, status="active")


@pytest.mark.asyncio
async def test_hashed_secret_correct():
    app = _app(bcrypt.hash("s3cret"))
    client = await auth.validate_client_credentials("myvault-tool", "s3cret", _Session(app))
    assert client is not None and client.client_id == "myvault-tool"


@pytest.mark.asyncio
async def test_hashed_secret_wrong():
    app = _app(bcrypt.hash("s3cret"))
    client = await auth.validate_client_credentials("myvault-tool", "wrong", _Session(app))
    assert client is None


@pytest.mark.asyncio
async def test_legacy_plaintext_accepted_and_upgraded():
    app = _app("legacy-plain")  # stored in clear (legacy)
    client = await auth.validate_client_credentials("myvault-tool", "legacy-plain", _Session(app))
    assert client is not None
    # Opportunistic upgrade: now stored as a bcrypt hash.
    assert app.client_secret.startswith("$2")
    assert bcrypt.verify("legacy-plain", app.client_secret)


@pytest.mark.asyncio
async def test_legacy_plaintext_wrong():
    app = _app("legacy-plain")
    client = await auth.validate_client_credentials("myvault-tool", "nope", _Session(app))
    assert client is None
    assert app.client_secret == "legacy-plain"  # unchanged


@pytest.mark.asyncio
async def test_unknown_client():
    client = await auth.validate_client_credentials("ghost", "x", _Session(None))
    assert client is None
