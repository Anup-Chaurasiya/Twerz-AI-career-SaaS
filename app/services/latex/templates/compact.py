"""Compact single-page dense resume template."""

from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex import sections as s


COMPACT_PREAMBLE = r"""
\documentclass{compact}
\usepackage[left=0.35in,top=0.35in,right=0.35in,bottom=0.35in]{geometry}
\usepackage{tabularx}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\input{glyphtounicode}
\pdfgentounicode=1
\setlength{\parskip}{0.25em}

"""


def build_compact_one_page(resume_info: CustomResumeInfo) -> str:
    """Build compact one-page LaTeX resume with tighter spacing."""
    latex = COMPACT_PREAMBLE
    latex = s.add_classic_header(latex, resume_info)
    latex += r"""\begin{document}"""
    latex = s.add_summary_classic(latex, resume_info)
    latex = s.add_experience_classic(latex, resume_info)
    latex = s.add_projects_classic(latex, resume_info)
    latex = s.add_skills_classic(latex, resume_info)
    latex = s.add_education_classic(latex, resume_info)
    latex = s.add_achievements_classic(latex, resume_info)
    latex = s.add_certifications_classic(latex, resume_info)
    latex += r"""\end{document}"""
    return latex
