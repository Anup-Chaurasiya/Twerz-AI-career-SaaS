"""Smoke tests that NEXT.md critical prompt text is present."""

from app.services.ai import prompts


def test_structured_resume_anti_fabrication():
    assert "Do NOT add, infer, upgrade, or invent" in prompts.STRUCTURED_RESUME_SYSTEM_PROMPT
    assert "leave the field null" in prompts.STRUCTURED_RESUME_SYSTEM_PROMPT


def test_enhanced_resume_honesty_rules():
    assert "NEVER add a skill" in prompts.ENHANCED_RESUME_SYSTEM_PROMPT
    assert "NEVER upgrade a soft claim into a quantified one" in prompts.ENHANCED_RESUME_SYSTEM_PROMPT


def test_evidence_map_calibration_examples():
    assert "Calibration examples" in prompts.EVIDENCE_MAP_SYSTEM_PROMPT
    assert "Kubernetes" in prompts.EVIDENCE_MAP_SYSTEM_PROMPT
    assert "Okta administration" in prompts.EVIDENCE_MAP_SYSTEM_PROMPT


def test_write_mode_stretch_exists():
    assert "STRETCH" in prompts.WRITE_MODE_STRETCH
    assert "Genuine reach" in prompts.WRITE_MODE_STRETCH


def test_write_prompt_no_unverifiable_clause():
    assert "unverifiable" not in prompts.CUSTOM_RESUME_WRITE_SYSTEM_PROMPT
    assert "domain_relevant" in prompts.CUSTOM_RESUME_WRITE_SYSTEM_PROMPT


def test_roast_off_limits():
    assert "Off-limits" in prompts.ROAST_SYSTEM_PROMPT
    assert "ethnicity" in prompts.ROAST_SYSTEM_PROMPT
    assert "employment gap" in prompts.ROAST_SYSTEM_PROMPT


def test_legacy_single_shot_prompts_removed():
    assert not hasattr(prompts, "CUSTOM_RESUME_SYSTEM_PROMPT")
    assert not hasattr(prompts, "CUSTOM_RESUME_USER_PROMPT")


def test_resume_plan_prompts_exist_and_are_grounded():
    assert "Resume Planner" in prompts.RESUME_PLAN_SYSTEM_PROMPT
    assert "never invent" in prompts.RESUME_PLAN_SYSTEM_PROMPT.lower()
    assert "{jd_analysis}" in prompts.RESUME_PLAN_USER_PROMPT
    assert "{evidence_map}" in prompts.RESUME_PLAN_USER_PROMPT
    assert "{user_info}" in prompts.RESUME_PLAN_USER_PROMPT


def test_recruiter_review_prompts_exist_and_forbid_new_claims():
    assert "Senior Engineering Recruiter" in prompts.RECRUITER_REVIEW_SYSTEM_PROMPT
    assert "Never suggest adding" in prompts.RECRUITER_REVIEW_SYSTEM_PROMPT
    assert "{tailored_resume}" in prompts.RECRUITER_REVIEW_USER_PROMPT


def test_write_prompt_references_resume_plan():
    assert "resume_plan" in prompts.CUSTOM_RESUME_WRITE_SYSTEM_PROMPT
    assert "{resume_plan}" in prompts.CUSTOM_RESUME_WRITE_USER_PROMPT
