"""Best-effort PDF layout preservation via PyMuPDF redact-and-replace."""

from __future__ import annotations

from io import BytesIO
from logging import getLogger

from app.services.ocr.pdf_span_index import get_tailored_value

logger = getLogger(__name__)

OVERFLOW_LENGTH_RATIO = 1.4
MIN_SUCCESS_RATIO = 0.70


def preserve_pdf_format(
    pdf_bytes: bytes,
    pdf_field_index: dict,
    tailored_resume: dict,
) -> tuple[bytes | None, str]:
    """Replace mapped PDF spans with tailored text, preserving layout when possible."""
    try:
        import fitz
    except ImportError:
        logger.warning("PyMuPDF not installed — PDF preservation unavailable")
        return None, "fallback"

    spans = pdf_field_index.get("spans") or []
    if not spans:
        return None, "fallback"

    if pdf_field_index.get("columns", 1) == 2:
        # Multi-column in-place edit is fragile — prefer house modern_two_col
        logger.info("PDF preservation skipped — multi-column layout detected")
        return None, "fallback"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.warning("Failed to open PDF for preservation: %s", exc)
        return None, "fallback"

    total = 0
    succeeded = 0
    failed = 0

    try:
        for entry in spans:
            field = entry.get("field")
            page_num = entry.get("page", 0)
            bbox = entry.get("bbox")
            old_text = entry.get("text") or ""
            if not field or not bbox:
                continue

            new_text = get_tailored_value(field, tailored_resume)
            if not new_text or _normalize(old_text) == _normalize(new_text):
                continue

            if len(new_text) > len(old_text) * OVERFLOW_LENGTH_RATIO:
                failed += 1
                continue

            total += 1
            page = doc[page_num]
            rect = fitz.Rect(bbox)
            page.add_redact_annot(rect)
            page.apply_redactions()

            fontsize = float(entry.get("size") or 10)
            fontname = entry.get("font") or "helv"
            try:
                rc = page.insert_textbox(
                    rect,
                    new_text,
                    fontsize=fontsize,
                    fontname=fontname,
                    align=fitz.TEXT_ALIGN_LEFT,
                )
                if rc < 0:
                    failed += 1
                else:
                    succeeded += 1
            except Exception:
                failed += 1
    finally:
        pass

    if total == 0:
        doc.close()
        return None, "fallback"

    success_ratio = succeeded / total if total else 0
    if success_ratio < MIN_SUCCESS_RATIO or failed > total * 0.2:
        doc.close()
        logger.info(
            "PDF preservation fallback: %s/%s spans succeeded (ratio=%.2f)",
            succeeded,
            total,
            success_ratio,
        )
        return None, "fallback"

    out = BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue(), "preserved"


def _normalize(text: str) -> str:
    import re

    return re.sub(r"\s+", " ", (text or "").strip().lower())
