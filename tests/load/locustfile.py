"""Load tests for MyVault API using Locust.

Run with:
    locust -f locustfile.py --headless -u 100 -r 10 -t 60s --host http://localhost:8000
"""

from locust import HttpUser, task, between


class VaultUser(HttpUser):
    """Simulates a user interacting with their vault."""

    wait_time = between(1, 3)
    headers = {"Authorization": "Bearer dev-token"}

    @task(5)
    def list_apps(self):
        self.client.get("/api/v1/me/apps", headers=self.headers)

    @task(3)
    def get_entry(self):
        self.client.get(
            "/api/v1/me/apps/grist-connector/entries",
            headers=self.headers,
        )

    @task(2)
    def save_entry(self):
        self.client.put(
            "/api/v1/me/apps/grist-connector/entries",
            headers=self.headers,
            json={
                "values": {"api_token": "sk-load-test-key", "server_url": "https://grist.example.com"},
                "enabled": True,
            },
        )

    @task(1)
    def list_all_entries(self):
        self.client.get("/api/v1/me/entries", headers=self.headers)

    @task(1)
    def health_check(self):
        self.client.get("/health/live")


class AdminUser(HttpUser):
    """Simulates an admin managing applications."""

    wait_time = between(2, 5)
    headers = {"Authorization": "Bearer dev-token"}
    weight = 1  # Less frequent than vault users

    @task(3)
    def list_apps(self):
        self.client.get("/api/v1/admin/apps", headers=self.headers)

    @task(1)
    def list_users(self):
        self.client.get("/api/v1/admin/users", headers=self.headers)

    @task(1)
    def export_keycloak(self):
        self.client.get("/api/v1/admin/apps/export", headers=self.headers)
