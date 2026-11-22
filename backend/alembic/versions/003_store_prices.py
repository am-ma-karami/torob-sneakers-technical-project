"""Domestic/foreign listings, unknown prices and sourced free-market exchange rates."""

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("offer_listings", "price", existing_type=sa.Numeric(14, 4), nullable=True)
    op.alter_column("offer_listings", "currency", existing_type=sa.String(3), nullable=True)
    op.add_column("offer_listings", sa.Column("market", sa.String(10)))
    op.create_check_constraint(
        "ck_offer_price_currency", "offer_listings", "price IS NULL OR currency IS NOT NULL"
    )
    op.create_check_constraint(
        "ck_offer_market", "offer_listings", "market IS NULL OR market IN ('iran', 'foreign')"
    )
    op.create_index("ix_offers_shoe_source_market", "offer_listings", ["shoe_id", "source", "market"])
    op.create_table(
        "exchange_rates",
        sa.Column("currency", sa.String(3), primary_key=True),
        sa.Column("toman_per_unit", sa.Numeric(18, 6), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("source_url", sa.String(240), nullable=False),
        sa.Column("source_time_label", sa.String(120), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "toman_per_unit > 0 AND toman_per_unit < 'Infinity'::numeric", name="ck_fx_positive"
        ),
    )


def downgrade():
    connection = op.get_bind()
    if connection.scalar(
        sa.text("SELECT count(*) FROM offer_listings WHERE price IS NULL OR currency IS NULL")
    ):
        raise RuntimeError("Cannot downgrade while unpriced store listings exist; preserve/export them first")
    op.drop_table("exchange_rates")
    op.drop_index("ix_offers_shoe_source_market", table_name="offer_listings")
    op.drop_constraint("ck_offer_market", "offer_listings")
    op.drop_constraint("ck_offer_price_currency", "offer_listings")
    op.drop_column("offer_listings", "market")
    op.alter_column("offer_listings", "currency", existing_type=sa.String(3), nullable=False)
    op.alter_column("offer_listings", "price", existing_type=sa.Numeric(14, 4), nullable=False)
