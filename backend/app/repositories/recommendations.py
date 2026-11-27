"""Eligibility and same-product vector evidence; no provider/model decisions here."""
from sqlalchemy import select

from app.embeddings.spec import MODEL_KEY
from app.models.catalog import Brand, Measurement, Shoe
from app.models.embeddings import ProductEmbedding
from app.repositories.catalog import CatalogRepository
from app.repositories.embeddings import documents
from app.schemas.catalog import CatalogQuery


def known_brands(session):
    return list(session.scalars(select(Brand.name).order_by(Brand.name)))


def conditions(hard, legacy=None):
    fields = {k: v for k, v in hard.model_dump().items() if not k.endswith("_exclusive")}
    query = CatalogQuery.model_validate(fields)
    result = CatalogRepository.conditions(query)
    if legacy is not None:
        result += CatalogRepository.conditions(legacy.model_copy(update={"q": ""}))
    for prefix, metric_key, unit, column in [
        ("weight", "weight_g", "g", Shoe.weight), ("drop", "drop_mm", "mm", Shoe.drop)
    ]:
        if any(getattr(hard, prefix + "_" + side) is not None for side in ("min", "max")):
            result.append(select(Measurement.shoe_id).where(
                Measurement.shoe_id == Shoe.id, Measurement.key == metric_key, Measurement.unit == unit,
                Measurement.value == column,
                Measurement.provenance["origin"].as_string().in_(["lab_measured", "manufacturer_stated"]),
            ).exists())
        for side in ("min", "max"):
            key = prefix + "_" + side
            value = getattr(hard, key)
            if value is not None and getattr(hard, key + "_exclusive"):
                result.append(column > value if side == "min" else column < value)
    return result


def eligible(session, hard, legacy=None, identifiers=None):
    statement = select(Shoe).where(*conditions(hard, legacy)).order_by(Shoe.id)
    if identifiers is not None:
        statement = statement.where(Shoe.id.in_(identifiers)).execution_options(populate_existing=True)
    return list(session.scalars(statement))


def evidence(session, products):
    ids = [p.id for p in products]
    return {doc.shoe_id: doc for doc in documents(session, ids)} if ids else {}


def semantic_scores(session, docs, vector):
    values: dict[int, dict[str, float]] = {sid: {} for sid in docs}
    if not docs:
        return values
    rows = session.execute(select(
        ProductEmbedding.shoe_id, ProductEmbedding.modality, ProductEmbedding.content_hash,
        ProductEmbedding.provenance, ProductEmbedding.embedding.cosine_distance(vector).label("distance"),
    ).where(ProductEmbedding.model_key == MODEL_KEY, ProductEmbedding.shoe_id.in_(list(docs))))
    for row in rows:
        doc = docs[row.shoe_id]
        fresh = (row.content_hash == doc.content_hash if row.modality == "text"
                 else row.provenance.get("source_url") == doc.image_url)
        if fresh:
            values[row.shoe_id][row.modality] = max(0., min(1., 1 - float(row.distance)))
    return values
