"""Resume template registry."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex.templates.classic import build_classic
from app.services.latex.templates.compact import build_compact_one_page
from app.services.latex.templates.modern import build_modern_two_col

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
LATEX_DIR = REPO_ROOT / "templates" / "latex"

DEFAULT_TEMPLATE_ID = "classic"

ATS_TRADEOFF_WARNING = (
    "Multi-column layouts may score lower on ATS parseability — better suited when "
    "you know a human will read it first (referrals, direct outreach) than for blind "
    "ATS-scanned applications."
)


@dataclass(frozen=True)
class TemplateSpec:
    id: str
    label: str
    description: str
    ats_tier: str  # recommended | tradeoff
    ats_warning: str | None
    document_class: str
    cls_filename: str
    preview_url: str
    builder: Callable[[CustomResumeInfo], str]


TEMPLATE_REGISTRY: dict[str, TemplateSpec] = {
    "classic": TemplateSpec(
        id="classic",
        label="Classic ATS",
        description="Single-column layout optimized for maximum ATS parseability.",
        ats_tier="recommended",
        ats_warning=None,
        document_class="resume",
        cls_filename="resume.cls",
        preview_url="/template-previews/classic.svg",
        builder=build_classic,
    ),
    "modern_two_col": TemplateSpec(
        id="modern_two_col",
        label="Modern Two-Column",
        description="Distinct two-column layout — best when a human reads first.",
        ats_tier="tradeoff",
        ats_warning=ATS_TRADEOFF_WARNING,
        document_class="modern",
        cls_filename="modern.cls",
        preview_url="/template-previews/modern_two_col.svg",
        builder=build_modern_two_col,
    ),
    "compact_one_page": TemplateSpec(
        id="compact_one_page",
        label="Compact One-Page",
        description="Dense single-page layout — fits more on one sheet.",
        ats_tier="recommended",
        ats_warning=None,
        document_class="compact",
        cls_filename="compact.cls",
        preview_url="/template-previews/compact_one_page.svg",
        builder=build_compact_one_page,
    ),
}


def get_template_spec(template_id: str | None) -> TemplateSpec:
    tid = template_id or DEFAULT_TEMPLATE_ID
    if tid not in TEMPLATE_REGISTRY:
        raise ValueError(f"Unknown template_id: {tid}")
    return TEMPLATE_REGISTRY[tid]


def list_template_specs() -> list[TemplateSpec]:
    return list(TEMPLATE_REGISTRY.values())


def cls_path_for(template_id: str | None) -> Path:
    spec = get_template_spec(template_id)
    path = LATEX_DIR / spec.cls_filename
    if not path.exists():
        raise FileNotFoundError(f"LaTeX class file not found: {path}")
    return path
