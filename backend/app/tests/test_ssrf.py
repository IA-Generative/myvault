"""Tests for the anti-SSRF outbound URL validator."""

import pytest

from app.core import ssrf
from app.core.ssrf import SSRFError, validate_outbound_url
from app.core.config import settings


def test_rejects_non_http_scheme():
    with pytest.raises(SSRFError):
        validate_outbound_url("file:///etc/passwd")
    with pytest.raises(SSRFError):
        validate_outbound_url("gopher://x/")


def test_rejects_loopback():
    with pytest.raises(SSRFError):
        validate_outbound_url("http://127.0.0.1/admin")
    with pytest.raises(SSRFError):
        validate_outbound_url("http://localhost:8080/")


def test_rejects_private_ranges():
    for url in (
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata
    ):
        with pytest.raises(SSRFError):
            validate_outbound_url(url)


def test_accepts_public_ip():
    # 1.1.1.1 is a public address; should not raise.
    validate_outbound_url("https://1.1.1.1/")


def test_allow_list_bypasses_private_check(monkeypatch):
    monkeypatch.setattr(settings, "myvault_ssrf_allow_hosts", "internal.svc")
    # Host won't resolve, but allow-list short-circuits before resolution.
    validate_outbound_url("http://internal.svc/health")


def test_unresolvable_host_rejected():
    with pytest.raises(SSRFError):
        validate_outbound_url("http://nonexistent.invalid./")
