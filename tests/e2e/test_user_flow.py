"""End-to-end tests: complete user journey through MyVault."""

import pytest


@pytest.mark.asyncio
async def test_full_user_journey(api_client, admin_headers):
    """Test the complete flow: create app, save credentials, check, toggle."""

    # 1. Admin creates an application
    resp = await api_client.post(
        "/api/v1/admin/apps",
        headers=admin_headers,
        json={
            "client_id": "myvault-e2e-test",
            "name": "E2E Test App",
            "friendly_slug": "e2e-test",
            "description": "Application for end-to-end testing",
            "required_variables": [
                {"key": "api_token", "label": "API Token", "var_type": "api_key", "required": True},
                {"key": "server_url", "label": "Server URL", "var_type": "url", "default_value": "https://api.example.com"},
                {"key": "debug_mode", "label": "Debug", "var_type": "boolean", "required": False},
            ],
        },
    )
    assert resp.status_code == 200
    app_data = resp.json()
    assert "id" in app_data

    # 2. User lists available apps
    resp = await api_client.get("/api/v1/me/apps", headers=admin_headers)
    assert resp.status_code == 200
    apps = resp.json()
    e2e_app = next((a for a in apps if a["friendly_slug"] == "e2e-test"), None)
    assert e2e_app is not None
    assert e2e_app["user_configured"] is False

    # 3. User saves credentials
    resp = await api_client.put(
        "/api/v1/me/apps/e2e-test/entries",
        headers=admin_headers,
        json={
            "values": {
                "api_token": "sk-test-secret-key-12345",
                "server_url": "https://api.example.com",
                "debug_mode": "true",
            },
            "enabled": True,
        },
    )
    assert resp.status_code == 200
    entry = resp.json()
    assert entry["enabled"] is True
    assert entry["values"]["api_token"] == "sk-test-secret-key-12345"

    # 4. User reads back credentials (should be decrypted)
    resp = await api_client.get(
        "/api/v1/me/apps/e2e-test/entries",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    entry = resp.json()
    assert entry["values"]["api_token"] == "sk-test-secret-key-12345"

    # 5. User toggles the entry off
    resp = await api_client.patch(
        "/api/v1/me/apps/e2e-test/toggle",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False

    # 6. User lists all entries
    resp = await api_client.get("/api/v1/me/entries", headers=admin_headers)
    assert resp.status_code == 200
    entries = resp.json()
    assert any(e["app_slug"] == "e2e-test" for e in entries)

    # 7. Cleanup: delete the app
    resp = await api_client.delete(
        f"/api/v1/admin/apps/{app_data['id']}",
        headers=admin_headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_auto_provisioning(api_client, admin_headers):
    """First-time user sees empty vault without errors."""
    resp = await api_client.get("/api/v1/me/apps", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_entry_not_found(api_client, admin_headers):
    """Getting entry for unconfigured app returns empty state."""
    resp = await api_client.get(
        "/api/v1/me/apps/nonexistent-app/entries",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("configured") is False or data.get("values") == {}
