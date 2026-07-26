"""Modern two-column resume template (human-first layout)."""

from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex import sections as s


MODERN_PREAMBLE = r"""
\documentclass{modern}
\usepackage[left=0.45in,top=0.4in,right=0.45in,bottom=0.4in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{xcolor}
\definecolor{teal}{RGB}{0,128,128}
\input{glyphtounicode}
\pdfgentounicode=1

"""


def _modern_header(resume_info: CustomResumeInfo) -> str:
    header = f"{{\\namesize\\bfseries {resume_info.name}}}\\\\[4pt]\n"
    if resume_info.headline:
        header += f"{{\\textit{{{s.fmt(resume_info.headline)}}}}}\\\\[4pt]\n"

    contact_parts = []
    for info in [resume_info.mobile_number, resume_info.email]:
        if info:
            contact_parts.append(str(info))
    if resume_info.links:
        for link in resume_info.links:
            contact_parts.append(f"\\href{{{link.url}}}{{{link.name}}}")
    if contact_parts:
        header += "{\\small " + " $\\cdot$ ".join(contact_parts) + "}\\\\[6pt]\n"
    return header


def build_modern_two_col(resume_info: CustomResumeInfo) -> str:
    """Build modern two-column LaTeX resume."""
    latex = MODERN_PREAMBLE
    latex += r"""\begin{document}"""
    latex += _modern_header(resume_info)

    latex += r"""\noindent\begin{minipage}[t]{0.30\textwidth}"""
    latex = s.add_skills_sidebar(latex, resume_info)
    latex = s.add_education_sidebar(latex, resume_info)
    latex += r"""\end{minipage}\hfill"""
    latex += r"""\begin{minipage}[t]{0.67\textwidth}"""
    latex = s.add_summary_modern(latex, resume_info)
    latex = s.add_experience_modern(latex, resume_info)
    latex = s.add_projects_modern(latex, resume_info)
    latex = s.add_achievements_modern(latex, resume_info)
    latex = s.add_certifications_modern(latex, resume_info)
    latex += r"""\end{minipage}"""
    latex += r"""\end{document}"""
    return latex
