"""TOTP helpers — derive a current one-time code from a stored 2FA seed.

The seed (shared secret) is what the user configures once, from the service's
2FA setup screen. It can be a raw base32 secret (with or without spaces) or a
full `otpauth://` URI. Tools never receive the seed: they get the current code
derived here, server-side.
"""

from urllib.parse import parse_qs, urlparse

import pyotp


def _normalize_seed(seed: str) -> str:
    """Extract a base32 secret from a raw secret or an otpauth:// URI."""
    seed = (seed or "").strip()
    if seed.lower().startswith("otpauth://"):
        params = parse_qs(urlparse(seed).query)
        secret = params.get("secret", [""])[0]
        return secret.replace(" ", "").upper()
    return seed.replace(" ", "").upper()


def current_code(seed: str) -> str:
    """Return the current 6-digit TOTP code for a seed. Raises on an invalid seed."""
    return pyotp.TOTP(_normalize_seed(seed)).now()
