"""MyVault — Coffre-fort de credentials utilisateur pour l'écosystème MirAI."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin_routes import router as admin_router
from app.api.bridge_routes import router as bridge_router
from app.api.health_routes import router as health_router
from app.api.tool_access_routes import router as tool_router
from app.api.user_vault_routes import router as user_router
from app.core.config import settings
from app.core.database import Base, engine

logging.basicConfig(
    level=getattr(logging, settings.myvault_log_level.upper(), logging.INFO),
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

app = FastAPI(
    title="MyVault",
    description="Coffre-fort de credentials utilisateur souverain",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(user_router)
app.include_router(tool_router)
app.include_router(admin_router)
app.include_router(bridge_router)


@app.on_event("startup")
async def on_startup():
    if settings.myvault_dev_mode:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logging.getLogger("myvault").warning(
            "DEV MODE: auto-creating tables, auth bypassed"
        )
