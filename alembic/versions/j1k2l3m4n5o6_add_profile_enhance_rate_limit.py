"""add profile enhance rate limit

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
Create Date: 2025-01-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'j1k2l3m4n5o6'
down_revision: Union[str, None] = 'i0j1k2l3m4n5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add enhance rate limiting columns to profiles table
    op.add_column('profiles', sa.Column('enhance_count_today', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('profiles', sa.Column('enhance_reset_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('profiles', 'enhance_reset_at')
    op.drop_column('profiles', 'enhance_count_today')
