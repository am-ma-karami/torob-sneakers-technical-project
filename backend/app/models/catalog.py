from typing import Any

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
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
        Index("ix_shoes_price_id", "price_usd", "id"),
        Index("ix_shoes_score_id", "score", "id"),
    )


class Measurement(Base):
    __tablename__ = "measurements"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(50))
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Variant(Base):
    __tablename__ = "variants"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Offer(Base):
    __tablename__ = "offers"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class SourcePayload(Base):
    __tablename__ = "source_payloads"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
