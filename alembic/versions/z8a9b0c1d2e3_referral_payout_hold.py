"""Referral payout hold + user referral_bonus_status

Revision ID: z8a9b0c1d2e3
Revises: y6z7a8b9c0d1
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


revision: str = "z8a9b0c1d2e3"
down_revision: Union[str, None] = "y6z7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("referral_bonus_status", sa.String(length=16), server_default="none", nullable=False),
    )
    # Backfill legacy boolean: granted -> paid
    op.execute(
        "UPDATE users SET referral_bonus_status = 'paid' WHERE referral_bonus_granted = true"
    )

    op.create_table(
        "referral_payout_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("referrer_id", sa.String(), nullable=False),
        sa.Column("referred_id", sa.String(), nullable=False),
        sa.Column("signals", JSON, nullable=False),
        sa.Column("bonus_amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("reviewed_by_admin_id", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["referrer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referred_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_admin_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_referral_payout_reviews_referrer_id", "referral_payout_reviews", ["referrer_id"])
    op.create_index("ix_referral_payout_reviews_referred_id", "referral_payout_reviews", ["referred_id"])
    op.create_index("ix_referral_payout_reviews_status", "referral_payout_reviews", ["status"])
    op.create_index(
        "ix_referral_payout_reviews_pair",
        "referral_payout_reviews",
        ["referrer_id", "referred_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_referral_payout_reviews_pair", table_name="referral_payout_reviews")
    op.drop_index("ix_referral_payout_reviews_status", table_name="referral_payout_reviews")
    op.drop_index("ix_referral_payout_reviews_referred_id", table_name="referral_payout_reviews")
    op.drop_index("ix_referral_payout_reviews_referrer_id", table_name="referral_payout_reviews")
    op.drop_table("referral_payout_reviews")
    op.drop_column("users", "referral_bonus_status")
