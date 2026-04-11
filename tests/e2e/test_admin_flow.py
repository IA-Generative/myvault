"""End-to-end tests: admin application management."""

import json
import pytest


@pytest.mark.asyncio
async def test_app_crud(api_client, admin_headers):
    """Admin can create, update, and delete an application."""

    # Create
    resp = await api_client.post(
        "/api/v1/admin/apps",
        headers=admin_headers,
        json={
            "client_id": "myvault-crud-test",
            "name": "CRUD Test",
            "friendly_slug": "crud-test",
            "required_variables": [
                {"key": "token", "label": "Token", "var_type": "secret"},
            ],
        },
    )
    assert resp.status_code == 200
    app_id = resp.json()["id"]

    # List
    resp = await api_client.get("/api/v1/admin/apps", headers=admin_headers)
    assert resp.status_code == 200
    assert any(a["id"] == app_id for a in resp.json())

    # Update
    resp = await api_client.put(
        f"/api/v1/admin/apps/{app_id}",
        headers=admin_headers,
        json={"name": "CRUD Test Updated", "status": "disabled"},
    )
    assert resp.status_code == 200

    # Delete
    resp = await api_client.delete(
        f"/api/v1/admin/apps/{app_id}",
        headers=admin_headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_keycloak_import_export(api_client, admin_headers):
    """Keycloak-format import then export produces consistent data."""

    import_data = {
        "clients": [
            {
                "clientId": "myvault-import-test",
                "name": "Import Test",
                "secret": "import-secret",
                "enabled": True,
                "protocol": "openid-connect",
                "attributes": {
                    "myvault.variables": json.dumps([
                        {"key": "api_key", "label": "API Key", "type": "api_key", "required": True},
                    ]),
                    "myvault.check_endpoint": "",
                },
            }
        ]
    }

    # Import
    resp = await api_client.post(
        "/api/v1/admin/apps/import",
        headers=admin_headers,
        json=import_data,
    )
    assert resp.status_code == 200
    assert resp.json()["imported"] == 1

    # Export
    resp = await api_client.get("/api/v1/admin/apps/export", headers=admin_headers)
    assert resp.status_code == 200
    exported = resp.json()
    assert any(c["clientId"] == "myvault-import-test" for c in exported["clients"])


@pytest.mark.asyncio
async def test_list_users(api_client, admin_headers):
    """Admin can list provisioned users."""
    resp = await api_client.get("/api/v1/admin/users", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
