"""add referral and networking fields to jobs (Phase 3)

Revision ID: v3w4x5y6z7a8
Revises: u2v3w4x5y6z7
Create Date: 2026-07-23

Phase 3 — Referral & Warm-Intro Assist:
Adds `known_contacts` (JSON) and `applied_via` (String) to jobs table.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v3w4x5y6z7a8"
down_revision: Union[str, None] = "u2v3w4x5y6z7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("known_contacts", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("applied_via", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "applied_via")
    op.drop_column("jobs", "known_contacts")
