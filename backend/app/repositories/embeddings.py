import math
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.embeddings.documents import build_document
from app.embeddings.spec import DIMENSIONS, MODEL_KEY, MODEL_SPEC, RECIPE_VERSION
from app.models.catalog import Measurement, Shoe
from app.models.embeddings import EmbeddingModel, ProductEmbedding


def documents(session, shoe_ids=None, limit=None):
    query = select(Shoe).order_by(Shoe.id)
    if shoe_ids:
        query = query.where(Shoe.id.in_(shoe_ids))
    if limit:
        query = query.limit(limit)
    shoes = list(session.scalars(query))
    metrics = defaultdict(list)
    if shoes:
        for metric in session.scalars(select(Measurement).where(Measurement.shoe_id.in_([s.id for s in shoes]))):
            metrics[metric.shoe_id].append(metric)
    return [build_document(shoe, metrics[shoe.id]) for shoe in shoes]


def ensure_model(session):
    values = dict(key=MODEL_KEY, name=MODEL_SPEC["name"], revision=MODEL_SPEC["revision"],
                  dimensions=DIMENSIONS, recipe_version=RECIPE_VERSION, configuration=MODEL_SPEC)
    session.execute(insert(EmbeddingModel).values(**values).on_conflict_do_nothing())
    model = session.get(EmbeddingModel, MODEL_KEY)
    if model.configuration != MODEL_SPEC:
        raise ValueError("Embedding model descriptor does not match its key")


def existing_hashes(session, shoe_ids):
    if not shoe_ids:
        return {}
    return {(row.shoe_id, row.modality): row.content_hash for row in session.execute(
        select(ProductEmbedding.shoe_id, ProductEmbedding.modality, ProductEmbedding.content_hash)
        .where(ProductEmbedding.model_key == MODEL_KEY, ProductEmbedding.shoe_id.in_(shoe_ids))
    )}


def save_embedding(session, shoe_id, modality, vector, content_hash, provenance):
    if modality not in {"image", "text"}:
        raise ValueError("Unknown embedding modality")
    if len(vector) != DIMENSIONS or not all(math.isfinite(float(v)) for v in vector):
        raise ValueError("Expected 512 finite embedding components")
    if abs(math.sqrt(sum(float(v) ** 2 for v in vector)) - 1) >= 0.0001:
        raise ValueError("Embedding must be L2 normalized")
    statement = insert(ProductEmbedding).values(
        shoe_id=shoe_id, model_key=MODEL_KEY, modality=modality, embedding=vector,
        content_hash=content_hash, provenance=provenance,
    )
    session.execute(statement.on_conflict_do_update(
        index_elements=["shoe_id", "model_key", "modality"],
        set_={"embedding": statement.excluded.embedding, "content_hash": content_hash,
              "provenance": provenance, "updated_at": func.now()},
        where=ProductEmbedding.content_hash != content_hash,
    ))


def coverage(session):
    rows = session.execute(
        select(ProductEmbedding.modality, func.count()).where(ProductEmbedding.model_key == MODEL_KEY)
        .group_by(ProductEmbedding.modality)
    ).all()
    counts = dict(rows)
    complete = session.scalar(select(func.count()).select_from(
        select(ProductEmbedding.shoe_id).where(ProductEmbedding.model_key == MODEL_KEY)
        .group_by(ProductEmbedding.shoe_id).having(func.count() == 2).subquery()
    ))
    return dict(model_key=MODEL_KEY, catalog_products=session.scalar(select(func.count()).select_from(Shoe)),
                text=counts.get("text", 0), image=counts.get("image", 0), both=complete)
