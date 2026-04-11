"""Bridge service: export/import credentials in multiple formats (JSON, .env, YAML)."""

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.vault_service import get_user_entry
from app.services.app_service import get_app_by_slug


async def export_bridge(
    db: AsyncSession, user_id: str, app_slug: str, fmt: str = "json"
) -> dict[str, Any] | None:
    """Export user's credentials for an app in the requested format."""
    entry = await get_user_entry(db, user_id, app_slug)
    if entry is None:
        return None

    values = entry["values"]
    app = await get_app_by_slug(db, app_slug)
    if app is None:
        return None

    # Apply variable aliases for export
    aliased_values = _apply_aliases_for_export(values, app.variable_aliases)

    if fmt == "env":
        data = _format_env(aliased_values)
    elif fmt == "yaml":
        data = _format_yaml(aliased_values)
    else:
        data = json.dumps(aliased_values, indent=2, ensure_ascii=False)

    return {
        "app_name": entry["app_name"],
        "app_slug": entry["app_slug"],
        "format": fmt,
        "data": data,
        "variables": values,
    }


async def import_bridge(
    db: AsyncSession, user_id: str, app_slug: str, fmt: str, raw_data: str
) -> dict[str, str]:
    """Parse imported data and return mapped variable values."""
    app = await get_app_by_slug(db, app_slug)
    if app is None:
        raise ValueError(f"Application '{app_slug}' not found")

    if fmt == "env":
        parsed = _parse_env(raw_data)
    elif fmt == "yaml":
        parsed = _parse_yaml(raw_data)
    else:
        parsed = json.loads(raw_data)

    # Reverse-map aliases to internal keys
    mapped = _apply_aliases_for_import(parsed, app.variable_aliases, app.required_variables)
    return mapped


def _format_env(values: dict[str, str]) -> str:
    lines = []
    for key, value in values.items():
        escaped = value.replace('"', '\\"')
        lines.append(f'{key.upper()}="{escaped}"')
    return "\n".join(lines)


def _format_yaml(values: dict[str, str]) -> str:
    lines = []
    for key, value in values.items():
        lines.append(f"{key}: \"{value}\"")
    return "\n".join(lines)


def _parse_env(data: str) -> dict[str, str]:
    result = {}
    for line in data.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        result[key] = value
    return result


def _parse_yaml(data: str) -> dict[str, str]:
    result = {}
    for line in data.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def _apply_aliases_for_export(
    values: dict[str, str],
    aliases: dict[str, list[str]] | None,
) -> dict[str, str]:
    """When exporting, use the first alias as the key name if defined."""
    if not aliases:
        return values
    result = {}
    for key, value in values.items():
        if key in aliases and aliases[key]:
            result[aliases[key][0]] = value
        else:
            result[key] = value
    return result


def _apply_aliases_for_import(
    parsed: dict[str, str],
    aliases: dict[str, list[str]] | None,
    required_variables: list,
) -> dict[str, str]:
    """Map imported keys back to internal variable keys using aliases."""
    valid_keys = {v.key for v in required_variables}
    mapped = {}

    # Build reverse alias map
    reverse_map: dict[str, str] = {}
    if aliases:
        for internal_key, alias_list in aliases.items():
            for alias in alias_list:
                reverse_map[alias.upper()] = internal_key

    for ext_key, value in parsed.items():
        # Direct match
        if ext_key in valid_keys:
            mapped[ext_key] = value
        # Case-insensitive match
        elif ext_key.lower() in valid_keys:
            mapped[ext_key.lower()] = value
        # Alias match
        elif ext_key.upper() in reverse_map:
            mapped[reverse_map[ext_key.upper()]] = value

    return mapped
