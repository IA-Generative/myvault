"""Tests for MyVaultClient.get_credentials_by_email (by-email M2M lookup)."""

import httpx
import pytest

from myvault_client.client import MyVaultClient
from myvault_client.exceptions import AuthenticationError, CredentialsMissing


def _client_with_transport(handler):
    """Build a MyVaultClient whose httpx calls go through a MockTransport."""
    transport = httpx.MockTransport(handler)
    client = MyVaultClient(
        base_url="http://vault.test",
        client_id="myvault-resana",
        client_secret="secret",
    )
    # The client builds its own AsyncClient per call; patch the factory so each
    # one is wired to our in-memory transport.
    import myvault_client.client as mod

    orig = mod.httpx.AsyncClient

    def _factory(*args, **kwargs):
        kwargs.pop("timeout", None)
        return orig(transport=transport, **kwargs)

    mod.httpx.AsyncClient = _factory  # type: ignore[assignment]
    client._restore = lambda: setattr(mod.httpx, "AsyncClient", orig)
    return client


@pytest.mark.asyncio
async def test_by_email_success_builds_slug_and_url():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["client_id"] = request.headers.get("X-Client-Id")
        return httpx.Response(
            200, json={"resana_email": "a@b.fr", "resana_totp": "123456"}
        )

    client = _client_with_transport(handler)
    try:
        creds = await client.get_credentials_by_email("myvault-resana", "User@B.fr")
    finally:
        client._restore()

    assert creds["resana_email"] == "a@b.fr"
    assert creds["resana_totp"] == "123456"
    # "myvault-" prefix stripped -> slug "resana"; e-mail kept in the path.
    assert captured["url"] == "http://vault.test/api/v1/vault/resana/by-email/User@B.fr"
    assert captured["client_id"] == "myvault-resana"


@pytest.mark.asyncio
async def test_by_email_404_raises_credentials_missing_with_action_url():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            404,
            json={
                "detail": {
                    "error": "credentials_not_found",
                    "action_url": "/app/resana",
                }
            },
        )

    client = _client_with_transport(handler)
    try:
        with pytest.raises(CredentialsMissing) as exc:
            await client.get_credentials_by_email("resana", "nobody@b.fr")
    finally:
        client._restore()
    assert exc.value.action_url == "http://vault.test/app/resana"


@pytest.mark.asyncio
async def test_by_email_401_raises_authentication_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Invalid client credentials"})

    client = _client_with_transport(handler)
    try:
        with pytest.raises(AuthenticationError):
            await client.get_credentials_by_email("resana", "x@b.fr")
    finally:
        client._restore()
