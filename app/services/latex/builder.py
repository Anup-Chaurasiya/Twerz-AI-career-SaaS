from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex.templates import DEFAULT_TEMPLATE_ID, get_template_spec


def build_resume(resume_info: CustomResumeInfo, template_id: str = DEFAULT_TEMPLATE_ID) -> str:
    """Build a complete LaTeX resume from CustomResumeInfo. Data must already be sanitized."""
    spec = get_template_spec(template_id)
    return spec.builder(resume_info)
