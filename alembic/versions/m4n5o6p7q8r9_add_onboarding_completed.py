"""add_onboarding_completed

Revision ID: m4n5o6p7q8r9
Revises: l3m4n5o6p7q8
Create Date: 2024-12-15 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm4n5o6p7q8r9'
down_revision: Union[str, None] = 'l3m4n5o6p7q8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add onboarding_completed flag to users table.
    
    Tracks whether user has completed the initial onboarding flow.
    Used to show welcome modal and empty state guidance only to new users.
    """
    # Add onboarding_completed column with default False
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Remove onboarding_completed column."""
    op.drop_column('users', 'onboarding_completed')
