"""fix Job Hunt Pro subscription pricing and monthly credits

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-07-27 01:00:00.000000

Pro must beat Starter on value: 800 credits/mo @ ₹299 vs 500 credits one-time @ ₹249,
plus tracker, interview packets, and extension access.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "h7i8j9k0l1m2"
down_revision: Union[str, None] = "g6h7i8j9k0l1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE subscription_plans
        SET monthly_credits = 800, price_paise = 29900
        WHERE name = 'Job Hunt Pro'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE subscription_plans
        SET monthly_credits = 500, price_paise = 34900
        WHERE name = 'Job Hunt Pro'
        """
    )
