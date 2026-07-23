"""Add resume_plan and recruiter_review columns on jobs (multi-stage pipeline redesign).

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-07-23
"""

from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a6"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("resume_plan", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("recruiter_review", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "recruiter_review")
    op.drop_column("jobs", "resume_plan")
