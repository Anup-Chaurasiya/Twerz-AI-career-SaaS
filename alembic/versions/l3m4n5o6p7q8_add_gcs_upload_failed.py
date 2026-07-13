"""add_gcs_upload_failed

Revision ID: l3m4n5o6p7q8
Revises: k2l3m4n5o6p7
Create Date: 2024-12-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l3m4n5o6p7q8'
down_revision: Union[str, None] = 'k2l3m4n5o6p7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add gcs_upload_failed flag to jobs table.
    
    This tracks when GCS upload fails after multiple retries, so the system
    knows to fall back to local storage or regenerate from LaTeX.
    
    Critical for Cloud Run where ephemeral filesystem means local PDFs
    disappear on container restart.
    """
    # Add gcs_upload_failed column with default False
    op.add_column('jobs', sa.Column('gcs_upload_failed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Remove gcs_upload_failed column."""
    op.drop_column('jobs', 'gcs_upload_failed')
