"""Versioned, separate CLIP image/text vectors for canonical products."""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import VECTOR
from sqlalchemy.dialects.postgresql import JSONB

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    # Extension belongs to public, never a disposable test/tenant schema.
    # The database server must already have the pgvector extension installed.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public")
    op.create_table(
        "embedding_models",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("revision", sa.String(40), nullable=False),
        sa.Column("dimensions", sa.Integer, nullable=False),
        sa.Column("recipe_version", sa.String(40), nullable=False),
        sa.Column("configuration", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("dimensions = 512", name="ck_embedding_model_dimensions"),
    )
    op.create_table(
        "product_embeddings",
        sa.Column("shoe_id", sa.Integer, sa.ForeignKey("shoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("model_key", sa.String(64), sa.ForeignKey("embedding_models.key"), primary_key=True),
        sa.Column("modality", sa.String(10), primary_key=True),
        sa.Column("embedding", VECTOR(512), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("provenance", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("modality IN ('text', 'image')", name="ck_product_embedding_modality"),
        sa.CheckConstraint("abs(vector_norm(embedding) - 1) < 0.0001", name="ck_product_embedding_unit_norm"),
    )
    # No approximate-search index until the retrieval stage is designed/evaluated.
    op.create_index("ix_product_embeddings_model_modality", "product_embeddings", ["model_key", "modality"])


def downgrade():
    op.drop_table("product_embeddings")
    op.drop_table("embedding_models")
    # vector may belong to other applications; don't DROP EXTENSION.
