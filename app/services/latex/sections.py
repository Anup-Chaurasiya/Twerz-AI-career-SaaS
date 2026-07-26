"""Shared LaTeX section builders for all resume templates."""

from app.schemas.custom_resume import CustomResumeInfo
from app.services.latex.sanitizer import convert_markdown_emphasis, strip_markdown_emphasis


def fmt(text: str) -> str:
    """Convert markdown emphasis to LaTeX commands, with fallback to stripping."""
    try:
        result = convert_markdown_emphasis(text)
        added_open = result.count("{") - text.count("{")
        added_close = result.count("}") - text.count("}")
        if added_open != added_close:
            return strip_markdown_emphasis(text)
        return result
    except Exception:
        return strip_markdown_emphasis(text)


def add_classic_header(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    resume = resume_latex
    resume += f"\n\\name{{{resume_info.name}}}  \n"

    if resume_info.headline:
        resume += f"\\address{{\\textit{{{fmt(resume_info.headline)}}}}}\n"

    address_section = ""
    contact_section = r"""\address{"""
    contact_info = [resume_info.mobile_number, resume_info.email, resume_info.date_of_birth]
    contact_info = [info for info in contact_info if info]

    if contact_info:
        contact_section += " \\\\ ".join(contact_info) + "}"
        address_section += contact_section

    links_info = resume_info.links
    if links_info:
        links_section = r"""\address{"""
        for link in links_info:
            links_section += f"\\href{{{link.url}}}{{{link.name}}} | "
        links_section = links_section[:-2] + "}"
        address_section += links_section

    resume += address_section + "\n"
    return resume


def add_summary_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.summary:
        return resume_latex
    section = r"""\begin{rSection}{Summary}"""
    section += f"\n{fmt(resume_info.summary)}\n"
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_experience_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.past_experience:
        return resume_latex
    section = r"""\begin{rSection}{Experience}"""
    for exp in resume_info.past_experience:
        date_range = f"{exp.start_date or ''} -- {exp.end_date or 'Present'}"
        section += f"\\begin{{rSubsection}}{{{exp.company_name}}}{{{date_range}}}{{{exp.role}}}{{}}\n"
        if exp.description:
            for point in exp.description:
                section += f"\\item {fmt(point)}\n"
        else:
            section += "\\item{}\n"
        section += "\\end{rSubsection}\n"
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_projects_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.projects:
        return resume_latex
    section = r"""\begin{rSection}{Projects}"""
    for project in resume_info.projects:
        link = project.link
        has_valid_link = link and link.startswith(("http://", "https://"))
        if has_valid_link:
            section += f"\\begin{{rSubsection}}{{\\href{{{link}}}{{{project.name}}}}}{{}}{{}}{{}}\\vspace{{-0.8em}}\n"
        else:
            section += f"\\begin{{rSubsection}}{{{project.name}}}{{}}{{}}{{}}\\vspace{{-0.8em}}\n"
        if project.description:
            for point in project.description:
                section += f"\\item {fmt(point)}\n"
        else:
            section += "\\item{}\n"
        section += "\\end{rSubsection}\n"
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_skills_tabular(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    skills = resume_info.skills
    has_skills = (
        skills.languages
        or skills.frameworks
        or skills.databases
        or skills.domain_relevant
        or skills.other_technologies
    )
    if not has_skills:
        return resume_latex

    section = r"""\begin{tabularx}{\textwidth}{@{}l X@{}}
"""
    if skills.languages:
        section += f"\\textbf{{Languages:}} & {', '.join(skills.languages)} \\\\"
    if skills.frameworks:
        section += f"\\textbf{{Frameworks:}} & {', '.join(skills.frameworks)} \\\\"
    if skills.databases:
        section += f"\\textbf{{Databases:}} & {', '.join(skills.databases)} \\\\"
    if skills.domain_relevant:
        label = (skills.domain_label or "Domain").replace(":", "")
        section += f"\\textbf{{{label}:}} & {', '.join(skills.domain_relevant)} \\\\"
    if skills.other_technologies:
        section += f"\\textbf{{Platforms/Other:}} & {', '.join(skills.other_technologies)} \\\\"

    section += r"""\end{tabularx}"""
    return resume_latex + section + "\n"


def add_skills_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    skills = resume_info.skills
    has_skills = (
        skills.languages
        or skills.frameworks
        or skills.databases
        or skills.domain_relevant
        or skills.other_technologies
    )
    if not has_skills:
        return resume_latex

    section = r"""\begin{rSection}{Skills}
"""
    section += add_skills_tabular("", resume_info)
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_education_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.educations:
        return resume_latex
    lines = [r"\begin{rSection}{Education}"]
    for edu in resume_info.educations:
        entry = f"{{\\bf {edu.institution or ''}}} \\hfill {edu.grade or ''} \\\\"
        entry += f"\\textit{{{edu.degree or ''}}}"
        if edu.start_date or edu.end_date:
            entry += f"\\hfill {edu.start_date or ''}"
            if edu.start_date and edu.end_date:
                entry += f" -- {edu.end_date}"
            elif edu.end_date:
                entry += f"{edu.end_date}"
        lines.append(entry)
        lines.append(r"\\[0.2cm]")
    lines.pop()
    lines.append(r"\end{rSection}")
    return resume_latex + "\n".join(lines) + "\n"


def add_certifications_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.certifications:
        return resume_latex
    section = r"""\begin{rSection}{Certifications}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for cert in resume_info.certifications:
        section += f"\\item {fmt(cert.name)}"
        if cert.credential_id:
            if cert.credential_id.startswith(("http://", "https://")):
                section += f" — \\href{{{cert.credential_id}}}{{Verify}}"
            else:
                section += f" — ID: {cert.credential_id}"
    section += r"""\end{itemize}"""
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_patents_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.patents:
        return resume_latex
    section = r"""\begin{rSection}{Patents}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for patent in resume_info.patents:
        section += f"\\item {fmt(patent.name)}"
        if patent.date:
            section += f" ({patent.date})"
        if patent.description:
            section += f": {fmt(patent.description)}"
    section += r"""\end{itemize}"""
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_publications_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.papers:
        return resume_latex
    section = r"""\begin{rSection}{Publications}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for paper in resume_info.papers:
        section += f"\\item {fmt(paper.name)}"
        if paper.date:
            section += f" ({paper.date})"
        if paper.description:
            section += f": {fmt(paper.description)}"
    section += r"""\end{itemize}"""
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_achievements_classic(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.achievements:
        return resume_latex
    section = r"""\begin{rSection}{Achievements}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for achievement in resume_info.achievements:
        section += f"\\item {fmt(achievement)}\n"
    section += r"""\end{itemize}"""
    section += r"""\end{rSection}"""
    return resume_latex + section + "\n"


def add_skills_sidebar(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    skills = resume_info.skills
    has_skills = (
        skills.languages
        or skills.frameworks
        or skills.databases
        or skills.domain_relevant
        or skills.other_technologies
    )
    if not has_skills:
        return resume_latex

    section = r"""\begin{mSidebarSection}{Skills}"""
    if skills.languages:
        section += f"\\textbf{{Languages}}\\\\ {', '.join(skills.languages)}\\\\[0.3em]\n"
    if skills.frameworks:
        section += f"\\textbf{{Frameworks}}\\\\ {', '.join(skills.frameworks)}\\\\[0.3em]\n"
    if skills.databases:
        section += f"\\textbf{{Databases}}\\\\ {', '.join(skills.databases)}\\\\[0.3em]\n"
    if skills.domain_relevant:
        label = (skills.domain_label or "Domain").replace(":", "")
        section += f"\\textbf{{{label}}}\\\\ {', '.join(skills.domain_relevant)}\\\\[0.3em]\n"
    if skills.other_technologies:
        section += f"\\textbf{{Other}}\\\\ {', '.join(skills.other_technologies)}\\\\[0.3em]\n"
    section += r"""\end{mSidebarSection}"""
    return resume_latex + section + "\n"


def add_education_sidebar(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.educations:
        return resume_latex
    section = r"""\begin{mSidebarSection}{Education}"""
    for edu in resume_info.educations:
        section += f"\\textbf{{{edu.institution or ''}}}\\\\\n"
        section += f"\\textit{{{edu.degree or ''}}}\\\\\n"
        if edu.start_date or edu.end_date:
            dates = f"{edu.start_date or ''}"
            if edu.start_date and edu.end_date:
                dates += f" -- {edu.end_date}"
            elif edu.end_date:
                dates = edu.end_date
            section += f"{dates}\\\\[0.3em]\n"
    section += r"""\end{mSidebarSection}"""
    return resume_latex + section + "\n"


def add_experience_modern(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.past_experience:
        return resume_latex
    section = r"""\begin{mMainSection}{Experience}"""
    for exp in resume_info.past_experience:
        date_range = f"{exp.start_date or ''} -- {exp.end_date or 'Present'}"
        section += f"\\begin{{mSubsection}}{{{exp.company_name}}}{{{date_range}}}{{{exp.role}}}{{}}\n"
        if exp.description:
            for point in exp.description:
                section += f"\\item {fmt(point)}\n"
        else:
            section += "\\item{}\n"
        section += "\\end{mSubsection}\n"
    section += r"""\end{mMainSection}"""
    return resume_latex + section + "\n"


def add_projects_modern(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.projects:
        return resume_latex
    section = r"""\begin{mMainSection}{Projects}"""
    for project in resume_info.projects:
        link = project.link
        has_valid_link = link and link.startswith(("http://", "https://"))
        name = f"\\href{{{link}}}{{{project.name}}}" if has_valid_link else project.name
        section += f"\\begin{{mSubsection}}{{{name}}}{{}}{{}}{{}}\n"
        if project.description:
            for point in project.description:
                section += f"\\item {fmt(point)}\n"
        else:
            section += "\\item{}\n"
        section += "\\end{mSubsection}\n"
    section += r"""\end{mMainSection}"""
    return resume_latex + section + "\n"


def add_summary_modern(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.summary:
        return resume_latex
    section = r"""\begin{mMainSection}{Summary}"""
    section += f"\n{fmt(resume_info.summary)}\n"
    section += r"""\end{mMainSection}"""
    return resume_latex + section + "\n"


def add_achievements_modern(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.achievements:
        return resume_latex
    section = r"""\begin{mMainSection}{Achievements}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for achievement in resume_info.achievements:
        section += f"\\item {fmt(achievement)}\n"
    section += r"""\end{itemize}"""
    section += r"""\end{mMainSection}"""
    return resume_latex + section + "\n"


def add_certifications_modern(resume_latex: str, resume_info: CustomResumeInfo) -> str:
    if not resume_info.certifications:
        return resume_latex
    section = r"""\begin{mMainSection}{Certifications}"""
    section += r"""\begin{itemize}\itemsep -0.2em"""
    for cert in resume_info.certifications:
        section += f"\\item {fmt(cert.name)}"
        if cert.credential_id:
            if cert.credential_id.startswith(("http://", "https://")):
                section += f" — \\href{{{cert.credential_id}}}{{Verify}}"
            else:
                section += f" — ID: {cert.credential_id}"
    section += r"""\end{itemize}"""
    section += r"""\end{mMainSection}"""
    return resume_latex + section + "\n"
