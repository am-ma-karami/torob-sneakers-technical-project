"""Typed commerce, exact source mappings and retained legacy offer archive.

The original `offers` table remains untouched for audit/recovery. Legacy listings are
validated and copied into the new store; rejected records are retained separately.
"""

import hashlib
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("measurements", "variants"):
        op.add_column(table, sa.Column("owner", sa.String(80), nullable=False, server_default="catalog"))
    op.create_table(
        "source_products",
        sa.Column("source", sa.String(80), primary_key=True),
        sa.Column("external_id", sa.String(240), primary_key=True),
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_key", sa.String(100)),
        sa.Column("sku", sa.String(120)),
        sa.Column("gtin", sa.String(14)),
        sa.ForeignKeyConstraint(["shoe_id", "variant_key"], ["variants.shoe_id", "variants.key"]),
        sa.UniqueConstraint("source", "external_id", "shoe_id", name="uq_source_product_shoe"),
        sa.UniqueConstraint(
            "source", "external_id", "shoe_id", "variant_key", name="uq_source_product_variant"
        ),
    )
    op.create_index("ix_source_products_shoe_id", "source_products", ["shoe_id"])
    op.create_table(
        "offer_listings",
        sa.UniqueConstraint("key", name="uq_offer_identity"),
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("source_product_id", sa.String(240), nullable=False),
        sa.Column("retailer_id", sa.String(120), nullable=False),
        sa.Column("variant_key", sa.String(100)),
        sa.Column("price", sa.Numeric(14, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("country", sa.String(2)),
        sa.Column("availability", sa.String(20), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("payload", pg.JSONB, nullable=False),
        sa.ForeignKeyConstraint(["shoe_id", "variant_key"], ["variants.shoe_id", "variants.key"]),
        sa.ForeignKeyConstraint(
            ["source", "source_product_id", "shoe_id"],
            ["source_products.source", "source_products.external_id", "source_products.shoe_id"],
        ),
        sa.ForeignKeyConstraint(
            ["source", "source_product_id", "shoe_id", "variant_key"],
            [
                "source_products.source",
                "source_products.external_id",
                "source_products.shoe_id",
                "source_products.variant_key",
            ],
        ),
        sa.CheckConstraint("price >= 0 AND price < 'Infinity'::numeric", name="ck_offer_price"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_offer_currency"),
        sa.CheckConstraint(
            "availability IN ('in_stock', 'out_of_stock', 'unknown')", name="ck_offer_availability"
        ),
        sa.CheckConstraint(
            "expires_at IS NULL OR (checked_at IS NOT NULL AND expires_at >= checked_at)",
            name="ck_offer_expiry",
        ),
    )
    op.create_index(
        "ix_offers_shoe_currency_price", "offer_listings", ["shoe_id", "currency", "price", "key"]
    )
    op.create_index("ix_offers_source_market", "offer_listings", ["source", "country", "retailer_id"])
    op.create_table(
        "offer_refresh_state",
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source", sa.String(80), primary_key=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "offer_observations",
        sa.Column("shoe_id", sa.Integer, primary_key=True),
        sa.Column("offer_key", sa.String(100), primary_key=True),
        sa.Column("fingerprint", sa.String(64), primary_key=True),
        sa.Column("payload", pg.JSONB, nullable=False),
        sa.ForeignKeyConstraint(
            ["shoe_id", "offer_key"], ["offer_listings.shoe_id", "offer_listings.key"], ondelete="CASCADE"
        ),
    )
    op.create_table(
        "offer_rejections",
        sa.Column("fingerprint", sa.String(64), primary_key=True),
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("reason", sa.String(200), nullable=False),
        sa.Column("payload", pg.JSONB, nullable=False),
    )
    op.create_index("ix_offer_rejections_shoe_id", "offer_rejections", ["shoe_id"])
    _copy_legacy()


def _copy_legacy():
    # This adapter copies the v001 JSON contract. Unknown merchants/invalid records
    # stay in both the original archive and rejection storage, never as buy links.
    from app.schemas.offers import OfferInput
    from pydantic import ValidationError

    connection = op.get_bind()
    metadata = sa.MetaData()
    tables = {
        name: sa.Table(name, metadata, autoload_with=connection)
        for name in ("source_products", "offer_listings", "offer_observations", "offer_rejections")
    }
    retailer_ids = dict(
        zip(
            [
                "RunningXpert",
                "Amazon",
                "adidas",
                "SportsShoes",
                "size?",
                "Sports Direct",
                "365Rider",
                "ASICS DE",
                "Saucony",
                "i-Run",
                "Running Warehouse",
                "New Balance",
                "Hardloop",
                "Laufbar",
                "PUMA",
                "Modivo",
                "HOKA",
                "On DE",
                "HUMANIC",
                "eBay",
                "Merrell",
            ],
            [
                "526",
                "69",
                "581",
                "287",
                "724",
                "485",
                "572",
                "388",
                "493",
                "549",
                "198",
                "516",
                "462",
                "1341",
                "427",
                "1226",
                "418",
                "592",
                "700",
                "280",
                "355",
            ],
            strict=True,
        )
    )

    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

    for shoe_id, payload in connection.execute(sa.text("SELECT shoe_id, payload FROM offers")):
        source = payload.get("source", "legacy")
        retailer = payload.get("retailer", "")
        variant = payload.get("variant_key")
        retailer_id = retailer_ids.get(retailer, "unknown") if source == "RunRepeat" else retailer
        try:
            value = OfferInput.model_validate(
                dict(
                    source=source,
                    external_id=digest([retailer_id, variant, payload.get("url")]),
                    source_product_id=f"{shoe_id}:{variant or 'any'}",
                    retailer_id=retailer_id,
                    retailer=retailer,
                    variant_key=variant,
                    price=payload.get("price"),
                    currency=payload.get("currency"),
                    country=payload.get("country"),
                    url=payload.get("url"),
                    snapshot=payload.get("snapshot"),
                    colorway=payload.get("colorway"),
                    availability="unknown",
                )
            )
        except ValidationError:
            connection.execute(
                pg.insert(tables["offer_rejections"])
                .values(
                    fingerprint=digest([shoe_id, payload]),
                    shoe_id=shoe_id,
                    source=source,
                    reason="invalid_legacy_offer",
                    payload=payload,
                )
                .on_conflict_do_nothing()
            )
            continue
        normalized = value.model_dump(mode="json")
        connection.execute(
            pg.insert(tables["source_products"])
            .values(
                source=source,
                external_id=value.source_product_id,
                shoe_id=shoe_id,
                variant_key=variant,
            )
            .on_conflict_do_nothing()
        )
        connection.execute(
            pg.insert(tables["offer_listings"])
            .values(
                shoe_id=shoe_id,
                key=value.key,
                source=source,
                source_product_id=value.source_product_id,
                retailer_id=retailer_id,
                variant_key=variant,
                price=value.price,
                currency=value.currency,
                country=value.country,
                availability="unknown",
                payload=normalized,
            )
            .on_conflict_do_nothing()
        )
        connection.execute(
            pg.insert(tables["offer_observations"])
            .values(
                shoe_id=shoe_id,
                offer_key=value.key,
                fingerprint=digest(normalized),
                payload=normalized,
            )
            .on_conflict_do_nothing()
        )


def downgrade():
    for table in (
        "offer_rejections",
        "offer_refresh_state",
        "offer_observations",
        "offer_listings",
        "source_products",
    ):
        op.drop_table(table)
    for table in ("variants", "measurements"):
        op.drop_column(table, "owner")
