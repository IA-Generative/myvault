"""Shared fixtures for end-to-end tests."""

import os
import pytest
import httpx

BASE_URL = os.environ.get("MYVAULT_TEST_URL", "http://localhost:8000")


@pytest.fixture
def api_client():
    """HTTP client configured for the test MyVault instance."""
    return httpx.AsyncClient(base_url=BASE_URL, timeout=10.0)


@pytest.fixture
def admin_headers():
    """Headers for dev-mode admin requests."""
    return {"Authorization": "Bearer dev-token"}


@pytest.fixture
def tool_headers():
    """Headers for machine-to-machine tool requests."""
    return {
        "X-Client-Id": "myvault-test-tool",
        "X-Client-Secret": "test-secret",
    }
