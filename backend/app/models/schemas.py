"""Pydantic schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Variable Definitions ---


class VariableDefinition(BaseModel):
    key: str
    label: str
    type: str = Field(alias="var_type", default="text")
    required: bool = True
    description: str = ""
    default: str = Field(default="", alias="default_value")
    choices: list[str] | None = None

    model_config = {"populate_by_name": True}


# --- Application ---


class AppCreate(BaseModel):
    client_id: str
    client_secret: str = ""
    name: str
    description: str = ""
    icon_url: str = ""
    friendly_slug: str
    check_connection_endpoint: str = ""
    variable_aliases: dict[str, list[str]] | None = None
    required_variables: list[VariableDefinition]


class AppUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon_url: str | None = None
    status: str | None = None
    check_connection_endpoint: str | None = None
    variable_aliases: dict[str, list[str]] | None = None
    required_variables: list[VariableDefinition] | None = None


class AppResponse(BaseModel):
    id: uuid.UUID
    client_id: str
    name: str
    description: str
    icon_url: str
    friendly_slug: str
    status: str
    check_connection_endpoint: str
    variable_aliases: dict[str, list[str]] | None = None
    required_variables: list[VariableDefinition]
    created_at: datetime

    model_config = {"from_attributes": True}


class AppListItem(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    icon_url: str
    friendly_slug: str
    status: str
    required_variables: list[VariableDefinition]
    user_configured: bool = False
    user_enabled: bool = False
    check_status: str = "untested"

    model_config = {"from_attributes": True}


# --- User Vault Entry ---


class EntrySave(BaseModel):
    values: dict[str, str]
    enabled: bool = True


class EntryResponse(BaseModel):
    entry_id: uuid.UUID
    app_id: uuid.UUID
    app_name: str = ""
    app_slug: str = ""
    enabled: bool
    values: dict[str, str]
    last_check: datetime | None = None
    check_status: str = "untested"
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Check Connection ---


class CheckConnectionResponse(BaseModel):
    status: str  # "ok" | "error"
    detail: str = ""


# --- Bridge ---


class BridgeExportResponse(BaseModel):
    app_name: str
    app_slug: str
    format: str
    data: str
    variables: dict[str, str]


class BridgeImportRequest(BaseModel):
    format: str  # "json" | "env" | "yaml"
    data: str


# --- Keycloak Import/Export ---


class KeycloakClient(BaseModel):
    clientId: str
    name: str = ""
    secret: str = ""
    enabled: bool = True
    protocol: str = "openid-connect"
    attributes: dict[str, str] = {}


class KeycloakImport(BaseModel):
    clients: list[KeycloakClient]


# --- Admin ---


class UserSummary(BaseModel):
    user_id: str
    email: str = ""
    apps_configured: int = 0
    last_activity: datetime | None = None


# --- Auto-enrollment ---


class EnrollRequest(BaseModel):
    client_id: str
    client_secret: str
    name: str = ""
    variables: list[VariableDefinition] = []
    check_connection_endpoint: str = ""
