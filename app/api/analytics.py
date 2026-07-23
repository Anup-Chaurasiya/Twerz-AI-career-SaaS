"""Analytics API — Phase 4: Personal Analytics & Proof-of-Value Dashboard.

Exposes GET /analytics/me which computes the user's personal conversion funnel:
- Applications by fit_label band
- Interview conversion rates by band
- Comparison against platform-wide ScoreCalibration benchmarks
- Actionable recommendation nudges ("You're 3x more likely to interview when Fit >= 70")
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies import get_current_user
from app.models.job import Job
from app.models.user import User
from app.services.calibration.service import CalibrationService

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _aggregate_platform_benchmarks(rows: list[dict]) -> list[dict]:
    """Roll up calibration rows (fit_label × ATS bucket) into fit_label summaries."""
    grouped: dict[str, dict] = {}
    for row in rows:
        fit = row.get("fit_label") or ""
        if not fit:
            continue
        sample = int(row.get("sample_size") or 0)
        if fit not in grouped:
            grouped[fit] = {
                "fit_label": fit,
                "sample_size": 0,
                "interview_weight": 0.0,
                "offer_weight": 0.0,
            }
        g = grouped[fit]
        g["sample_size"] += sample
        g["interview_weight"] += float(row.get("interview_rate") or 0) * sample
        g["offer_weight"] += float(row.get("offer_rate") or 0) * sample

    aggregated = []
    for fit, g in grouped.items():
        total = g["sample_size"]
        aggregated.append(
            {
                "fit_label": fit,
                "sample_size": total,
                "interview_rate": round(g["interview_weight"] / total, 4) if total else 0.0,
                "offer_rate": round(g["offer_weight"] / total, 4) if total else 0.0,
            }
        )
    return aggregated


@router.get("/me")
async def get_personal_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return user's personal conversion funnel and platform benchmark comparisons.

    Safe for new users with zero application data: returns `sufficient_data: False`
    with platform benchmark defaults until the user has applied to enough jobs.
    """
    # Fetch all jobs for current user
    result = await db.execute(select(Job).where(Job.user_id == current_user.id))
    jobs = result.scalars().all()

    total_jobs = len(jobs)
    bands: dict[str, dict] = {
        "STRONG": {"total": 0, "applied": 0, "interview": 0, "offer": 0},
        "GOOD": {"total": 0, "applied": 0, "interview": 0, "offer": 0},
        "STRETCH": {"total": 0, "applied": 0, "interview": 0, "offer": 0},
        "MISMATCH": {"total": 0, "applied": 0, "interview": 0, "offer": 0},
    }

    for j in jobs:
        fit = (j.fit_label or "").upper()
        if fit not in bands:
            continue
        b = bands[fit]
        b["total"] += 1

        status = (
            j.application_status.value
            if hasattr(j.application_status, "value")
            else str(j.application_status or "")
        ).upper()

        if status in ("APPLIED", "INTERVIEW", "OFFER"):
            b["applied"] += 1
        if status in ("INTERVIEW", "OFFER"):
            b["interview"] += 1
        if status == "OFFER":
            b["offer"] += 1

    by_band = []
    for fit_label, counts in bands.items():
        tot = counts["total"]
        app = counts["applied"]
        inv = counts["interview"]
        off = counts["offer"]

        app_rate = app / tot if tot > 0 else 0.0
        inv_rate = inv / app if app > 0 else 0.0
        off_rate = off / inv if inv > 0 else 0.0

        by_band.append(
            {
                "fit_label": fit_label,
                "total_jobs": tot,
                "applied_jobs": app,
                "interview_jobs": inv,
                "offer_jobs": off,
                "application_rate": round(app_rate, 4),
                "interview_rate": round(inv_rate, 4),
                "offer_rate": round(off_rate, 4),
            }
        )

    # Fetch platform calibrations for benchmark comparison
    svc = CalibrationService()
    platform_rows = await svc.get_calibration(db)
    platform_benchmarks = _aggregate_platform_benchmarks(platform_rows)

    applied_total = sum(b["applied_jobs"] for b in by_band)
    sufficient_data = applied_total >= 5

    # Build actionable nudge message
    strong_b = next((b for b in by_band if b["fit_label"] == "STRONG"), None)
    stretch_b = next((b for b in by_band if b["fit_label"] == "STRETCH"), None)

    if sufficient_data and strong_b and stretch_b and stretch_b["interview_rate"] > 0:
        ratio = round(strong_b["interview_rate"] / stretch_b["interview_rate"], 1)
        if ratio > 1.2:
            nudge = f"You are {ratio}x more likely to land an interview for STRONG fit jobs vs STRETCH roles."
        else:
            nudge = "Keep applying to high-fit roles to maximize your interview callback rate."
    else:
        nudge = "Apply to more jobs to see your personal conversion benchmarks compare against platform averages."

    return {
        "total_jobs": total_jobs,
        "total_applied": applied_total,
        "sufficient_data": sufficient_data,
        "by_band": by_band,
        "platform_benchmarks": platform_benchmarks,
        "platform_calibration_rows": platform_rows,
        "nudge_message": nudge,
    }
