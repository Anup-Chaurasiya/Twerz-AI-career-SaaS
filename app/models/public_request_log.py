from sqlalchemy import String, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class PublicRequestLog(TimestampMixin, Base):
    __tablename__ = "public_request_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    ip: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_public_request_logs_created_at", "created_at"),
    )
