"""Tests for TOTP code derivation from a stored seed."""

import pyotp
import pytest

from app.core.totp import current_code, _normalize_seed


def test_current_code_matches_pyotp():
    seed = pyotp.random_base32()
    assert current_code(seed) == pyotp.TOTP(seed).now()


def test_normalize_strips_spaces_and_uppercases():
    assert _normalize_seed("jbsw y3dp ehpk 3pxp") == "JBSWY3DPEHPK3PXP"


def test_normalize_extracts_otpauth_uri():
    uri = "otpauth://totp/Resana:alice?secret=JBSWY3DPEHPK3PXP&issuer=Resana"
    assert _normalize_seed(uri) == "JBSWY3DPEHPK3PXP"


def test_code_is_six_digits():
    code = current_code(pyotp.random_base32())
    assert len(code) == 6 and code.isdigit()


def test_invalid_seed_raises():
    with pytest.raises(Exception):
        current_code("not!base32!")
