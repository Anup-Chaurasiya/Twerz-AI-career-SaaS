"""Phase 1 Trust & Verification Hardening — unit tests.

Tests:
1. pdf_verified_readable flag is set correctly via _verify_pdf_readable_sync
2. Score clamping: fit_score and ats scores must be in [0, 100]
3. Near-ceiling ATS invariant: score ≥90 unchanged is acceptable
4. Verify helper returns True for valid PDF with matching name/email
5. Verify helper returns False when name not found in extracted text
6. Verify helper returns False on pdfplumber exception
"""

from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

import pytest

from tests.test_services.golden_invariants import (
    assert_ats_moved_or_structure_improved,
    assert_scores_in_range,
)


# ---------------------------------------------------------------------------
# 1. Score range invariants
# ---------------------------------------------------------------------------

def test_scores_in_range_valid():
    assert_scores_in_range({"fit_score": 75, "ats_score_before": 40, "ats_score_after": 65})


def test_scores_in_range_zero():
    assert_scores_in_range({"fit_score": 0, "ats_score_before": 0, "ats_score_after": 0})


def test_scores_in_range_max():
    assert_scores_in_range({"fit_score": 100, "ats_score_before": 100, "ats_score_after": 100})


def test_scores_in_range_missing_fit_score_raises():
    with pytest.raises(AssertionError, match="fit_score must be present"):
        assert_scores_in_range({"fit_score": None, "ats_score_before": 50})


def test_scores_out_of_range_raises():
    with pytest.raises(AssertionError):
        assert_scores_in_range({"fit_score": 101, "ats_score_before": 50, "ats_score_after": 50})


# ---------------------------------------------------------------------------
# 2. Near-ceiling ATS invariant
# ---------------------------------------------------------------------------

def test_ats_near_ceiling_unchanged_passes():
    """ATS at 92 unchanged → should not raise (near-ceiling plateau acceptable)."""
    assert_ats_moved_or_structure_improved(92, 92)


def test_ats_near_ceiling_exact_threshold_passes():
    assert_ats_moved_or_structure_improved(90, 90)


def test_ats_below_ceiling_unchanged_with_structure_improvement_passes():
    assert_ats_moved_or_structure_improved(70, 70, structure_before=55, structure_after=70)


def test_ats_below_ceiling_unchanged_no_structure_raises():
    with pytest.raises(AssertionError):
        assert_ats_moved_or_structure_improved(70, 70)


def test_ats_moved_always_passes():
    assert_ats_moved_or_structure_improved(60, 75)
    assert_ats_moved_or_structure_improved(90, 91)
    assert_ats_moved_or_structure_improved(40, 30)  # even downward movement satisfies the check


def test_ats_near_ceiling_custom_threshold():
    """Custom threshold at 95 — 92 unchanged should raise."""
    with pytest.raises(AssertionError):
        assert_ats_moved_or_structure_improved(92, 92, near_ceiling_threshold=95)


# ---------------------------------------------------------------------------
# 3. _verify_pdf_readable_sync unit tests (no real pdfplumber needed)
# ---------------------------------------------------------------------------

from app.services.job.service import _verify_pdf_readable_sync


def _make_mock_pdf(extracted_text: str):
    """Return a mock pdfplumber context manager that returns one page of extracted_text."""
    mock_page = MagicMock()
    mock_page.extract_text.return_value = extracted_text

    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page]

    mock_ctx = MagicMock()
    mock_ctx.__enter__ = MagicMock(return_value=mock_pdf)
    mock_ctx.__exit__ = MagicMock(return_value=False)
    return mock_ctx


def test_verify_readable_passes_when_name_and_email_present():
    resume = {"name": "Jane Doe", "email": "jane@example.com"}
    text = "Jane Doe\njane@example.com\nSoftware Engineer"
    with patch("pdfplumber.open", return_value=_make_mock_pdf(text)):
        assert _verify_pdf_readable_sync(b"%PDF-fake", resume) is True


def test_verify_readable_fails_when_name_missing():
    resume = {"name": "Jane Doe", "email": "jane@example.com"}
    text = "Some random text without the name\njane@example.com"
    with patch("pdfplumber.open", return_value=_make_mock_pdf(text)):
        assert _verify_pdf_readable_sync(b"%PDF-fake", resume) is False


def test_verify_readable_fails_when_email_missing():
    resume = {"name": "Jane Doe", "email": "jane@example.com"}
    text = "jane doe is here but no email in this doc"
    with patch("pdfplumber.open", return_value=_make_mock_pdf(text)):
        assert _verify_pdf_readable_sync(b"%PDF-fake", resume) is False


def test_verify_readable_fails_when_no_text_extracted():
    mock_page = MagicMock()
    mock_page.extract_text.return_value = None
    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page]
    mock_ctx = MagicMock()
    mock_ctx.__enter__ = MagicMock(return_value=mock_pdf)
    mock_ctx.__exit__ = MagicMock(return_value=False)
    with patch("pdfplumber.open", return_value=mock_ctx):
        assert _verify_pdf_readable_sync(b"%PDF-fake", None) is False


def test_verify_readable_fails_on_exception():
    """If pdfplumber itself raises, verification must fail closed."""
    with patch("pdfplumber.open", side_effect=RuntimeError("pdfplumber broken")):
        result = _verify_pdf_readable_sync(b"%PDF-fake", {"name": "Test"})
    assert result is False


def test_verify_readable_no_resume_data_only_checks_text():
    """With no resume dict, only checks that some text was extracted."""
    text = "Some content here"
    with patch("pdfplumber.open", return_value=_make_mock_pdf(text)):
        assert _verify_pdf_readable_sync(b"%PDF-fake", None) is True


def test_verify_readable_case_insensitive():
    """Name matching should be case-insensitive."""
    resume = {"name": "JANE DOE", "email": "JANE@EXAMPLE.COM"}
    text = "jane doe\njane@example.com\nEngineer"
    with patch("pdfplumber.open", return_value=_make_mock_pdf(text)):
        assert _verify_pdf_readable_sync(b"%PDF-fake", resume) is True
