"""
Live golden JD matrix (optional).

  INTEGRATION=1 uv run pytest tests/integration/test_golden_jd_matrix.py -v
  INTEGRATION=1 GOLDEN_FULL=1 GOLDEN_STRICT=1 uv run pytest tests/integration/test_golden_jd_matrix.py -v

Default: analyze_fit_only for all 12 cells (hard invariants only).
GOLDEN_FULL=1: also run full TailorPipeline.run for junior_generalist strong_match + mismatch.
GOLDEN_STRICT=1: fit label / score-band mismatches become hard failures (default: soft warnings).
"""

from __future__ import annotations

import os
from typing import Any

import pytest

from app.services.job.tailor_pipeline import TailorPipeline
from tests.test_services.golden_invariants import (
    assert_evidence_categories_sum,
    assert_no_forbidden_tools,
    assert_roadmap_policy,
    assert_scores_in_range,
)
from tests.test_services.golden_loader import cell_id, load_jd, load_matrix, load_persona, matrix_cells

RUBRIC = load_matrix().get("rubric") or []


def _strict() -> bool:
    return os.environ.get("GOLDEN_STRICT") == "1"


def _full() -> bool:
    return os.environ.get("GOLDEN_FULL") == "1"


def _soft_check(condition: bool, message: str, soft_failures: list[str]) -> None:
    if condition:
        return
    if _strict():
        raise AssertionError(message)
    soft_failures.append(message)
    print(f"[GOLDEN SOFT] {message}")


@pytest.fixture(scope="module")
def pipeline() -> TailorPipeline:
    return TailorPipeline()


@pytest.mark.golden
@pytest.mark.asyncio
@pytest.mark.parametrize("cell", matrix_cells(), ids=lambda c: cell_id(c))
async def test_live_analyze_fit_matrix_cell(pipeline: TailorPipeline, cell: dict[str, Any]):
    print("\n=== Golden grading rubric ===")
    for line in RUBRIC:
        print(f"  - {line}")

    profile = load_persona(cell["persona"])
    jd = load_jd(cell["persona"], cell["jd_key"])
    soft: list[str] = []

    result = await pipeline.analyze_fit_only(
        profile_info=profile,
        job_description=jd,
        user_id="golden-matrix",
        reference_id=cell_id(cell),
    )

    assert_scores_in_range(result, allow_missing_ats=True)
    assert_evidence_categories_sum(result["evidence_map"])
    assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))

    _soft_check(
        result["fit_label"] == cell["expected_fit_label"],
        f"{cell_id(cell)}: fit_label={result['fit_label']} expected={cell['expected_fit_label']}",
        soft,
    )
    score = result["fit_score"]
    _soft_check(
        cell["expected_fit_score_min"] <= score <= cell["expected_fit_score_max"],
        f"{cell_id(cell)}: fit_score={score} expected "
        f"[{cell['expected_fit_score_min']},{cell['expected_fit_score_max']}]",
        soft,
    )

    print(
        f"[GOLDEN] {cell_id(cell)} label={result['fit_label']} score={score} "
        f"roadmap={'yes' if result.get('gap_roadmap') else 'no'} soft_issues={len(soft)}"
    )


@pytest.mark.golden
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "persona,jd_key",
    [
        ("junior_generalist", "strong_match"),
        ("junior_generalist", "mismatch"),
    ],
    ids=["junior_strong_run", "junior_mismatch_run"],
)
async def test_live_full_run_selected_cells(pipeline: TailorPipeline, persona: str, jd_key: str):
    if not _full():
        pytest.skip("Set GOLDEN_FULL=1 to run full TailorPipeline.run cells")

    cell = next(c for c in matrix_cells() if c["persona"] == persona and c["jd_key"] == jd_key)
    profile = load_persona(persona)
    jd = load_jd(persona, jd_key)
    soft: list[str] = []

    result = await pipeline.run(
        profile_info=profile,
        job_description=jd,
        user_id="golden-matrix",
        reference_id=f"{persona}__{jd_key}__run",
    )

    assert_scores_in_range(result)
    assert_evidence_categories_sum(result["evidence_map"])
    assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))
    assert result.get("custom_resume_data"), "full run must produce resume"
    assert result.get("bullet_diff") is not None

    if cell.get("forbidden_tools"):
        assert_no_forbidden_tools(result["custom_resume_data"], cell["forbidden_tools"])

    _soft_check(
        result["fit_label"] == cell["expected_fit_label"],
        f"run {persona}/{jd_key}: label={result['fit_label']} expected={cell['expected_fit_label']}",
        soft,
    )
    print(
        f"[GOLDEN RUN] {persona}/{jd_key} fit={result['fit_label']} "
        f"ats={result['ats_score_before']}→{result['ats_score_after']} soft={len(soft)}"
    )
