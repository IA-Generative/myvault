"""Outbound URL validation to mitigate SSRF on server-side connection tests.

The backend performs HTTP connection tests towards URLs that originate from
user/admin input. Without validation, an attacker could make the server reach
internal services (cloud metadata, databases, admin panels). This module
rejects non-HTTP(S) schemes and any host that resolves to a non-public address,
unless the host is explicitly allow-listed via MYVAULT_SSRF_ALLOW_HOSTS.
"""

import ipaddress
import socket
from urllib.parse import urlparse

from app.core.config import settings


class SSRFError(ValueError):
    """Raised when an outbound URL is not allowed."""


def _is_public_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_outbound_url(url: str) -> None:
    """Raise SSRFError if `url` must not be fetched by the server.

    Synchronous (performs DNS resolution) — call via a threadpool from async
    code, e.g. `await asyncio.to_thread(validate_outbound_url, url)`.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SSRFError("L'URL doit utiliser le schéma http ou https")

    host = parsed.hostname
    if not host:
        raise SSRFError("URL invalide (hôte manquant)")

    # Explicit allow-list bypasses the private-address check (trusted internal
    # services intentionally configured by an operator).
    if host.lower() in settings.ssrf_allow_hosts:
        return

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise SSRFError(f"Impossible de résoudre l'hôte {host}")

    for info in infos:
        ip_str = info[4][0]
        if not _is_public_ip(ip_str):
            raise SSRFError("L'URL pointe vers une adresse non publique")
