"""add pdf_verified_readable to jobs

Revision ID: t1u2v3w4x5y6
Revises: s0t1u2v3w4x5
Create Date: 2026-07-23

Phase 1 — Trust & Verification Hardening:
Adds pdf_verified_readable boolean (nullable) to the jobs table.
NULL  = not yet verified (all pre-Phase 1 jobs)
True  = verified machine-readable
False = failed verification after one retry attempt
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "t1u2v3w4x5y6"
down_revision = "s0t1u2v3w4x5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("pdf_verified_readable", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("jobs", "pdf_verified_readable")
