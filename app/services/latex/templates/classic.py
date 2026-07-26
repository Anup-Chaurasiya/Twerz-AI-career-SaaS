"""Classic single-column ATS-friendly resume template."""

from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex import sections as s


CLASSIC_PREAMBLE = r"""
\documentclass{resume}
\usepackage[left=0.4in,top=0.3in,right=0.4in,bottom=0.3in]{geometry}
\usepackage{tabularx}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\input{glyphtounicode}
\pdfgentounicode=1

"""


def build_classic(resume_info: CustomResumeInfo) -> str:
    """Build classic single-column LaTeX resume."""
    latex = CLASSIC_PREAMBLE
    latex = s.add_classic_header(latex, resume_info)
    latex += r"""\begin{document}"""
    latex = s.add_summary_classic(latex, resume_info)
    latex = s.add_experience_classic(latex, resume_info)
    latex = s.add_projects_classic(latex, resume_info)
    latex = s.add_skills_classic(latex, resume_info)
    latex = s.add_education_classic(latex, resume_info)
    latex = s.add_achievements_classic(latex, resume_info)
    latex = s.add_certifications_classic(latex, resume_info)
    latex = s.add_patents_classic(latex, resume_info)
    latex = s.add_publications_classic(latex, resume_info)
    latex += r"""\end{document}"""
    return latex
