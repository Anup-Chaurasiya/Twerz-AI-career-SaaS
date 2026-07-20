"""add_job_score_check_constraints

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
Create Date: 2026-07-21 00:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "o6p7q8r9s0t1"
down_revision: Union[str, None] = "n5o6p7q8r9s0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clamp any existing out-of-range rows before adding CHECKs (nullable-safe).
    op.execute(
        """
        UPDATE jobs SET fit_score = GREATEST(0, LEAST(100, fit_score))
        WHERE fit_score IS NOT NULL AND (fit_score < 0 OR fit_score > 100)
        """
    )
    op.execute(
        """
        UPDATE jobs SET ats_score_before = GREATEST(0, LEAST(100, ats_score_before))
        WHERE ats_score_before IS NOT NULL
          AND (ats_score_before < 0 OR ats_score_before > 100)
        """
    )
    op.execute(
        """
        UPDATE jobs SET ats_score_after = GREATEST(0, LEAST(100, ats_score_after))
        WHERE ats_score_after IS NOT NULL
          AND (ats_score_after < 0 OR ats_score_after > 100)
        """
    )

    op.create_check_constraint(
        "ck_jobs_fit_score_range",
        "jobs",
        "fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)",
    )
    op.create_check_constraint(
        "ck_jobs_ats_score_before_range",
        "jobs",
        "ats_score_before IS NULL OR (ats_score_before >= 0 AND ats_score_before <= 100)",
    )
    op.create_check_constraint(
        "ck_jobs_ats_score_after_range",
        "jobs",
        "ats_score_after IS NULL OR (ats_score_after >= 0 AND ats_score_after <= 100)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_jobs_ats_score_after_range", "jobs", type_="check")
    op.drop_constraint("ck_jobs_ats_score_before_range", "jobs", type_="check")
    op.drop_constraint("ck_jobs_fit_score_range", "jobs", type_="check")
