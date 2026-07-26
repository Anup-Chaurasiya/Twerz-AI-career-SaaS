"""Public API for listing resume templates."""

from fastapi import APIRouter

from app.services.latex.templates import list_template_specs

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/resume")
async def list_resume_templates():
    """List available resume templates for the template picker."""
    return [
        {
            "id": spec.id,
            "label": spec.label,
            "description": spec.description,
            "ats_tier": spec.ats_tier,
            "ats_warning": spec.ats_warning,
            "preview_url": spec.preview_url,
        }
        for spec in list_template_specs()
    ]
