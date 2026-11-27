from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import VECTOR
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class EmbeddingModel(Base):
    __tablename__ = "embedding_models"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    revision: Mapped[str] = mapped_column(String(40))
    dimensions: Mapped[int] = mapped_column(Integer)
    recipe_version: Mapped[str] = mapped_column(String(40))
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("dimensions = 512", name="ck_embedding_model_dimensions"),)


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True)
    model_key: Mapped[str] = mapped_column(ForeignKey("embedding_models.key"), primary_key=True)
    modality: Mapped[str] = mapped_column(String(10), primary_key=True)
    embedding: Mapped[Any] = mapped_column(VECTOR(512))
    content_hash: Mapped[str] = mapped_column(String(64))
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("modality IN ('text', 'image')", name="ck_product_embedding_modality"),
        CheckConstraint("abs(vector_norm(embedding) - 1) < 0.0001", name="ck_product_embedding_unit_norm"),
        Index("ix_product_embeddings_model_modality", "model_key", "modality"),
    )
