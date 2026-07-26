"""Add format preservation v2 fields (PDF index, output_mode)

Revision ID: b2c3d4e5f6g8
Revises: a1b2c3d4e5f7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6g8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("original_pdf_path", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("docx_field_index", sa.JSON(), nullable=True))
    op.add_column("profiles", sa.Column("pdf_field_index", sa.JSON(), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("preservation_eligible", sa.Boolean(), server_default="true", nullable=False),
    )

    op.add_column("jobs", sa.Column("preserved_pdf_path", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("pdf_source", sa.String(length=16), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("output_mode", sa.String(length=24), server_default="preserve_original", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("jobs", "output_mode")
    op.drop_column("jobs", "pdf_source")
    op.drop_column("jobs", "preserved_pdf_path")
    op.drop_column("profiles", "preservation_eligible")
    op.drop_column("profiles", "pdf_field_index")
    op.drop_column("profiles", "docx_field_index")
    op.drop_column("profiles", "original_pdf_path")
