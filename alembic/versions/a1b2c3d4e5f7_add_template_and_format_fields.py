"""Add template_id to jobs; profile source_format, docx path, layout_signals

Revision ID: a1b2c3d4e5f7
Revises: z8a9b0c1d2e3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "z8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("template_id", sa.String(length=32), server_default="classic", nullable=False),
    )
    op.add_column("jobs", sa.Column("preserved_docx_path", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("docx_source", sa.String(length=16), nullable=True))

    op.add_column("profiles", sa.Column("source_format", sa.String(length=8), nullable=True))
    op.add_column("profiles", sa.Column("original_docx_path", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("layout_signals", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "layout_signals")
    op.drop_column("profiles", "original_docx_path")
    op.drop_column("profiles", "source_format")
    op.drop_column("jobs", "docx_source")
    op.drop_column("jobs", "preserved_docx_path")
    op.drop_column("jobs", "template_id")
