"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "myvault"
    postgres_user: str = "myvault"
    postgres_password: str = "changeme"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # Security
    myvault_master_key: str = "changeme_generate_with_openssl_rand_hex_32"
    myvault_jwt_secret: str = "changeme_jwt_secret"

    # Shared secret required to auto-enroll an application (M2M). When empty,
    # enrollment is disabled (returns 503) — never anonymous.
    myvault_enroll_secret: str = ""

    # Comma-separated hostnames allowed as outbound targets for connection
    # tests even if they resolve to a private address (anti-SSRF allow-list).
    myvault_ssrf_allow_hosts: str = ""

    @property
    def ssrf_allow_hosts(self) -> set[str]:
        return {
            h.strip().lower()
            for h in self.myvault_ssrf_allow_hosts.split(",")
            if h.strip()
        }

    # OIDC / Keycloak — realm "openwebui" (owuicore-main)
    # OIDC_ISSUER_URL: public URL (what the browser sees, used as JWT issuer claim)
    oidc_issuer_url: str = "http://localhost:8082/realms/openwebui"
    # OIDC_INTERNAL_URL: internal Docker URL for fetching JWKS (optional, falls back to issuer)
    oidc_internal_url: str = ""
    oidc_client_id: str = "myvault"
    oidc_client_secret: str = ""
    oidc_admin_role: str = "myvault-admin"

    # Restriction d'acces a un groupe du realm. Vide = aucune restriction, tout
    # utilisateur authentifie entre (comportement historique). Renseigne, seuls
    # les porteurs du groupe nomme dans le claim `groups` sont admis.
    myvault_groupe_exige: str = ""

    @property
    def oidc_jwks_base_url(self) -> str:
        """URL used to fetch OIDC config/JWKS (internal Docker network)."""
        return self.oidc_internal_url or self.oidc_issuer_url

    # Application
    myvault_url: str = "http://localhost:8085"
    myvault_log_level: str = "info"
    myvault_cors_origins: str = "http://localhost:8085"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.myvault_cors_origins.split(",")]

    # Environment: "development" (default) or "production".
    # In production the app refuses to start with a default/weak master key or
    # with dev mode enabled (see app.main.on_startup).
    myvault_environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.myvault_environment.strip().lower().startswith("prod")

    # Development mode
    myvault_dev_mode: bool = False
    myvault_dev_user_id: str = "dev-user-001"
    myvault_dev_user_email: str = "dev@example.com"
    myvault_dev_user_name: str = "Utilisateur"
    myvault_dev_admin: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
