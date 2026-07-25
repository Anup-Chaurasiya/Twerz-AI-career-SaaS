"""guest_profiles

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-25 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("profiles", "user_id", existing_type=sa.String(), nullable=True)
    op.add_column(
        "profiles",
        sa.Column("guest_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column("guest_ip", sa.String(length=45), nullable=True),
    )
    op.create_index("ix_profiles_guest_expires_at", "profiles", ["guest_expires_at"])


def downgrade() -> None:
    op.drop_index("ix_profiles_guest_expires_at", table_name="profiles")
    op.drop_column("profiles", "guest_ip")
    op.drop_column("profiles", "claimed_at")
    op.drop_column("profiles", "guest_expires_at")
    op.alter_column("profiles", "user_id", existing_type=sa.String(), nullable=False)
