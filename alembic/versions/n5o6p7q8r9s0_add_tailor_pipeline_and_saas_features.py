"""add_tailor_pipeline_and_saas_features

Revision ID: n5o6p7q8r9s0
Revises: m4n5o6p7q8r9
Create Date: 2026-07-20 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n5o6p7q8r9s0"
down_revision: Union[str, None] = "m4n5o6p7q8r9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Job tailor + tracker fields
    op.add_column("jobs", sa.Column("jd_analysis", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("evidence_map", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("fit_score", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("fit_label", sa.String(length=32), nullable=True))
    op.add_column("jobs", sa.Column("fit_rationale", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("gap_list", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("ats_score_before", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("ats_score_after", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("ats_score_detail", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("resume_versions", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("cover_letter", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("interview_packet", sa.JSON(), nullable=True))

    application_status = sa.Enum(
        "SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN",
        name="applicationstatus",
    )
    application_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "jobs",
        sa.Column(
            "application_status",
            application_status,
            nullable=False,
            server_default="SAVED",
        ),
    )
    op.add_column("jobs", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("follow_up_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("application_notes", sa.Text(), nullable=True))

    # Subscription plans + user subscriptions (Phase 3)
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("monthly_credits", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("price_paise", sa.Integer(), nullable=False),
        sa.Column("includes_tracker", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("includes_interview_packets", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("includes_extension", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("razorpay_subscription_id", sa.String(length=128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_subscriptions_user_id", "user_subscriptions", ["user_id"])

    # In-app notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False, server_default="info"),
        sa.Column("link", sa.String(length=512), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # Seed Job Hunt Pro plan
    op.execute(
        """
        INSERT INTO subscription_plans
          (name, monthly_credits, price_paise, includes_tracker, includes_interview_packets, includes_extension, is_active, sort_order)
        VALUES
          ('Job Hunt Pro', 40, 39900, true, true, true, true, 1)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_user_subscriptions_user_id", table_name="user_subscriptions")
    op.drop_table("user_subscriptions")
    op.drop_table("subscription_plans")

    op.drop_column("jobs", "application_notes")
    op.drop_column("jobs", "follow_up_at")
    op.drop_column("jobs", "applied_at")
    op.drop_column("jobs", "application_status")
    op.execute("DROP TYPE IF EXISTS applicationstatus")

    op.drop_column("jobs", "interview_packet")
    op.drop_column("jobs", "cover_letter")
    op.drop_column("jobs", "resume_versions")
    op.drop_column("jobs", "ats_score_detail")
    op.drop_column("jobs", "ats_score_after")
    op.drop_column("jobs", "ats_score_before")
    op.drop_column("jobs", "gap_list")
    op.drop_column("jobs", "fit_rationale")
    op.drop_column("jobs", "fit_label")
    op.drop_column("jobs", "fit_score")
    op.drop_column("jobs", "evidence_map")
    op.drop_column("jobs", "jd_analysis")
