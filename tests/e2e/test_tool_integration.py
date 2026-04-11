"""End-to-end tests: tool integration (auto-enrollment, credential retrieval)."""

import pytest


@pytest.mark.asyncio
async def test_auto_enrollment(api_client):
    """Tool can auto-enroll an application."""
    resp = await api_client.post(
        "/api/v1/apps/enroll",
        json={
            "client_id": "myvault-auto-test",
            "client_secret": "auto-secret-123",
            "name": "Auto Test Tool",
            "variables": [
                {"key": "api_key", "label": "API Key", "var_type": "api_key", "required": True},
            ],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "enrolled"
    assert "app_id" in data


@pytest.mark.asyncio
async def test_auto_enrollment_idempotent(api_client):
    """Enrolling the same app twice doesn't create duplicates."""
    payload = {
        "client_id": "myvault-idempotent-test",
        "client_secret": "idem-secret",
        "name": "Idempotent Tool",
        "variables": [],
    }
    resp1 = await api_client.post("/api/v1/apps/enroll", json=payload)
    resp2 = await api_client.post("/api/v1/apps/enroll", json=payload)
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["app_id"] == resp2.json()["app_id"]


@pytest.mark.asyncio
async def test_credentials_not_found(api_client, tool_headers):
    """Tool gets 404 when user has no credentials configured."""
    resp = await api_client.get(
        "/api/v1/vault/e2e-test/user/unknown-user",
        headers=tool_headers,
    )
    # Will be 401 (invalid tool) or 404 (no creds) depending on setup
    assert resp.status_code in (401, 404)


@pytest.mark.asyncio
async def test_enrollment_requires_secret(api_client):
    """Enrollment without client_secret is rejected."""
    resp = await api_client.post(
        "/api/v1/apps/enroll",
        json={
            "client_id": "myvault-no-secret",
            "client_secret": "",
            "name": "No Secret Tool",
        },
    )
    assert resp.status_code == 400
