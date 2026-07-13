"""add pdf_error_log to jobs

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2025-01-12 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'k2l3m4n5o6p7'
down_revision: Union[str, None] = 'j1k2l3m4n5o6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add pdf_error_log column to jobs table for storing LaTeX compilation errors
    op.add_column('jobs', sa.Column('pdf_error_log', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'pdf_error_log')
