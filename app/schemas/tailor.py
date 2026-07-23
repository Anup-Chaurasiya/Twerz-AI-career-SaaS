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


class ResumePlan(BaseModel):
    """Structured writing strategy produced BEFORE resume generation (Stage 5: Resume Planner).

    The writer follows this plan for organization/strategy; `<candidate_profile>` remains
    the sole source of truth for facts. Nothing here should introduce new claims.
    """

    target_role: str = Field(default="", description="Normalized target role this plan is written for")
    strengths: List[str] = Field(
        default_factory=list,
        description="Candidate's real strengths relevant to this JD, grounded in evidence_map",
    )
    weaknesses: List[str] = Field(
        default_factory=list,
        description="Honest gaps relevant to this JD, drawn from evidence_map gaps/MISSING items only",
    )
    experience_themes: List[str] = Field(
        default_factory=list,
        description="Logical domains to group experience bullets under (e.g. Backend Systems, AI Platform, "
        "Automation) — derived from what the candidate actually did",
    )
    project_themes: List[str] = Field(
        default_factory=list,
        description="Logical domains to group project bullets under",
    )
    skill_priorities: List[str] = Field(
        default_factory=list,
        description="Candidate's real skills only, ordered by relevance to this JD",
    )
    key_achievements: List[str] = Field(
        default_factory=list,
        description="Most valuable achievements to foreground, quoted/paraphrased directly from the profile "
        "(favor quantified ones)",
    )
    bullet_ordering_notes: str = Field(
        default="", description="Guidance on which bullets to lead with per role/project"
    )
    section_order: List[str] = Field(
        default_factory=list,
        description="Recommended resume section order, e.g. ['summary', 'skills', 'experience', 'projects', "
        "'education']",
    )
    strategy_summary: str = Field(
        default="", description="One or two sentence framing of the overall angle the writer should take"
    )


class RecruiterReviewResult(BaseModel):
    """Stage 7: Recruiter Review — a senior-recruiter critique of a resume draft.

    Sub-scores are 0-10. The pipeline computes pass/fail deterministically from the
    minimum sub-score (see validators.recruiter_review_passed) rather than trusting a
    self-reported boolean, matching how ATS/fit scores are gated elsewhere.
    """

    would_shortlist: bool = Field(default=False, description="Would this recruiter shortlist the candidate?")
    ten_second_clarity: bool = Field(
        default=False, description="Can a recruiter understand who this candidate is within ~10 seconds?"
    )
    readability: int = Field(default=0, ge=0, le=10)
    professionalism: int = Field(default=0, ge=0, le=10)
    trust: int = Field(default=0, ge=0, le=10)
    scanability: int = Field(default=0, ge=0, le=10)
    shortlist_likelihood: int = Field(default=0, ge=0, le=10)
    repetitive_notes: List[str] = Field(
        default_factory=list, description="What feels repetitive (verb reuse, similar bullet shapes)"
    )
    weak_bullets: List[str] = Field(
        default_factory=list, description="Specific weak/vague/no-impact bullets quoted from the draft"
    )
    bullets_to_move: List[str] = Field(
        default_factory=list, description="Bullets that are misplaced or buried and should move"
    )
    summary_feedback: str = Field(default="", description="Is the summary convincing, or generic filler?")
    flow_feedback: str = Field(default="", description="Does the experience read as a coherent narrative?")
    critique: str = Field(
        default="",
        description="Actionable critique for one targeted rewrite pass — structural/wording only, "
        "never suggests adding unverifiable claims",
    )
