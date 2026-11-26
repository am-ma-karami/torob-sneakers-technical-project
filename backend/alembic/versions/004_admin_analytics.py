"""Admin access and daily unique browser/store funnel measurements."""

import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(240), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False),
    )
    op.create_table(
        "admin_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_admin_sessions_user_id", "admin_sessions", ["user_id"])
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"])
    op.create_table(
        "admin_login_throttles",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("failures", sa.Integer, nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "store_traffic_daily",
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id"), primary_key=True),
        sa.Column("source", sa.String(80), primary_key=True),
        sa.Column("retailer_id", sa.String(120), primary_key=True),
        sa.Column("visitor_hash", sa.String(64), primary_key=True),
        sa.Column("event_kind", sa.String(12), primary_key=True),
        sa.Column("event_day", sa.Date, primary_key=True),
        sa.Column("retailer_name", sa.String(200), nullable=False),
        sa.Column("market", sa.String(10)),
        sa.CheckConstraint("event_kind IN ('impression', 'click')", name="ck_traffic_kind"),
    )
    op.create_index(
        "ix_traffic_day_source_pair", "store_traffic_daily", ["event_day", "source", "shoe_id", "retailer_id"]
    )


def downgrade():
    for table in ("store_traffic_daily", "admin_login_throttles", "admin_sessions", "admin_users"):
        op.drop_table(table)
