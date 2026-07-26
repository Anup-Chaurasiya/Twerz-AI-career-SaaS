"""Add profile upload metadata (GCS path + upload source)

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-07-27 00:05:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

upload_source_enum = sa.Enum("guest", "authenticated", name="uploadsource")


def upgrade() -> None:
    upload_source_enum.create(op.get_bind(), checkfirst=True)
    op.add_column("profiles", sa.Column("upload_gcs_path", sa.Text(), nullable=True))
    op.add_column(
        "profiles",
        sa.Column(
            "upload_source",
            upload_source_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "upload_source")
    op.drop_column("profiles", "upload_gcs_path")
    upload_source_enum.drop(op.get_bind(), checkfirst=True)
