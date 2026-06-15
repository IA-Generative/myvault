"""MyVault — Coffre-fort de credentials utilisateur pour l'écosystème MirAI."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.ratelimit import limiter
from app.api.admin_routes import router as admin_router
from app.api.bridge_routes import router as bridge_router
from app.api.health_routes import router as health_router
from app.api.personal_routes import router as personal_router
from app.api.security_routes import router as security_router
from app.api.tool_access_routes import router as tool_router
from app.api.user_vault_routes import router as user_router
from app.core.config import settings
from app.core.database import Base, engine

logging.basicConfig(
    level=getattr(logging, settings.myvault_log_level.upper(), logging.INFO),
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

# Known weak/default master keys that must never be used in production.
_WEAK_MASTER_KEYS = {
    "changeme_generate_with_openssl_rand_hex_32",
    "0123456789abcdef" * 4,
}

# In production, hide the interactive API docs / OpenAPI schema.
_docs_enabled = not settings.is_production

app = FastAPI(
    title="MyVault",
    description="Coffre-fort de credentials utilisateur souverain",
    version="1.0.0",
    docs_url="/api/docs" if _docs_enabled else None,
    redoc_url="/api/redoc" if _docs_enabled else None,
    openapi_url="/api/openapi.json" if _docs_enabled else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health_router)
app.include_router(user_router)
app.include_router(personal_router)
app.include_router(security_router)
app.include_router(tool_router)
app.include_router(admin_router)
app.include_router(bridge_router)


@app.on_event("startup")
async def on_startup():
    # Import models so Base.metadata knows about all tables
    from app.models import database_models  # noqa: F401

    logger = logging.getLogger("myvault")

    # Refuse to start in production with an unsafe configuration.
    if settings.is_production:
        key = settings.myvault_master_key
        if key in _WEAK_MASTER_KEYS or len(key) < 64:
            raise RuntimeError(
                "MYVAULT_MASTER_KEY non configurée ou trop faible en production "
                "— générer avec `openssl rand -hex 32`."
            )
        if settings.myvault_dev_mode:
            raise RuntimeError(
                "MYVAULT_DEV_MODE doit être désactivé en production "
                "(il contourne l'authentification)."
            )

    # Always ensure tables exist (safe: CREATE TABLE IF NOT EXISTS)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created")
    except Exception as e:
        logger.error("Failed to create tables: %s", e)
        raise

    if settings.myvault_dev_mode:
        logger.warning("DEV MODE: auth bypassed, dev user active")
    else:
        # Pre-load OIDC JWKS so first request doesn't have to wait
        try:
            from app.core.auth import _fetch_jwks
            await _fetch_jwks()
            logger.info("OIDC JWKS loaded from %s", settings.oidc_jwks_base_url)
        except Exception as e:
            logger.warning("Could not pre-load OIDC JWKS: %s", e)
