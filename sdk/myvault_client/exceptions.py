"""Exceptions raised by the MyVault SDK."""


class MyVaultError(Exception):
    """Base exception for all MyVault errors."""
    pass


class CredentialsMissing(MyVaultError):
    """User has not configured credentials for this application."""

    def __init__(self, app_slug: str, action_url: str = ""):
        self.app_slug = app_slug
        self.action_url = action_url
        super().__init__(
            f"Credentials not configured for app '{app_slug}'. "
            f"Configure at: {action_url}"
        )


class AuthenticationError(MyVaultError):
    """Invalid client credentials (client_id / client_secret)."""
    pass


class ConnectionCheckFailed(MyVaultError):
    """The check_connection test returned an error."""

    def __init__(self, detail: str = ""):
        self.detail = detail
        super().__init__(f"Connection check failed: {detail}")
