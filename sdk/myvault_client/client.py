"""MyVault HTTP client for tools and services to retrieve user credentials."""

import os

import httpx

from myvault_client.exceptions import (
    AuthenticationError,
    CredentialsMissing,
    MyVaultError,
)
from myvault_client.models import AppConfig, Credentials


class MyVaultClient:
    """Client for the MyVault API, used by tools to retrieve user credentials.

    Configuration via environment variables:
        MYVAULT_URL: Base URL of the MyVault instance
        MYVAULT_CLIENT_ID: Client ID for this tool
        MYVAULT_CLIENT_SECRET: Client secret for this tool
    """

    def __init__(
        self,
        base_url: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        timeout: float = 10.0,
    ):
        self.base_url = (base_url or os.environ.get("MYVAULT_URL", "")).rstrip("/")
        self.client_id = client_id or os.environ.get("MYVAULT_CLIENT_ID", "")
        self.client_secret = client_secret or os.environ.get("MYVAULT_CLIENT_SECRET", "")
        self.timeout = timeout

        if not self.base_url:
            raise MyVaultError("MYVAULT_URL is not configured")

    def _auth_headers(self) -> dict[str, str]:
        return {
            "X-Client-Id": self.client_id,
            "X-Client-Secret": self.client_secret,
        }

    async def get_credentials(
        self, app_id: str, user_id: str
    ) -> Credentials:
        """Retrieve a user's decrypted credentials for an application.

        Args:
            app_id: The application slug or client_id
            user_id: The OIDC subject identifier of the user

        Returns:
            Credentials object with decrypted values

        Raises:
            CredentialsMissing: If the user hasn't configured credentials
            AuthenticationError: If client credentials are invalid
        """
        slug = app_id.replace("myvault-", "").replace("_", "-")
        url = f"{self.base_url}/api/v1/vault/{slug}/user/{user_id}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._auth_headers())

        if resp.status_code == 401:
            raise AuthenticationError("Invalid client credentials")

        if resp.status_code == 404:
            data = resp.json()
            action_url = ""
            if isinstance(data.get("detail"), dict):
                action_url = f"{self.base_url}{data['detail'].get('action_url', '')}"
            raise CredentialsMissing(app_id, action_url=action_url)

        if resp.status_code != 200:
            raise MyVaultError(f"Unexpected response: {resp.status_code}")

        return Credentials(values=resp.json())

    async def ensure_enrolled(self, config: AppConfig) -> dict:
        """Ensure the application is registered in MyVault (auto-enrollment).

        If the application already exists, this is a no-op.

        Args:
            config: Application configuration for enrollment

        Returns:
            Enrollment result dict with app_id and status
        """
        url = f"{self.base_url}/api/v1/apps/enroll"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=config.to_enroll_payload())

        if resp.status_code == 400:
            raise MyVaultError(f"Enrollment failed: {resp.json().get('detail', '')}")

        resp.raise_for_status()
        return resp.json()

    async def check_credentials(
        self, app_id: str, user_id: str
    ) -> bool:
        """Check if a user has valid credentials configured.

        Returns True if credentials are configured and enabled.
        """
        slug = app_id.replace("myvault-", "").replace("_", "-")
        url = f"{self.base_url}/api/v1/apps/{slug}/check/{user_id}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._auth_headers())

        if resp.status_code != 200:
            return False

        data = resp.json()
        return data.get("configured", False) and data.get("enabled", False)

    def get_config_url(self, app_slug: str) -> str:
        """Get the URL where users can configure their credentials."""
        return f"{self.base_url}/app/{app_slug}"

    def credentials_required_response(
        self, app_slug: str, app_name: str = ""
    ) -> dict:
        """Generate a standard response when credentials are missing.

        Use this in your tool's run() method to return a user-friendly
        message with a link to configure credentials.
        """
        config_url = self.get_config_url(app_slug)
        return {
            "error": "credentials_required",
            "message": (
                f"Ce tool nécessite vos identifiants{f' {app_name}' if app_name else ''}. "
                "Veuillez les configurer dans votre coffre-fort :"
            ),
            "action_url": config_url,
            "action_label": f"Configurer mes accès{f' {app_name}' if app_name else ''}",
        }
