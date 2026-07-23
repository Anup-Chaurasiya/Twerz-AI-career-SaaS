"""Golden JD matrix runner for admin health panel."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.golden_matrix_run import GoldenMatrixRun
from app.services.golden.loader import cell_id, load_jd, load_matrix, load_persona, matrix_cells
from app.services.golden.invariants import (
    assert_evidence_categories_sum,
    assert_no_forbidden_tools,
    assert_roadmap_policy,
    assert_scores_in_range,
)

logger = logging.getLogger(__name__)

_run_lock = asyncio.Lock()
_active_run_id: int | None = None


async def get_latest_run(db: AsyncSession) -> GoldenMatrixRun | None:
    result = await db.execute(
        select(GoldenMatrixRun).order_by(GoldenMatrixRun.started_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def run_golden_matrix_background(db_factory, run_id: int) -> None:
    """Execute analyze_fit_only for all matrix cells; update run record."""
    global _active_run_id
    async with _run_lock:
        _active_run_id = run_id

    from app.services.job.tailor_pipeline import TailorPipeline

    pipeline = TailorPipeline()
    rubric = load_matrix().get("rubric") or []
    results: list[dict] = []
    passed = True
    error_message = None

    try:
        for cell in matrix_cells():
            cid = cell_id(cell)
            profile = load_persona(cell["persona"])
            jd = load_jd(cell["persona"], cell["jd_key"])
            try:
                result = await pipeline.analyze_fit_only(
                    profile_info=profile,
                    job_description=jd,
                    user_id="golden-matrix-admin",
                    reference_id=cid,
                )
                assert_scores_in_range(result, allow_missing_ats=True)
                assert_evidence_categories_sum(result["evidence_map"])
                assert_roadmap_policy(result["fit_label"], result.get("gap_roadmap"))
                label_ok = result["fit_label"] == cell["expected_fit_label"]
                results.append({
                    "cell": cid,
                    "fit_label": result["fit_label"],
                    "expected_fit_label": cell["expected_fit_label"],
                    "fit_score": result.get("fit_score"),
                    "label_match": label_ok,
                    "passed": label_ok,
                })
                if not label_ok:
                    passed = False
            except Exception as exc:
                passed = False
                results.append({"cell": cid, "passed": False, "error": str(exc)})
        status = "passed" if passed else "failed"
    except Exception as exc:
        logger.exception("Golden matrix run failed")
        status = "failed"
        passed = False
        error_message = str(exc)

    async with db_factory() as db:
        run = await db.get(GoldenMatrixRun, run_id)
        if run:
            run.status = status
            run.passed = passed
            run.result_json = {"rubric": rubric, "cells": results}
            run.error_message = error_message
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

    _active_run_id = None


def is_running() -> bool:
    return _active_run_id is not None
