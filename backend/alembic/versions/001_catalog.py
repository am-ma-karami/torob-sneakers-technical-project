"""Initial catalog, provenance, variant and source archive storage."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table("brands", sa.Column("name", sa.String(120), primary_key=True))
    op.create_table(
        "categories",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("label", sa.String(100), nullable=False),
    )
    op.create_table(
        "families",
        sa.Column("id", sa.String(220), primary_key=True),
        sa.Column("brand", sa.String(120), sa.ForeignKey("brands.name"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
    )
    op.create_table(
        "shoes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=False),
        sa.Column("slug", sa.String(240), unique=True, nullable=False),
        sa.Column("name", sa.String(240), nullable=False),
        sa.Column("brand", sa.String(120), sa.ForeignKey("brands.name"), nullable=False),
        sa.Column("family_id", sa.String(220), sa.ForeignKey("families.id"), nullable=False),
        sa.Column("search_text", sa.Text, nullable=False),
        sa.Column("facets", pg.JSONB, nullable=False),
        sa.Column("summary", pg.JSONB, nullable=False),
        sa.Column("detail", pg.JSONB, nullable=False),
        *[
            sa.Column(k, sa.Float)
            for k in ["weight", "price_usd", "score", "heel", "forefoot", "drop", "internal_width"]
        ],
    )
    for col in ["brand", "family_id"]:
        op.create_index("ix_shoes_" + col, "shoes", [col])
    for col in ["weight", "price_usd", "score"]:
        op.create_index("ix_shoes_" + col + "_id", "shoes", [col, "id"])
    op.create_index("ix_shoes_facets_gin", "shoes", ["facets"], postgresql_using="gin")
    op.create_index(
        "ix_shoes_search_trgm",
        "shoes",
        ["search_text"],
        postgresql_using="gin",
        postgresql_ops={"search_text": "gin_trgm_ops"},
    )
    op.create_table(
        "measurements",
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("provenance", pg.JSONB, nullable=False),
    )
    for name in ["variants", "offers"]:
        op.create_table(
            name,
            sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("key", sa.String(100), primary_key=True),
            sa.Column("payload", pg.JSONB, nullable=False),
        )
    op.create_table(
        "source_payloads",
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("payload", pg.JSONB, nullable=False),
    )


def downgrade():
    for name in [
        "source_payloads",
        "offers",
        "variants",
        "measurements",
        "shoes",
        "families",
        "categories",
        "brands",
    ]:
        op.drop_table(name)
