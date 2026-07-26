"""Merge guest profiles and format preservation branches

Revision ID: e4f5a6b7c8d9
Revises: b2c3d4e5f6g8, d3e4f5a6b7c8
Create Date: 2026-07-27 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, tuple[str, ...], None] = ("b2c3d4e5f6g8", "d3e4f5a6b7c8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
