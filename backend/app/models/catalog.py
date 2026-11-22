from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Brand(Base):
    __tablename__ = "brands"
    name: Mapped[str] = mapped_column(String(120), primary_key=True)


class Category(Base):
    __tablename__ = "categories"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    label: Mapped[str] = mapped_column(String(100))


class Family(Base):
    __tablename__ = "families"
    id: Mapped[str] = mapped_column(String(220), primary_key=True)
    brand: Mapped[str] = mapped_column(ForeignKey("brands.name"))
    name: Mapped[str] = mapped_column(String(200))


class Shoe(Base):
    __tablename__ = "shoes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True)
    name: Mapped[str] = mapped_column(String(240))
    brand: Mapped[str] = mapped_column(ForeignKey("brands.name"), index=True)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id"), index=True)
    search_text: Mapped[str] = mapped_column(Text)
    facets: Mapped[dict[str, list[str]]] = mapped_column(JSONB)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB)
    weight: Mapped[float | None] = mapped_column(Float)
    price_usd: Mapped[float | None] = mapped_column(Float)
    score: Mapped[float | None] = mapped_column(Float)
    heel: Mapped[float | None] = mapped_column(Float)
    forefoot: Mapped[float | None] = mapped_column(Float)
    drop: Mapped[float | None] = mapped_column(Float)
    internal_width: Mapped[float | None] = mapped_column(Float)
    __table_args__ = (
        Index("ix_shoes_facets_gin", "facets", postgresql_using="gin"),
        Index(
            "ix_shoes_search_trgm",
            "search_text",
            postgresql_using="gin",
            postgresql_ops={"search_text": "gin_trgm_ops"},
        ),
        Index("ix_shoes_weight_id", "weight", "id"),
        Index("ix_shoes_price_usd_id", "price_usd", "id"),
        Index("ix_shoes_score_id", "score", "id"),
    )


class Measurement(Base):
    __tablename__ = "measurements"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(50))
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB)
    owner: Mapped[str] = mapped_column(String(80), server_default="catalog")


class Variant(Base):
    __tablename__ = "variants"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    owner: Mapped[str] = mapped_column(String(80), server_default="catalog")


class LegacyOffer(Base):
    """Immutable migration archive; retained until an explicit archival retention decision."""

    __tablename__ = "offers"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class SourceProduct(Base):
    __tablename__ = "source_products"
    source: Mapped[str] = mapped_column(String(80), primary_key=True)
    external_id: Mapped[str] = mapped_column(String(240), primary_key=True)
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), index=True)
    variant_key: Mapped[str | None] = mapped_column(String(100))
    sku: Mapped[str | None] = mapped_column(String(120))
    gtin: Mapped[str | None] = mapped_column(String(14))
    __table_args__ = (
        ForeignKeyConstraint(["shoe_id", "variant_key"], ["variants.shoe_id", "variants.key"]),
        UniqueConstraint("source", "external_id", "shoe_id", name="uq_source_product_shoe"),
        UniqueConstraint("source", "external_id", "shoe_id", "variant_key", name="uq_source_product_variant"),
    )


class Offer(Base):
    __tablename__ = "offer_listings"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    source: Mapped[str] = mapped_column(String(80))
    source_product_id: Mapped[str] = mapped_column(String(240))
    retailer_id: Mapped[str] = mapped_column(String(120))
    variant_key: Mapped[str | None] = mapped_column(String(100))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    currency: Mapped[str] = mapped_column(String(3))
    country: Mapped[str | None] = mapped_column(String(2))
    availability: Mapped[str] = mapped_column(String(20))
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    __table_args__ = (
        UniqueConstraint("key", name="uq_offer_identity"),
        ForeignKeyConstraint(["shoe_id", "variant_key"], ["variants.shoe_id", "variants.key"]),
        ForeignKeyConstraint(
            ["source", "source_product_id", "shoe_id"],
            ["source_products.source", "source_products.external_id", "source_products.shoe_id"],
        ),
        ForeignKeyConstraint(
            ["source", "source_product_id", "shoe_id", "variant_key"],
            [
                "source_products.source",
                "source_products.external_id",
                "source_products.shoe_id",
                "source_products.variant_key",
            ],
        ),
        CheckConstraint("price >= 0 AND price < 'Infinity'::numeric", name="ck_offer_price"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_offer_currency"),
        CheckConstraint(
            "availability IN ('in_stock', 'out_of_stock', 'unknown')", name="ck_offer_availability"
        ),
        CheckConstraint(
            "expires_at IS NULL OR (checked_at IS NOT NULL AND expires_at >= checked_at)",
            name="ck_offer_expiry",
        ),
        Index("ix_offers_shoe_currency_price", "shoe_id", "currency", "price", "key"),
        Index("ix_offers_source_market", "source", "country", "retailer_id"),
    )


class OfferObservation(Base):
    __tablename__ = "offer_observations"
    shoe_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    offer_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    __table_args__ = (
        ForeignKeyConstraint(
            ["shoe_id", "offer_key"], ["offer_listings.shoe_id", "offer_listings.key"], ondelete="CASCADE"
        ),
    )


class OfferRefreshState(Base):
    __tablename__ = "offer_refresh_state"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    source: Mapped[str] = mapped_column(String(80), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OfferRejection(Base):
    __tablename__ = "offer_rejections"
    fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(String(200))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class SourcePayload(Base):
    __tablename__ = "source_payloads"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
