"""realign one-time credit pack prices with Job Hunt Pro economics

Revision ID: i8j9k9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-07-27 02:00:00.000000

Pro baseline: 800 credits @ ₹299/mo (~₹0.37/credit).
One-time packs carry a modest premium on smaller tiers; Job Hunt bulk is best ₹/credit on packs.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "i8j9k0l1m2n3"
down_revision: Union[str, None] = "h7i8j9k0l1m2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 27900, updated_at = now()
        WHERE name = 'Starter' AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 59900, updated_at = now()
        WHERE name = 'Sprint' AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 94900, updated_at = now()
        WHERE name = 'Job Hunt' AND is_active = true
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 24900, updated_at = now()
        WHERE name = 'Starter' AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 54900, updated_at = now()
        WHERE name = 'Sprint' AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE credit_packs SET price_paise = 99900, updated_at = now()
        WHERE name = 'Job Hunt' AND is_active = true
        """
    )
