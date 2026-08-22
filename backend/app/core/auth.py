"""Authentication: OIDC token validation and dev-mode bypass."""

import hashlib
import logging
import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger("myvault.auth")

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
            issuer=settings.oidc_issuer_url,
            # Audience checked manually below: Keycloak access tokens default to
            # aud="account" and carry the requesting client in "azp" unless an
            # Audience protocol mapper is configured on the client.
            options={"verify_aud": False},
        )

        # Bind the token to our client without requiring a Keycloak audience
        # mapper on every deployment: accept it when the configured client_id is
        # in the audience (mapper present) OR is the authorized party (azp, the
        # default Keycloak shape). Tokens issued for another realm client are
        # still rejected.
        aud = payload.get("aud", [])
        if isinstance(aud, str):
            aud = [aud]
        azp = payload.get("azp", "")
        if settings.oidc_client_id not in aud and azp != settings.oidc_client_id:
            logger.warning(
                "Token audience mismatch: expected client_id=%r, token aud=%r azp=%r iss=%r",
                settings.oidc_client_id,
                aud,
                azp,
                payload.get("iss"),
            )
            raise HTTPException(
                status_code=401, detail="Invalid token: Invalid audience"
            )

        return payload

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# Identifiants resolus via /userinfo, avec une duree de vie courte : on evite un appel
# au fournisseur d'identite a chaque requete sans jamais garder une reponse perimee.
_sub_par_jeton: dict[str, tuple[str, float]] = {}
_SUB_CACHE_TTL = 300.0


async def _sub_depuis_userinfo(jeton: str) -> str | None:
    """Recupere le `sub` aupres du point /userinfo.

    Certains fournisseurs n'emettent pas `sub` dans le jeton d'acces. OpenID Connect
    garantit en revanche que /userinfo le renvoie TOUJOURS : c'est donc la source
    normale, et elle donne le meme identifiant immuable — pas un substitut.
    """
    empreinte = hashlib.sha256(jeton.encode()).hexdigest()
    maintenant = time.time()
    connu = _sub_par_jeton.get(empreinte)
    if connu and connu[1] > maintenant:
        return connu[0]

    try:
        config = await _fetch_oidc_config()
        url = config.get("userinfo_endpoint")
        if not url:
            return None
        # Meme substitution d'hote que pour la JWKS quand un acces interne est configure.
        if settings.oidc_internal_url:
            url = url.replace(
                settings.oidc_issuer_url.rsplit("/realms/", 1)[0],
                settings.oidc_internal_url.rsplit("/realms/", 1)[0],
            )
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {jeton}"})
        if resp.status_code != 200:
            logger.warning("/userinfo a repondu %s", resp.status_code)
            return None
        sub = resp.json().get("sub")
    except Exception as e:  # noqa: BLE001 - une panne du fournisseur ne doit pas masquer sa cause
        logger.warning("Impossible d'interroger /userinfo : %s", e)
        return None

    if sub:
        if len(_sub_par_jeton) > 2000:
            _sub_par_jeton.clear()
        _sub_par_jeton[empreinte] = (sub, maintenant + _SUB_CACHE_TTL)
    return sub


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

    # Restriction d'acces a un groupe du realm, si elle est demandee. Le claim
    # `groups` porte le NOM FEUILLE des groupes (mapper Keycloak full.path=false),
    # jamais leur chemin : on compare a un nom, pas a un « /chemin/groupe ».
    exige = settings.myvault_groupe_exige.strip()
    if exige:
        brut = payload.get("groups", [])
        groupes = brut if isinstance(brut, list) else [brut]
        if exige not in [str(g) for g in groupes]:
            # Tracer le refus sans nommer la personne : le motif suffit au diagnostic.
            logger.warning(
                "Acces refuse : le jeton ne porte pas le groupe requis (%d groupe(s) presente(s))",
                len(groupes),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted to authorized group members",
            )

    claim = settings.myvault_claim_identite
    identifiant = payload.get(claim)
    if not identifiant and claim == "sub":
        # Le jeton d'acces n'a pas de `sub` : on le demande au fournisseur, qui est
        # tenu de le fournir. L'identifiant obtenu est le meme, et il est immuable.
        identifiant = await _sub_depuis_userinfo(credentials.credentials)
    if not identifiant:
        # Diagnostic explicite plutot qu'un KeyError transforme en 500 : dire QUEL
        # claim manque, et lesquels sont presents, epargne une heure de recherche.
        logger.error(
            "Jeton sans claim d'identite « %s ». Claims presents : %s",
            claim,
            ", ".join(sorted(payload.keys())),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token has no usable identity claim ({claim})",
        )

    return AuthenticatedUser(
        user_id=identifiant,
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


def _looks_hashed(stored: str) -> bool:
    """A bcrypt hash starts with the $2 marker; legacy secrets are plaintext."""
    return stored.startswith("$2")


async def validate_client_credentials(
    client_id: str, client_secret: str, db_session
) -> AuthenticatedClient | None:
    """Validate client_credentials for machine-to-machine auth.

    Secrets are stored as bcrypt hashes. Legacy plaintext secrets are still
    accepted (constant-time comparison) and transparently upgraded to a hash on
    first successful use, so no manual migration is required.
    """
    import secrets as _secrets

    from sqlalchemy import select
    from passlib.hash import bcrypt

    from app.models.database_models import Application

    result = await db_session.execute(
        select(Application).where(
            Application.client_id == client_id,
            Application.status == "active",
        )
    )
    app = result.scalar_one_or_none()
    if app is None:
        # Still spend time to reduce timing oracle on client_id existence.
        bcrypt.hash(client_secret)
        return None

    stored = app.client_secret or ""
    if _looks_hashed(stored):
        try:
            ok = bcrypt.verify(client_secret, stored)
        except ValueError:
            ok = False
    else:
        ok = _secrets.compare_digest(client_secret, stored)
        if ok:
            # Opportunistic upgrade of a legacy plaintext secret.
            app.client_secret = bcrypt.hash(client_secret)

    if not ok:
        return None
    return AuthenticatedClient(client_id=client_id)
