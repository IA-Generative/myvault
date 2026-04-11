"""Business logic for application management (admin CRUD, enrollment, import/export)."""

import json
import secrets
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database_models import Application, RequiredVariable, UserVaultEntry
from app.models.schemas import (
    AppCreate,
    AppUpdate,
    EnrollRequest,
    KeycloakImport,
    VariableDefinition,
)


async def create_app(db: AsyncSession, data: AppCreate, created_by: str) -> Application:
    """Create a new application with its required variables."""
    client_secret = data.client_secret or secrets.token_urlsafe(32)

    app = Application(
        client_id=data.client_id,
        client_secret=client_secret,
        name=data.name,
        description=data.description,
        icon_url=data.icon_url,
        friendly_slug=data.friendly_slug,
        check_connection_endpoint=data.check_connection_endpoint,
        variable_aliases=data.variable_aliases,
        created_by=created_by,
    )
    db.add(app)
    await db.flush()

    for idx, var in enumerate(data.required_variables):
        rv = RequiredVariable(
            app_id=app.id,
            key=var.key,
            label=var.label,
            var_type=var.type,
            required=var.required,
            description=var.description,
            default_value=var.default,
            choices=var.choices,
            sort_order=idx,
        )
        db.add(rv)

    await db.flush()
    return app


async def update_app(
    db: AsyncSession, app_id: uuid.UUID, data: AppUpdate
) -> Application | None:
    """Update an existing application."""
    result = await db.execute(
        select(Application)
        .where(Application.id == app_id)
        .options(selectinload(Application.required_variables))
    )
    app = result.scalar_one_or_none()
    if app is None:
        return None

    if data.name is not None:
        app.name = data.name
    if data.description is not None:
        app.description = data.description
    if data.icon_url is not None:
        app.icon_url = data.icon_url
    if data.status is not None:
        app.status = data.status
    if data.check_connection_endpoint is not None:
        app.check_connection_endpoint = data.check_connection_endpoint
    if data.variable_aliases is not None:
        app.variable_aliases = data.variable_aliases

    if data.required_variables is not None:
        # Replace all variables
        for rv in app.required_variables:
            await db.delete(rv)
        await db.flush()

        for idx, var in enumerate(data.required_variables):
            rv = RequiredVariable(
                app_id=app.id,
                key=var.key,
                label=var.label,
                var_type=var.type,
                required=var.required,
                description=var.description,
                default_value=var.default,
                choices=var.choices,
                sort_order=idx,
            )
            db.add(rv)

    await db.flush()
    return app


async def delete_app(db: AsyncSession, app_id: uuid.UUID) -> bool:
    """Delete an application and all its entries."""
    result = await db.execute(
        select(Application).where(Application.id == app_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        return False
    await db.delete(app)
    await db.flush()
    return True


async def get_app_by_id(db: AsyncSession, app_id: uuid.UUID) -> Application | None:
    result = await db.execute(
        select(Application)
        .where(Application.id == app_id)
        .options(selectinload(Application.required_variables))
    )
    return result.scalar_one_or_none()


async def get_app_by_slug(db: AsyncSession, slug: str) -> Application | None:
    result = await db.execute(
        select(Application)
        .where(Application.friendly_slug == slug)
        .options(selectinload(Application.required_variables))
    )
    return result.scalar_one_or_none()


async def list_apps(db: AsyncSession) -> list[Application]:
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.required_variables))
        .order_by(Application.name)
    )
    return list(result.scalars().all())


async def enroll_app(db: AsyncSession, data: EnrollRequest) -> Application:
    """Auto-enroll an application (tool calling in with client_credentials)."""
    # Check if already exists
    result = await db.execute(
        select(Application).where(Application.client_id == data.client_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    slug = data.client_id.replace("myvault-", "").replace("_", "-")
    app_data = AppCreate(
        client_id=data.client_id,
        client_secret=data.client_secret,
        name=data.name or data.client_id,
        friendly_slug=slug,
        check_connection_endpoint=data.check_connection_endpoint,
        required_variables=data.variables,
    )
    return await create_app(db, app_data, created_by="auto-enroll")


async def import_keycloak(
    db: AsyncSession, data: KeycloakImport, created_by: str
) -> list[Application]:
    """Import applications from Keycloak-compatible JSON format."""
    apps = []
    for client in data.clients:
        # Parse myvault-specific attributes
        variables_json = client.attributes.get("myvault.variables", "[]")
        check_endpoint = client.attributes.get("myvault.check_endpoint", "")
        icon_url = client.attributes.get("myvault.icon_url", "")

        try:
            variables = json.loads(variables_json)
        except json.JSONDecodeError:
            variables = []

        var_defs = [
            VariableDefinition(
                key=v.get("key", ""),
                label=v.get("label", v.get("key", "")),
                var_type=v.get("type", "text"),
                required=v.get("required", True),
                description=v.get("description", ""),
                default_value=v.get("default", ""),
            )
            for v in variables
        ]

        slug = client.clientId.replace("myvault-", "").replace("_", "-")
        app_data = AppCreate(
            client_id=client.clientId,
            client_secret=client.secret,
            name=client.name or client.clientId,
            icon_url=icon_url,
            friendly_slug=slug,
            check_connection_endpoint=check_endpoint,
            required_variables=var_defs,
        )

        app = await create_app(db, app_data, created_by=created_by)
        apps.append(app)

    return apps


async def export_keycloak(db: AsyncSession) -> dict:
    """Export all applications in Keycloak-compatible JSON format."""
    apps = await list_apps(db)
    clients = []
    for app in apps:
        variables = [
            {
                "key": v.key,
                "label": v.label,
                "type": v.var_type,
                "required": v.required,
                "description": v.description,
                "default": v.default_value,
            }
            for v in app.required_variables
        ]
        clients.append({
            "clientId": app.client_id,
            "name": app.name,
            "secret": app.client_secret,
            "enabled": app.status == "active",
            "protocol": "openid-connect",
            "attributes": {
                "myvault.variables": json.dumps(variables),
                "myvault.check_endpoint": app.check_connection_endpoint,
                "myvault.icon_url": app.icon_url,
            },
        })
    return {"clients": clients}


async def list_provisioned_users(db: AsyncSession) -> list[dict]:
    """List all users who have configured at least one vault entry."""
    result = await db.execute(
        select(
            UserVaultEntry.user_id,
            func.count(UserVaultEntry.id).label("apps_configured"),
            func.max(UserVaultEntry.updated_at).label("last_activity"),
        ).group_by(UserVaultEntry.user_id)
    )
    return [
        {
            "user_id": row.user_id,
            "apps_configured": row.apps_configured,
            "last_activity": row.last_activity,
        }
        for row in result.all()
    ]
