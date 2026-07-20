"""Build a usable .docx from CustomResumeInfo without external deps (OOXML zip)."""

from __future__ import annotations

import io
import zipfile
from xml.sax.saxutils import escape

from app.schemas.custom_resume import CustomResumeInfo

_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def _p(text: str, *, bold: bool = False, size: int = 22, style: str | None = None) -> str:
    """One paragraph run. size is half-points (22 = 11pt)."""
    text = escape(text or "")
    ppr = ""
    if style:
        ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
    rpr = f'<w:rPr><w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    if bold:
        rpr += "<w:b/>"
    rpr += "</w:rPr>"
    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>'


def _heading(text: str) -> str:
    return _p(text, bold=True, size=24, style="Heading1")


def _bullet(text: str) -> str:
    text = escape(text or "")
    return (
        '<w:p>'
        '<w:pPr><w:pStyle w:val="ListBullet"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        "</w:pPr>"
        f'<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
        f'<w:t xml:space="preserve">{text}</w:t></w:r>'
        "</w:p>"
    )


def _hyperlink(name: str, rel_id: str) -> str:
    name = escape(name or "link")
    return (
        "<w:p>"
        f'<w:hyperlink r:id="{rel_id}">'
        f'<w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:sz w:val="18"/>'
        f"<w:u w:val=\"single\"/><w:color w:val=\"0563C1\"/></w:rPr>"
        f'<w:t xml:space="preserve">{name}</w:t></w:r>'
        "</w:hyperlink>"
        "</w:p>"
    )


def build_docx_bytes(resume: CustomResumeInfo | dict) -> bytes:
    if isinstance(resume, dict):
        resume = CustomResumeInfo.model_validate(resume)

    parts: list[str] = []
    hyperlink_rels: list[tuple[str, str]] = []  # (rId, url)

    parts.append(_p(resume.name or "", bold=True, size=32))
    if resume.headline:
        parts.append(_p(resume.headline, size=20))
    contact = " | ".join(
        x for x in [resume.mobile_number, resume.email] if x
    )
    if contact:
        parts.append(_p(contact, size=18))

    if resume.links:
        for i, link in enumerate(resume.links, start=1):
            rid = f"rIdH{i}"
            url = (link.url or "").strip()
            if url:
                hyperlink_rels.append((rid, url))
                parts.append(_hyperlink(link.name or url, rid))
            else:
                parts.append(_p(link.name or "", size=18))

    if resume.summary:
        parts.append(_heading("Summary"))
        parts.append(_p(resume.summary, size=20))

    if resume.past_experience:
        parts.append(_heading("Experience"))
        for exp in resume.past_experience:
            header = f"{exp.role} — {exp.company_name}"
            dates = " – ".join(x for x in [exp.start_date, exp.end_date or "Present"] if x)
            parts.append(_p(header, bold=True, size=20))
            if dates:
                parts.append(_p(dates, size=18))
            for b in exp.description or []:
                parts.append(_bullet(b))

    if resume.projects:
        parts.append(_heading("Projects"))
        for proj in resume.projects:
            parts.append(_p(proj.name, bold=True, size=20))
            if proj.link:
                rid = f"rIdP{len(hyperlink_rels) + 1}"
                hyperlink_rels.append((rid, proj.link))
                parts.append(_hyperlink(proj.link, rid))
            for b in proj.description or []:
                parts.append(_bullet(b))

    skills = resume.skills
    skill_lines = []
    if skills.languages:
        skill_lines.append("Languages: " + ", ".join(skills.languages))
    if skills.frameworks:
        skill_lines.append("Frameworks: " + ", ".join(skills.frameworks))
    if skills.databases:
        skill_lines.append("Databases: " + ", ".join(skills.databases))
    if skills.domain_relevant:
        label = skills.domain_label or "Domain"
        skill_lines.append(f"{label}: " + ", ".join(skills.domain_relevant))
    if skills.other_technologies:
        skill_lines.append("Other: " + ", ".join(skills.other_technologies))
    if skill_lines:
        parts.append(_heading("Skills"))
        for line in skill_lines:
            parts.append(_p(line, size=20))

    if resume.educations:
        parts.append(_heading("Education"))
        for edu in resume.educations:
            line = f"{edu.degree} — {edu.institution}"
            parts.append(_p(line, bold=True, size=20))
            meta = " – ".join(x for x in [edu.start_date, edu.end_date] if x)
            if edu.grade:
                meta = f"{meta} · {edu.grade}" if meta else edu.grade
            if meta:
                parts.append(_p(meta, size=18))

    if resume.achievements:
        parts.append(_heading("Achievements"))
        for a in resume.achievements:
            parts.append(_bullet(a))

    if resume.certifications:
        parts.append(_heading("Certifications"))
        for c in resume.certifications:
            line = c.name
            if c.credential_id:
                line = f"{line} ({c.credential_id})"
            parts.append(_p(line, size=20))

    body = "".join(parts)
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{_W}" xmlns:r="{_R}">
  <w:body>
    {body}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>"""

    styles_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{_W}">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr><w:u w:val="single"/><w:color w:val="0563C1"/></w:rPr>
  </w:style>
</w:styles>"""

    numbering_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="{_W}">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

    doc_rels_parts = [
        f'<Relationship Id="rId1" Type="{_REL}/styles" Target="styles.xml"/>',
        f'<Relationship Id="rId2" Type="{_REL}/numbering" Target="numbering.xml"/>',
    ]
    for rid, url in hyperlink_rels:
        safe_url = escape(url)
        doc_rels_parts.append(
            f'<Relationship Id="{rid}" Type="{_REL}/hyperlink" Target="{safe_url}" TargetMode="External"/>'
        )
    document_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{_REL}">
  {"".join(doc_rels_parts)}
</Relationships>"""

    content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>"""

    package_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{_REL}">
  <Relationship Id="rId1" Type="{_REL}/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", package_rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/styles.xml", styles_xml)
        zf.writestr("word/numbering.xml", numbering_xml)
        zf.writestr("word/_rels/document.xml.rels", document_rels)
    return buf.getvalue()
