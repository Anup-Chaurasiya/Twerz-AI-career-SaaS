"""Unit tests for PDF preservation (mocked PyMuPDF)."""

import sys
from unittest.mock import MagicMock

from app.services.latex.pdf_preserver import preserve_pdf_format


def test_preserve_pdf_no_spans_fallback():
    result, status = preserve_pdf_format(b"%PDF-1.4", {"spans": []}, {"name": "A"})
    assert result is None
    assert status == "fallback"


def test_preserve_pdf_multi_column_fallback():
    index = {
        "spans": [{"field": "name", "page": 0, "bbox": [0, 0, 100, 20], "text": "Jane Doe"}],
        "columns": 2,
    }
    result, status = preserve_pdf_format(b"%PDF-1.4", index, {"name": "John Smith"})
    assert result is None
    assert status == "fallback"


def test_preserve_pdf_success_mocked():
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_page.insert_textbox.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    mock_doc.__len__.return_value = 1

    def fake_save(buf):
        buf.write(b"%PDF-mock")

    mock_doc.save.side_effect = fake_save

    mock_fitz = MagicMock()
    mock_fitz.open.return_value = mock_doc
    mock_fitz.Rect = MagicMock(return_value="rect")

    index = {
        "columns": 1,
        "spans": [
            {
                "field": "name",
                "page": 0,
                "bbox": [72, 72, 200, 90],
                "text": "Jane Doe",
                "size": 12,
                "font": "helv",
            }
        ],
    }

    saved = sys.modules.get("fitz")
    sys.modules["fitz"] = mock_fitz
    try:
        result, status = preserve_pdf_format(b"%PDF-1.4 fake", index, {"name": "John Smith"})
    finally:
        if saved is None:
            sys.modules.pop("fitz", None)
        else:
            sys.modules["fitz"] = saved

    assert status == "preserved"
    assert result == b"%PDF-mock"
