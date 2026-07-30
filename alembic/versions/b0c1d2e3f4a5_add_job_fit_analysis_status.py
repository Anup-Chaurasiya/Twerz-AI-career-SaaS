"""Add jobs.fit_analysis_status and fit_analysis_error

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_fit_status = sa.Enum("NONE", "ANALYZING", "READY", "FAILED", name="fitanalysisstatus")


def upgrade() -> None:
    _fit_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "jobs",
        sa.Column(
            "fit_analysis_status",
            _fit_status,
            server_default="NONE",
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column("fit_analysis_error", sa.Text(), nullable=True),
    )
    # Backfill jobs that already have fit scores from the sync analyze-fit flow.
    op.execute(
        """
        UPDATE jobs
        SET fit_analysis_status = 'READY'
        WHERE fit_score IS NOT NULL AND fit_label IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("jobs", "fit_analysis_error")
    op.drop_column("jobs", "fit_analysis_status")
    _fit_status.drop(op.get_bind(), checkfirst=True)
