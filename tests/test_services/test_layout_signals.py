"""Unit tests for PDF layout signal extraction and template suggestion."""

from app.services.ocr.layout_signals import suggest_template_id


def test_suggest_template_single_column():
    assert suggest_template_id({"columns": 1, "font_category": "sans"}) == "classic"


def test_suggest_template_two_column():
    assert suggest_template_id({"columns": 2, "font_category": "serif"}) == "modern_two_col"


def test_suggest_template_none():
    assert suggest_template_id(None) == "classic"


def test_suggest_compact_for_short_profile():
    assert suggest_template_id({"columns": 1}, original_page_count=1) == "compact_one_page"


def test_suggest_classic_for_multi_page():
    assert suggest_template_id({"columns": 1}, original_page_count=2) == "classic"
