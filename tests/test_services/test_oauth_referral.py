"""OAuth state + referral helper tests."""

from __future__ import annotations

import pytest

from app.services.auth import google_oauth


def test_encode_decode_oauth_state_with_ref():
    csrf = google_oauth.new_oauth_csrf_token()
    state = google_oauth.encode_oauth_state(ref="refcode1", csrf=csrf)
    decoded = google_oauth.decode_oauth_state(state)
    assert decoded["ref"] == "refcode1"
    assert decoded["csrf"] == csrf


def test_decode_oauth_state_invalid_returns_empty():
    assert google_oauth.decode_oauth_state("not-valid") == {}


def test_encode_oauth_state_strips_ref():
    state = google_oauth.encode_oauth_state(ref="  abc  ")
    decoded = google_oauth.decode_oauth_state(state)
    assert decoded["ref"] == "abc"
