"""Build field-path → PDF span location index using PyMuPDF."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from io import BytesIO
from logging import getLogger
from typing import Any

from app.services.latex.docx_field_index import iter_resume_field_strings

logger = getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.85
MIN_SPAN_CHARS = 4


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _best_field_match(span_text: str, fields: list[tuple[str, str]]) -> tuple[str, str, float] | None:
    norm_span = _normalize(span_text)
    if len(norm_span) < MIN_SPAN_CHARS:
        return None
    best: tuple[str, str, float] | None = None
    for path, value in fields:
        score = SequenceMatcher(None, norm_span, _normalize(value)).ratio()
        if score >= CONFIDENCE_THRESHOLD and (best is None or score > best[2]):
            best = (path, value, score)
    return best


def build_pdf_field_index(pdf_bytes: bytes, resume_info: dict) -> dict | None:
    """Map ResumeInfo field paths to PDF text span locations."""
    try:
        import fitz
    except ImportError:
        logger.warning("PyMuPDF not installed — cannot build PDF field index")
        return None

    fields = iter_resume_field_strings(resume_info)
    if not fields:
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.warning("Failed to open PDF for span indexing: %s", exc)
        return None

    spans_index: list[dict] = []
    used_fields: set[str] = set()
    columns_detected = 1

    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_width = page.rect.width
            mid_x = page_width / 2
            text_dict = page.get_text("dict")
            left_spans = 0
            right_spans = 0

            for block in text_dict.get("blocks") or []:
                if block.get("type") != 0:
                    continue
                for line in block.get("lines") or []:
                    for span in line.get("spans") or []:
                        text = (span.get("text") or "").strip()
                        if len(text) < MIN_SPAN_CHARS:
                            continue
                        bbox = span.get("bbox")
                        if not bbox:
                            continue
                        x0 = float(bbox[0])
                        if x0 < mid_x * 0.85:
                            left_spans += 1
                        elif x0 > mid_x * 1.05:
                            right_spans += 1

                        match = _best_field_match(text, fields)
                        if match:
                            path, _, score = match
                            spans_index.append(
                                {
                                    "field": path,
                                    "page": page_num,
                                    "bbox": list(bbox),
                                    "text": text,
                                    "font": span.get("font"),
                                    "size": span.get("size"),
                                    "color": span.get("color"),
                                    "score": round(score, 3),
                                }
                            )
                            used_fields.add(path)

            if left_spans >= 3 and right_spans >= 3:
                columns_detected = 2
    finally:
        doc.close()

    return {
        "spans": spans_index,
        "columns": columns_detected,
        "mapped_fields": len(used_fields),
        "total_fields": len(fields),
    }


def get_tailored_value(field_path: str, tailored: dict) -> str | None:
    """Resolve a dotted field path against tailored resume JSON."""
    parts = field_path.split(".")
    cur: Any = tailored
    for part in parts:
        if isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    if isinstance(cur, str) and cur.strip():
        return cur.strip()
    return None
