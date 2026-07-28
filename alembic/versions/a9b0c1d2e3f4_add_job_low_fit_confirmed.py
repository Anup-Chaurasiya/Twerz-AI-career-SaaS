"""Add jobs.low_fit_confirmed for extension fit gate persistence

Revision ID: a9b0c1d2e3f4
Revises: i8j9k0l1m2n3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "i8j9k0l1m2n3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("low_fit_confirmed", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("jobs", "low_fit_confirmed")
