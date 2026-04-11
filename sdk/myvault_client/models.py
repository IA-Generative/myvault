"""Data models for the MyVault SDK."""

from dataclasses import dataclass, field


@dataclass
class VariableSpec:
    """Definition of a variable required by an application."""
    key: str
    label: str
    type: str = "text"
    required: bool = True
    description: str = ""
    default: str = ""


@dataclass
class AppConfig:
    """Configuration for auto-enrolling an application in MyVault."""
    client_id: str
    client_secret: str
    name: str = ""
    variables: list[VariableSpec] = field(default_factory=list)
    check_connection_endpoint: str = ""

    def to_enroll_payload(self) -> dict:
        return {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "name": self.name or self.client_id,
            "variables": [
                {
                    "key": v.key,
                    "label": v.label,
                    "var_type": v.type,
                    "required": v.required,
                    "description": v.description,
                    "default_value": v.default,
                }
                for v in self.variables
            ],
            "check_connection_endpoint": self.check_connection_endpoint,
        }


@dataclass
class Credentials:
    """Decrypted credentials returned by MyVault."""
    values: dict[str, str]

    def __getitem__(self, key: str) -> str:
        return self.values[key]

    def get(self, key: str, default: str = "") -> str:
        return self.values.get(key, default)
