"""Tests for resume template registry and builders."""

import pytest

from app.schemas.custom_resume import CustomResumeInfo, CustomExperience, CustomSkills
from app.services.latex.builder import build_resume
from app.services.latex.templates import DEFAULT_TEMPLATE_ID, TEMPLATE_REGISTRY, get_template_spec


@pytest.mark.parametrize("template_id", list(TEMPLATE_REGISTRY.keys()))
def test_build_resume_all_templates_minimal(template_id: str):
    info = CustomResumeInfo(name="Jane Doe", email="jane@example.com")
    latex = build_resume(info, template_id=template_id)
    spec = get_template_spec(template_id)
    assert f"\\documentclass{{{spec.document_class}}}" in latex
    assert r"\begin{document}" in latex
    assert r"\end{document}" in latex
    assert "Jane Doe" in latex


@pytest.mark.parametrize("template_id", list(TEMPLATE_REGISTRY.keys()))
def test_build_resume_all_templates_full(template_id: str):
    info = CustomResumeInfo(
        name="John Smith",
        email="john@example.com",
        headline="Software Engineer",
        summary="Built scalable APIs.",
        past_experience=[
            CustomExperience(
                company_name="Acme",
                role="Engineer",
                start_date="2020",
                end_date="2024",
                description=["Shipped **FastAPI** services"],
            )
        ],
        skills=CustomSkills(languages=["Python"], frameworks=["FastAPI"]),
    )
    latex = build_resume(info, template_id=template_id)
    assert "Experience" in latex
    assert "Acme" in latex
    assert r"\textbf{FastAPI}" in latex


def test_unknown_template_raises():
    info = CustomResumeInfo(name="Test", email="t@t.com")
    with pytest.raises(ValueError, match="Unknown template_id"):
        build_resume(info, template_id="nonexistent")


def test_default_template_is_classic():
    assert DEFAULT_TEMPLATE_ID == "classic"
