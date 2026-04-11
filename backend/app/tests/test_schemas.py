"""Unit tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError

from app.models.schemas import (
    AppCreate,
    EntrySave,
    KeycloakImport,
    BridgeImportRequest,
    VariableDefinition,
    EnrollRequest,
)


class TestVariableDefinition:
    def test_basic_variable(self):
        v = VariableDefinition(key="api_token", label="API Token", var_type="secret")
        assert v.key == "api_token"
        assert v.type == "secret"
        assert v.required is True

    def test_with_default(self):
        v = VariableDefinition(
            key="url", label="URL", var_type="url",
            default_value="https://example.com"
        )
        assert v.default == "https://example.com"


class TestAppCreate:
    def test_valid_app(self):
        app = AppCreate(
            client_id="myvault-test",
            name="Test App",
            friendly_slug="test-app",
            required_variables=[
                VariableDefinition(key="token", label="Token", var_type="api_key")
            ],
        )
        assert app.client_id == "myvault-test"
        assert len(app.required_variables) == 1

    def test_with_aliases(self):
        app = AppCreate(
            client_id="myvault-test",
            name="Test",
            friendly_slug="test",
            variable_aliases={"api_token": ["API_KEY", "TOKEN"]},
            required_variables=[],
        )
        assert app.variable_aliases["api_token"] == ["API_KEY", "TOKEN"]


class TestEntrySave:
    def test_valid_entry(self):
        entry = EntrySave(values={"api_token": "sk-123", "url": "https://api.com"})
        assert entry.values["api_token"] == "sk-123"
        assert entry.enabled is True

    def test_disabled_entry(self):
        entry = EntrySave(values={}, enabled=False)
        assert entry.enabled is False


class TestKeycloakImport:
    def test_valid_import(self):
        data = KeycloakImport(
            clients=[
                {
                    "clientId": "myvault-grist",
                    "name": "Grist",
                    "secret": "abc123",
                    "attributes": {
                        "myvault.variables": '[{"key": "token", "label": "Token", "type": "api_key"}]'
                    },
                }
            ]
        )
        assert len(data.clients) == 1
        assert data.clients[0].clientId == "myvault-grist"

    def test_empty_clients(self):
        data = KeycloakImport(clients=[])
        assert len(data.clients) == 0


class TestBridgeImportRequest:
    def test_env_format(self):
        req = BridgeImportRequest(format="env", data="API_KEY=xxx\nURL=yyy")
        assert req.format == "env"

    def test_json_format(self):
        req = BridgeImportRequest(format="json", data='{"key": "val"}')
        assert req.format == "json"


class TestEnrollRequest:
    def test_valid_enroll(self):
        req = EnrollRequest(
            client_id="myvault-test-tool",
            client_secret="secret123",
            name="Test Tool",
            variables=[
                VariableDefinition(key="api_key", label="API Key", var_type="api_key")
            ],
        )
        assert req.client_id == "myvault-test-tool"
        assert len(req.variables) == 1
