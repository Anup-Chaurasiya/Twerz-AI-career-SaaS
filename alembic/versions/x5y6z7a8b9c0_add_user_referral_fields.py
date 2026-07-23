"""add referral_code, referred_by_user_id, referral_bonus_granted to users (Phase 5)

Revision ID: x5y6z7a8b9c0
Revises: v3w4x5y6z7a8
Create Date: 2026-07-23

Phase 5 — Public Growth Engine:
Adds referral program columns to users table.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "x5y6z7a8b9c0"
down_revision: Union[str, None] = "v3w4x5y6z7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("referral_code", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("referred_by_user_id", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("referral_bonus_granted", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)
    op.create_foreign_key(
        "fk_users_referred_by_user_id",
        "users",
        "users",
        ["referred_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_referred_by_user_id", "users", type_="foreignkey")
    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_column("users", "referral_bonus_granted")
    op.drop_column("users", "referred_by_user_id")
    op.drop_column("users", "referral_code")
