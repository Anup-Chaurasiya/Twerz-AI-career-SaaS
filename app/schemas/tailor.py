"""Schemas for the multi-pass resume tailoring pipeline."""

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class FitLabel(str, Enum):
    STRONG = "STRONG"
    STRETCH = "STRETCH"
    MISMATCH = "MISMATCH"


class EvidenceSupport(str, Enum):
    SUPPORTED = "SUPPORTED"
    PARTIAL = "PARTIAL"
    MISSING = "MISSING"


class JDAnalysis(BaseModel):
    role_title: str = Field(..., description="Normalized target role title from the JD")
    company: Optional[str] = Field(default=None, description="Company name if present")
    role_family: str = Field(
        ...,
        description="Role family e.g. IAM/Security, Full-Stack, Backend, Data, Product, Other",
    )
    seniority: Literal["intern", "junior", "mid", "senior", "staff", "lead", "executive", "unspecified"] = (
        "unspecified"
    )
    must_haves: List[str] = Field(
        default_factory=list,
        description="Hard requirements / must-have skills from the JD (max 12)",
    )
    nice_to_haves: List[str] = Field(
        default_factory=list,
        description="Nice-to-have skills (max 10)",
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="ATS keywords to mirror when evidence exists (exact JD phrasing)",
    )
    responsibilities: List[str] = Field(
        default_factory=list,
        description="Core responsibilities distilled from the JD (max 8)",
    )
    summary: str = Field(
        default="",
        description="2-3 sentence plain-English summary of what this role needs",
    )


class EvidenceItem(BaseModel):
    requirement: str = Field(..., description="Must-have or keyword being evaluated")
    support: EvidenceSupport
    evidence_quote: Optional[str] = Field(
        default=None,
        description="Short quote or paraphrase from the candidate profile proving support",
    )
    transferable_angle: Optional[str] = Field(
        default=None,
        description="How to reframe existing experience toward this requirement without inventing tools",
    )


class EvidenceMap(BaseModel):
    items: List[EvidenceItem] = Field(default_factory=list)
    candidate_seniority_estimate: Literal[
        "intern", "junior", "mid", "senior", "staff", "lead", "executive", "unspecified"
    ] = "unspecified"
    transferable_themes: List[str] = Field(
        default_factory=list,
        description="Honest themes the candidate CAN lean into for this JD",
    )
    gaps: List[str] = Field(
        default_factory=list,
        description="Critical missing requirements that must NOT be invented",
    )


class ATSScoreResult(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Estimated ATS score 0-100")
    matched_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    critique: str = Field(
        default="",
        description="Actionable critique of the tailored resume vs the JD",
    )


class FitVerdict(BaseModel):
    fit_score: int = Field(..., ge=0, le=100)
    fit_label: FitLabel
    rationale: str = Field(default="")
    gap_list: List[str] = Field(default_factory=list)


class GapRoadmapStep(BaseModel):
    title: str = Field(..., description="Short actionable step title")
    detail: str = Field(..., description="Concrete how-to for this step")
    category: Literal["skill", "cert", "project", "experience", "other"] = "skill"


class GapRoadmap(BaseModel):
    steps: List[GapRoadmapStep] = Field(
        default_factory=list,
        description="3–5 concrete next steps to become competitive for this role class",
    )
    summary: str = Field(
        default="",
        description="One-sentence framing of the path from current profile to this role",
    )


class CoverLetterResult(BaseModel):
    cover_letter: str = Field(..., description="Full cover letter text, 250-400 words")


class BulletQualityIssue(BaseModel):
    role: str = Field(default="", description="Company/role or project name for the bullet")
    original: str = Field(default="", description="Original profile bullet")
    tailored: str = Field(default="", description="Tailored bullet that regressed")
    reason: str = Field(default="", description="Why specificity decreased")


class BulletQualityResult(BaseModel):
    passed: bool = Field(..., description="True if no specificity regressions")
    issues: List[BulletQualityIssue] = Field(default_factory=list)
    critique: str = Field(
        default="",
        description="Actionable critique to restore density/metrics on re-prompt",
    )


class InterviewPacket(BaseModel):
    likely_questions: List[str] = Field(default_factory=list)
    star_stories: List[str] = Field(
        default_factory=list,
        description="STAR-format stories grounded in the candidate's evidence",
    )
    elevator_pitch: str = Field(default="", description="60-second pitch")
    gaps_to_prepare: List[str] = Field(default_factory=list)


class ImpliedClaimViolation(BaseModel):
    requirement: str = Field(..., description="MISSING requirement that was implied")
    excerpt: str = Field(
        default="",
        description="Short excerpt from the draft that implies the claim",
    )


class ImpliedClaimScan(BaseModel):
    violations: List[ImpliedClaimViolation] = Field(
        default_factory=list,
        description="Implied claims of MISSING tools/skills in the draft",
    )
