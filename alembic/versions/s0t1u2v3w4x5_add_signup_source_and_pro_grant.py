"""Phase 5–6: signup attribution + Job Hunt Pro grant tracking

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
Create Date: 2026-07-21 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "s0t1u2v3w4x5"
down_revision: Union[str, None] = "r9s0t1u2v3w4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("signup_source", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("signup_share_id", sa.String(length=32), nullable=True))
    op.add_column(
        "user_subscriptions",
        sa.Column("razorpay_order_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("credits_last_granted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_user_subscriptions_razorpay_order_id",
        "user_subscriptions",
        ["razorpay_order_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_user_subscriptions_razorpay_order_id", "user_subscriptions", type_="unique")
    op.drop_column("user_subscriptions", "credits_last_granted_at")
    op.drop_column("user_subscriptions", "razorpay_order_id")
    op.drop_column("users", "signup_share_id")
    op.drop_column("users", "signup_source")
