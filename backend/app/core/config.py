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

    # OIDC / Keycloak — realm "openwebui" (owuicore-main)
    oidc_issuer_url: str = "http://localhost:8082/realms/openwebui"
    oidc_client_id: str = "myvault"
    oidc_client_secret: str = ""
    oidc_admin_role: str = "myvault-admin"

    # Application
    myvault_url: str = "http://localhost:8085"
    myvault_log_level: str = "info"
    myvault_cors_origins: str = "http://localhost:8085"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.myvault_cors_origins.split(",")]

    # Development mode
    myvault_dev_mode: bool = False
    myvault_dev_user_id: str = "dev-user-001"
    myvault_dev_user_email: str = "dev@example.com"
    myvault_dev_user_name: str = "Utilisateur"
    myvault_dev_admin: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
