"""Extract coarse layout signals from PDF uploads for template auto-suggestion."""

from __future__ import annotations

import re
from io import BytesIO
from logging import getLogger

logger = getLogger(__name__)

SERIF_HINTS = ("times", "palatino", "georgia", "garamond", "cambria", "serif")
SANS_HINTS = ("arial", "helvetica", "calibri", "verdana", "roboto", "lato", "sans")


def extract_pdf_layout_signals(pdf_bytes: bytes) -> dict | None:
    """Return coarse layout signals from a PDF, or None if extraction fails."""
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber unavailable for layout signal extraction")
        return None

    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            if not pdf.pages:
                return None
            page = pdf.pages[0]
            words = page.extract_words() or []
            if len(words) < 8:
                return None

            page_width = float(page.width or 612)
            mid_x = page_width / 2

            left_count = sum(1 for w in words if float(w.get("x0", 0)) < mid_x * 0.85)
            right_count = sum(1 for w in words if float(w.get("x0", 0)) > mid_x * 1.05)
            columns = 2 if left_count >= 5 and right_count >= 5 else 1

            font_names = " ".join(str(w.get("fontname", "")).lower() for w in words[:40])
            font_category = "unknown"
            if any(h in font_names for h in SERIF_HINTS):
                font_category = "serif"
            elif any(h in font_names for h in SANS_HINTS):
                font_category = "sans"

            return {"columns": columns, "font_category": font_category}
    except Exception as exc:
        logger.warning("Layout signal extraction failed: %s", exc)
        return None


def suggest_template_id(
    layout_signals: dict | None,
    *,
    original_page_count: int | None = None,
) -> str:
    """Map layout signals to a house template id."""
    if not layout_signals:
        if original_page_count is not None and original_page_count <= 1:
            return "compact_one_page"
        return "classic"
    if layout_signals.get("columns") == 2:
        return "modern_two_col"
    if original_page_count is not None and original_page_count <= 1:
        return "compact_one_page"
    return "classic"
