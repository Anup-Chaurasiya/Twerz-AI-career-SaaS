"""Add original_page_count on profiles and page count fields on jobs."""

from alembic import op
import sqlalchemy as sa

revision = "a0b1c2d3e4f5"
down_revision = "z8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("original_page_count", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("target_page_count", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("pdf_page_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "pdf_page_count")
    op.drop_column("jobs", "target_page_count")
    op.drop_column("profiles", "original_page_count")
