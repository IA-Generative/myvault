"""Authentication: OIDC token validation and dev-mode bypass."""

from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

_oidc_jwks: dict | None = None
_oidc_config: dict | None = None


@dataclass
class AuthenticatedUser:
    user_id: str
    email: str
    name: str
    roles: list[str]

    @property
    def is_admin(self) -> bool:
        return settings.oidc_admin_role in self.roles


@dataclass
class AuthenticatedClient:
    """Machine-to-machine client (client_credentials grant)."""
    client_id: str


async def _fetch_oidc_config() -> dict:
    global _oidc_config
    if _oidc_config is None:
        # Fetch via internal URL (Docker network) but tokens use public issuer
        well_known = f"{settings.oidc_jwks_base_url}/.well-known/openid-configuration"
        async with httpx.AsyncClient() as client:
            resp = await client.get(well_known)
            resp.raise_for_status()
            _oidc_config = resp.json()
    return _oidc_config


async def _fetch_jwks() -> dict:
    global _oidc_jwks
    if _oidc_jwks is None:
        config = await _fetch_oidc_config()
        jwks_uri = config["jwks_uri"]
        # Replace public host with internal host in JWKS URI
        if settings.oidc_internal_url:
            jwks_uri = jwks_uri.replace(
                settings.oidc_issuer_url.rsplit("/realms/", 1)[0],
                settings.oidc_internal_url.rsplit("/realms/", 1)[0],
            )
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_uri)
            resp.raise_for_status()
            _oidc_jwks = resp.json()
    return _oidc_jwks


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT token against OIDC JWKS."""
    from jose import jwt as jose_jwt, JWTError

    try:
        # In dev mode, accept a simple token
        if settings.myvault_dev_mode and token == "dev-token":
            return {
                "sub": settings.myvault_dev_user_id,
                "email": settings.myvault_dev_user_email,
                "name": settings.myvault_dev_user_name,
                "realm_access": {
                    "roles": ["myvault-admin"] if settings.myvault_dev_admin else []
                },
            }

        # For production, we need JWKS (loaded at startup)
        unverified = jose_jwt.get_unverified_header(token)
        # Find the matching key
        if _oidc_jwks is None:
            raise HTTPException(status_code=503, detail="OIDC not initialized")

        rsa_key = {}
        for key in _oidc_jwks.get("keys", []):
            if key.get("kid") == unverified.get("kid"):
                rsa_key = key
                break

        if not rsa_key:
            raise HTTPException(status_code=401, detail="Token signing key not found")

        payload = jose_jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.oidc_client_id,
            issuer=settings.oidc_issuer_url,
        )
        return payload

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """Extract and validate the authenticated user from the request."""
    if credentials is None:
        # Check for dev mode cookie/header
        if settings.myvault_dev_mode:
            return AuthenticatedUser(
                user_id=settings.myvault_dev_user_id,
                email=settings.myvault_dev_user_email,
                name=settings.myvault_dev_user_name,
                roles=["myvault-admin"] if settings.myvault_dev_admin else [],
            )
        raise HTTPException(status_code=401, detail="Authentication required")

    payload = _decode_token(credentials.credentials)

    roles = payload.get("realm_access", {}).get("roles", [])
    # Also check resource_access for client-specific roles
    client_roles = (
        payload.get("resource_access", {})
        .get(settings.oidc_client_id, {})
        .get("roles", [])
    )
    all_roles = list(set(roles + client_roles))

    return AuthenticatedUser(
        user_id=payload["sub"],
        email=payload.get("email", ""),
        name=payload.get("name", payload.get("preferred_username", "")),
        roles=all_roles,
    )


async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Dependency that requires the admin role."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def validate_client_credentials(
    client_id: str, client_secret: str, db_session
) -> AuthenticatedClient | None:
    """Validate client_credentials for machine-to-machine auth."""
    from app.models.database_models import Application
    from sqlalchemy import select

    result = await db_session.execute(
        select(Application).where(
            Application.client_id == client_id,
            Application.client_secret == client_secret,
            Application.status == "active",
        )
    )
    app = result.scalar_one_or_none()
    if app is None:
        return None
    return AuthenticatedClient(client_id=client_id)
