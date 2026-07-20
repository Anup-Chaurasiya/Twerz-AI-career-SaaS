from pydantic import BaseModel, Field, model_validator
from typing import Any, List, Optional


class CustomLink(BaseModel):
    name: str = Field(..., title="Name of the website")
    url: str = Field(..., title="URL of the website")


class CustomProject(BaseModel):
    name: str = Field(..., title="Name of the project")
    link: Optional[str] = Field(default=None, title="Link to the project")
    description: List[str] = Field(title="Bullet points highlighting the project")


class CustomExperience(BaseModel):
    company_name: str = Field(..., title="Name of the company")
    start_date: Optional[str] = Field(default=None, title="Start date of the experience")
    end_date: Optional[str] = Field(default=None, title="End date of the experience")
    role: str = Field(..., title="Role in the company")
    description: List[str] = Field(title="Bullet points highlighting the experience")


class CustomSkills(BaseModel):
    languages: List[str] = Field(default=[], title="List of languages")
    frameworks: List[str] = Field(default=[], title="List of frameworks")
    databases: List[str] = Field(default=[], title="List of databases")
    domain_relevant: List[str] = Field(
        default=[],
        title="JD-domain-relevant skills the candidate actually has (auth, data eng, DevOps, etc.)",
    )
    domain_label: str = Field(
        default="Domain",
        title="Short label for the domain_relevant skills bucket (e.g. Security / Auth, Data Eng)",
    )
    other_technologies: List[str] = Field(default=[], title="List of other technologies")

    @model_validator(mode="before")
    @classmethod
    def _legacy_security_to_domain_relevant(cls, data: Any) -> Any:
        """Accept stored JSON that still uses skills.security."""
        if not isinstance(data, dict):
            return data
        out = dict(data)
        if "domain_relevant" not in out and "security" in out:
            out["domain_relevant"] = out.pop("security") or []
            if not out.get("domain_label"):
                out["domain_label"] = "Security / Auth"
        elif "security" in out:
            # Prefer domain_relevant; drop legacy key
            out.pop("security", None)
        return out


class CustomEducation(BaseModel):
    degree: str = Field(..., title="Degree")
    start_date: Optional[str] = Field(default=None, title="Start date of the education")
    end_date: Optional[str] = Field(default=None, title="End date of the education")
    grade: Optional[str] = Field(default=None, title="Grade of the education")
    institution: str = Field(..., title="Name of the institution")


class CustomCertification(BaseModel):
    name: str = Field(..., title="Name of the certification")
    credential_id: Optional[str] = Field(default=None, title="Credential ID or verification URL")


class CustomPatent(BaseModel):
    name: str = Field(..., title="Name of the patent")
    date: Optional[str] = Field(default=None, title="Date of the patent")
    description: Optional[str] = Field(default=None, title="Description of the patent")


class CustomPaper(BaseModel):
    name: str = Field(..., title="Name of the paper")
    date: Optional[str] = Field(default=None, title="Date of the paper")
    description: Optional[str] = Field(default=None, title="Description of the paper")


class CustomResumeInfo(BaseModel):
    name: str = Field(..., title="Name")
    email: str = Field(..., title="Email")
    mobile_number: Optional[str] = Field(default=None, title="Mobile number")
    date_of_birth: Optional[str] = Field(default=None, title="Date of birth")
    headline: Optional[str] = Field(
        default=None,
        title="Professional headline under the name, tailored to the target role using only truthful themes",
    )
    summary: Optional[str] = Field(
        default=None,
        title="3-4 line professional summary aligned to the JD, evidence-only",
    )
    links: List[CustomLink] = Field(default=[], title="List of links")
    projects: List[CustomProject] = Field(default=[], title="List of projects")
    past_experience: List[CustomExperience] = Field(default=[], title="List of experiences")
    achievements: List[str] = Field(default=[], title="List of achievements")
    skills: CustomSkills = Field(default_factory=CustomSkills, title="Skills")
    educations: List[CustomEducation] = Field(default=[], title="List of educations")
    certifications: List[CustomCertification] = Field(default=[], title="List of certifications")
    patents: List[CustomPatent] = Field(default=[], title="List of patents")
    papers: List[CustomPaper] = Field(default=[], title="List of papers")
