"""Preserve original DOCX formatting by replacing matched text runs in place."""

from __future__ import annotations

import re
from io import BytesIO
from logging import getLogger

from app.services.latex.docx_field_index import build_docx_field_index
from app.services.ocr.pdf_span_index import get_tailored_value

logger = getLogger(__name__)

OVERFLOW_LENGTH_RATIO = 1.4
MAX_OVERFLOW_RATIO = 0.20


def preserve_docx_format(
    docx_bytes: bytes,
    original_resume: dict,
    tailored_resume: dict,
    docx_field_index: dict | None = None,
) -> tuple[bytes | None, str]:
    """Attempt in-place DOCX text replacement preserving run formatting.

    Returns (docx_bytes, status) where status is 'preserved' or 'fallback'.
    """
    try:
        from docx import Document
    except ImportError:
        logger.warning("python-docx not installed — DOCX preservation unavailable")
        return None, "fallback"

    index = docx_field_index or build_docx_field_index(docx_bytes, original_resume)
    if not index:
        return None, "fallback"

    if index.get("has_tables") or index.get("has_textboxes"):
        logger.info("DOCX preservation fallback — tables or textboxes detected")
        return None, "fallback"

    runs = index.get("runs") or []
    if not runs:
        return None, "fallback"

    try:
        doc = Document(BytesIO(docx_bytes))
    except Exception as exc:
        logger.warning("Failed to open DOCX for preservation: %s", exc)
        return None, "fallback"

    replaced = 0
    overflow_runs = 0
    skipped_same = 0

    for entry in runs:
        field = entry.get("field")
        para_idx = entry.get("paragraph_idx")
        run_idx = entry.get("run_idx")
        old_text = entry.get("text") or ""
        if field is None or para_idx is None or run_idx is None:
            continue

        new_text = get_tailored_value(field, tailored_resume)
        if not new_text:
            continue

        if _normalize(old_text) == _normalize(new_text):
            skipped_same += 1
            continue

        if len(new_text) > len(old_text) * OVERFLOW_LENGTH_RATIO:
            overflow_runs += 1
            continue

        try:
            para = doc.paragraphs[para_idx]
            run = para.runs[run_idx]
        except IndexError:
            continue

        run.text = new_text
        replaced += 1

    attempted = replaced + overflow_runs
    if replaced == 0 or (attempted and overflow_runs / attempted > MAX_OVERFLOW_RATIO):
        logger.info(
            "DOCX preservation fallback: replaced=%s overflow=%s/%s",
            replaced,
            overflow_runs,
            attempted,
        )
        return None, "fallback"

    out = BytesIO()
    doc.save(out)
    return out.getvalue(), "preserved"


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())
