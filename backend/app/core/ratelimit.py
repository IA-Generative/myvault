"""Shared rate limiter (slowapi).

Limits abuse on sensitive endpoints (master-password unlock, M2M enrollment
and credential reads). Keying respects X-Forwarded-For so the client IP is used
behind the ingress/reverse-proxy rather than the proxy address.

Note: limits are per-process (in-memory). With multiple replicas this is a
defense-in-depth throttle, not a global counter; a shared store (Redis) would
be required for strict global limits.
"""

from slowapi import Limiter
from starlette.requests import Request


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


limiter = Limiter(key_func=client_ip)
