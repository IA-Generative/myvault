"""Unit tests for bridge service format parsing and alias mapping."""

from app.services.bridge_service import (
    _format_env,
    _format_yaml,
    _parse_env,
    _parse_yaml,
    _apply_aliases_for_export,
    _apply_aliases_for_import,
)


class TestFormatEnv:
    def test_basic(self):
        result = _format_env({"api_key": "sk-123", "url": "https://api.com"})
        assert 'API_KEY="sk-123"' in result
        assert 'URL="https://api.com"' in result

    def test_escapes_quotes(self):
        result = _format_env({"val": 'say "hello"'})
        assert r'say \"hello\"' in result


class TestFormatYaml:
    def test_basic(self):
        result = _format_yaml({"api_key": "sk-123"})
        assert 'api_key: "sk-123"' in result


class TestParseEnv:
    def test_basic(self):
        data = 'API_KEY="sk-123"\nSERVER_URL=https://api.com'
        result = _parse_env(data)
        assert result["API_KEY"] == "sk-123"
        assert result["SERVER_URL"] == "https://api.com"

    def test_ignores_comments(self):
        data = "# comment\nKEY=val"
        result = _parse_env(data)
        assert "KEY" in result
        assert len(result) == 1

    def test_ignores_empty_lines(self):
        data = "\n\nKEY=val\n\n"
        result = _parse_env(data)
        assert result == {"KEY": "val"}

    def test_single_quotes(self):
        data = "KEY='value'"
        result = _parse_env(data)
        assert result["KEY"] == "value"


class TestParseYaml:
    def test_basic(self):
        data = 'api_key: "sk-123"\nurl: https://api.com'
        result = _parse_yaml(data)
        assert result["api_key"] == "sk-123"
        assert result["url"] == "https://api.com"


class TestAliases:
    def test_export_with_aliases(self):
        values = {"api_token": "sk-123", "url": "https://api.com"}
        aliases = {"api_token": ["GRIST_API_KEY", "API_KEY"]}
        result = _apply_aliases_for_export(values, aliases)
        assert "GRIST_API_KEY" in result
        assert result["GRIST_API_KEY"] == "sk-123"
        assert "url" in result

    def test_export_without_aliases(self):
        values = {"key": "val"}
        result = _apply_aliases_for_export(values, None)
        assert result == values

    def test_import_with_aliases(self):
        class FakeVar:
            def __init__(self, key):
                self.key = key

        parsed = {"GRIST_API_KEY": "sk-123", "url": "https://api.com"}
        aliases = {"api_token": ["GRIST_API_KEY", "API_KEY"]}
        variables = [FakeVar("api_token"), FakeVar("url")]

        result = _apply_aliases_for_import(parsed, aliases, variables)
        assert result["api_token"] == "sk-123"
        assert result["url"] == "https://api.com"

    def test_import_direct_match(self):
        class FakeVar:
            def __init__(self, key):
                self.key = key

        parsed = {"api_token": "sk-123"}
        result = _apply_aliases_for_import(parsed, None, [FakeVar("api_token")])
        assert result["api_token"] == "sk-123"
