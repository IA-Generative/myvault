"""Routes for admin operations: application CRUD, import/export, user management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser, require_admin
from app.core.database import get_db
from app.models.schemas import AppCreate, AppUpdate, KeycloakImport
from app.services import app_service

router = APIRouter(prefix="/api/v1/admin", tags=["Administration"])


@router.post("/apps")
async def create_application(
    body: AppCreate,
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new application."""
    app = await app_service.create_app(db, body, created_by=admin.user_id)
    return {"id": app.id, "friendly_slug": app.friendly_slug, "status": "created"}


@router.put("/apps/{app_id}")
async def update_application(
    app_id: uuid.UUID,
    body: AppUpdate,
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing application."""
    app = await app_service.update_app(db, app_id, body)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"id": app.id, "status": "updated"}


@router.delete("/apps/{app_id}")
async def delete_application(
    app_id: uuid.UUID,
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete an application and all associated user entries."""
    deleted = await app_service.delete_app(db, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "deleted"}


@router.get("/apps")
async def list_applications(
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all applications (admin view)."""
    apps = await app_service.list_apps(db)
    return [
        {
            "id": app.id,
            "client_id": app.client_id,
            "name": app.name,
            "description": app.description,
            "friendly_slug": app.friendly_slug,
            "status": app.status,
            "required_variables": [
                {
                    "key": v.key,
                    "label": v.label,
                    "var_type": v.var_type,
                    "required": v.required,
                }
                for v in app.required_variables
            ],
            "created_at": app.created_at,
        }
        for app in apps
    ]


@router.post("/apps/import")
async def import_keycloak_json(
    body: KeycloakImport,
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Import applications from a Keycloak-compatible JSON file."""
    apps = await app_service.import_keycloak(db, body, created_by=admin.user_id)
    return {
        "imported": len(apps),
        "apps": [{"id": a.id, "name": a.name, "slug": a.friendly_slug} for a in apps],
    }


@router.get("/apps/export")
async def export_keycloak_json(
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export all applications in Keycloak-compatible JSON format."""
    return await app_service.export_keycloak(db)


@router.get("/users")
async def list_provisioned_users(
    admin: AuthenticatedUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users who have configured credentials (admin never sees values)."""
    return await app_service.list_provisioned_users(db)
