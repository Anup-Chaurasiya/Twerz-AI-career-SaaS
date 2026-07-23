"""Alembic migration: add score_calibrations table (Phase 2 — Outcome Feedback Loop)

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
Create Date: 2026-07-23

Creates the score_calibrations table used to store aggregated
interview/offer conversion rates per fit_label x ATS bucket.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "u2v3w4x5y6z7"
down_revision: Union[str, None] = "t1u2v3w4x5y6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "score_calibrations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fit_label", sa.String(32), nullable=False, index=True),
        sa.Column("ats_bucket", sa.String(16), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False, default=0),
        sa.Column("application_rate", sa.Float(), nullable=True),
        sa.Column("interview_rate", sa.Float(), nullable=True),
        sa.Column("offer_rate", sa.Float(), nullable=True),
        sa.Column(
            "last_computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_score_calibrations_fit_label_ats_bucket",
        "score_calibrations",
        ["fit_label", "ats_bucket"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_score_calibrations_fit_label_ats_bucket", table_name="score_calibrations")
    op.drop_table("score_calibrations")
