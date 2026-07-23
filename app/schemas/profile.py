from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProfileResponse(BaseModel):
    id: int
    user_id: str
    resume_info: Optional[dict] = None
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpsertPayload(BaseModel):
    resume_info: dict
    profile_id: Optional[int] = None


class LinkedInOptimizeResult(BaseModel):
    headline: str = Field(..., description="LinkedIn headline (max 220 chars)")
    about: str = Field(..., description="LinkedIn About summary text")
    skills: list[str] = Field(default_factory=list, description="Prioritized list of real skills")

