"""Build field-path → DOCX run location index at profile upload time."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from io import BytesIO
from logging import getLogger
from typing import Any

logger = getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.85


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def iter_resume_field_strings(resume_info: dict) -> list[tuple[str, str]]:
    """Yield (field_path, value) pairs from structured ResumeInfo."""
    pairs: list[tuple[str, str]] = []

    def add(path: str, val: Any) -> None:
        if isinstance(val, str) and val.strip():
            pairs.append((path, val.strip()))

    add("name", resume_info.get("name"))
    add("headline", resume_info.get("headline"))
    add("summary", resume_info.get("summary"))
    add("email", resume_info.get("email"))
    add("mobile_number", resume_info.get("mobile_number"))

    for i, exp in enumerate(resume_info.get("past_experience") or []):
        add(f"past_experience.{i}.company_name", exp.get("company_name"))
        add(f"past_experience.{i}.role", exp.get("role"))
        for j, bullet in enumerate(exp.get("description") or []):
            add(f"past_experience.{i}.description.{j}", bullet)

    for i, proj in enumerate(resume_info.get("projects") or []):
        add(f"projects.{i}.name", proj.get("name"))
        for j, bullet in enumerate(proj.get("description") or []):
            add(f"projects.{i}.description.{j}", bullet)

    for i, edu in enumerate(resume_info.get("educations") or []):
        add(f"educations.{i}.institution", edu.get("institution"))
        add(f"educations.{i}.degree", edu.get("degree"))

    skills = resume_info.get("skills") or {}
    if isinstance(skills, dict):
        for key in ("languages", "frameworks", "databases", "domain_relevant", "other_technologies"):
            for j, item in enumerate(skills.get(key) or []):
                add(f"skills.{key}.{j}", item)

    for i, ach in enumerate(resume_info.get("achievements") or []):
        add(f"achievements.{i}", ach)

    return pairs


def _best_field_match(run_text: str, fields: list[tuple[str, str]]) -> tuple[str, str, float] | None:
    norm_run = _normalize(run_text)
    if len(norm_run) < 4:
        return None
    best: tuple[str, str, float] | None = None
    for path, value in fields:
        score = SequenceMatcher(None, norm_run, _normalize(value)).ratio()
        if score >= CONFIDENCE_THRESHOLD and (best is None or score > best[2]):
            best = (path, value, score)
    return best


def build_docx_field_index(docx_bytes: bytes, resume_info: dict) -> dict | None:
    """Map ResumeInfo field paths to DOCX paragraph/run locations."""
    try:
        from docx import Document
    except ImportError:
        logger.warning("python-docx not installed — cannot build DOCX field index")
        return None

    try:
        doc = Document(BytesIO(docx_bytes))
    except Exception as exc:
        logger.warning("Failed to open DOCX for field indexing: %s", exc)
        return None

    fields = iter_resume_field_strings(resume_info)
    if not fields:
        return None

    runs_index: list[dict] = []
    used_fields: set[str] = set()

    for para_idx, para in enumerate(doc.paragraphs):
        for run_idx, run in enumerate(para.runs):
            text = run.text
            if not text or not text.strip():
                continue
            match = _best_field_match(text, fields)
            if match:
                path, _, score = match
                runs_index.append(
                    {
                        "field": path,
                        "paragraph_idx": para_idx,
                        "run_idx": run_idx,
                        "text": text,
                        "score": round(score, 3),
                    }
                )
                used_fields.add(path)

    has_tables = False
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    has_tables = True
                    break
            if has_tables:
                break

    # python-docx has limited textbox support — flag if inline shapes exist
    has_textboxes = bool(getattr(doc.element.body, "txbxContent_lst", None))

    return {
        "runs": runs_index,
        "has_tables": has_tables,
        "has_textboxes": has_textboxes,
        "mapped_fields": len(used_fields),
        "total_fields": len(fields),
    }
