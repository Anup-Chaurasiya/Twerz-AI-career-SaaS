"""realign credit pricing packs and daily pool semantics

Revision ID: g6h7i8j9k0l1
Revises: f5a6b7c8d9e0
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "g6h7i8j9k0l1"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Deactivate legacy packs (preserve purchase history)
    op.execute(
        """
        UPDATE credit_packs
        SET is_active = false
        WHERE name IN ('Day Pass', 'Sprint', 'Job Hunt')
        """
    )

    # Insert realigned packs: Starter 500@₹249, Sprint 1200@₹549, Job Hunt 2500@₹999
    op.execute(
        """
        INSERT INTO credit_packs (name, credits, price_paise, is_active, sort_order, created_at, updated_at)
        SELECT v.name, v.credits, v.price_paise, v.is_active, v.sort_order, now(), now()
        FROM (VALUES
            ('Starter',  500, 24900, true, 1),
            ('Sprint',  1200, 54900, true, 2),
            ('Job Hunt', 2500, 99900, true, 3)
        ) AS v(name, credits, price_paise, is_active, sort_order)
        WHERE NOT EXISTS (
            SELECT 1 FROM credit_packs cp
            WHERE cp.name = v.name AND cp.is_active = true
        )
        """
    )

    # Job Hunt Pro: align monthly grant with new economics
    op.execute(
        """
        UPDATE subscription_plans
        SET monthly_credits = 500, price_paise = 34900
        WHERE name = 'Job Hunt Pro'
        """
    )

    # Reset daily pool counters (generation-count → credit-unit semantics)
    op.execute("UPDATE user_credits SET daily_free_used = 0")


def downgrade() -> None:
    op.execute(
        """
        UPDATE credit_packs SET is_active = false
        WHERE name IN ('Starter', 'Sprint', 'Job Hunt') AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE credit_packs SET is_active = true
        WHERE name IN ('Day Pass', 'Sprint', 'Job Hunt')
        """
    )
    op.execute(
        """
        UPDATE subscription_plans
        SET monthly_credits = 40, price_paise = 39900
        WHERE name = 'Job Hunt Pro'
        """
    )
