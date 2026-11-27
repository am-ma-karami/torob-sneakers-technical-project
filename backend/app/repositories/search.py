from collections import defaultdict

from sqlalchemy import and_, func, or_, select

from app.core.taxonomy import normalize
from app.embeddings.spec import MODEL_KEY
from app.models.catalog import Shoe
from app.models.embeddings import ProductEmbedding
from app.repositories.catalog import CatalogRepository
from app.repositories.embeddings import documents
from app.services.presentation import reference_price


def fuse(channels):
    scores: dict[int, float] = defaultdict(float)
    reasons: dict[int, dict[str, int]] = defaultdict(dict)
    for channel, weight, identifiers in channels:
        for rank, sid in enumerate(identifiers, 1):
            scores[sid] += weight / (60 + rank)
            reasons[sid][channel] = rank
    return sorted(scores, key=lambda sid: (-scores[sid], sid)), scores, reasons


def retrieve(session, request, english, vector, degraded=None):
    # Explicit structured filters remain hard SQL constraints, never model-generated SQL.
    filters = request.filters.model_copy(update={"q": ""})
    where = CatalogRepository.conditions(filters)
    lexical: list[int] = []
    for value in dict.fromkeys([normalize(request.q), normalize(english)]):
        terms = [t for t in value.split() if t not in {"a", "an", "the", "on", "for", "with", "to", "of", "and", "in"}]
        if not terms:
            continue
        matches = [Shoe.search_text.ilike("%" + t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%", escape="\\") for t in terms]
        similarity = func.similarity(func.lower(Shoe.name), value)
        rows = session.scalars(select(Shoe.id).where(*where, or_(and_(*matches), similarity > 0.2))
                               .order_by((func.lower(Shoe.name) == value).desc(), similarity.desc(), Shoe.id).limit(100))
        lexical.extend(sid for sid in rows if sid not in lexical)
    channels = [("lexical", 1.0, lexical)]
    if vector is not None:
        # At this catalog size exact pgvector scans avoid ANN recall/filter tradeoffs.
        eligible = list(session.scalars(select(Shoe.id).where(*where)))
        current = {d.shoe_id: d for d in documents(session, eligible)} if eligible else {}
        stored = list(session.scalars(select(ProductEmbedding).where(
            ProductEmbedding.model_key == MODEL_KEY, ProductEmbedding.shoe_id.in_(eligible)))) if eligible else []
        fresh: dict[str, list[int]] = {"text": [], "image": []}
        for row in stored:
            doc = current[row.shoe_id]
            valid = (row.content_hash == doc.content_hash if row.modality == "text"
                     else row.provenance.get("source_url") == doc.image_url)
            if valid:
                fresh[row.modality].append(row.shoe_id)
        for modality, weight in [("text", 1.0), ("image", 0.7)]:
            ids = fresh[modality]
            ranked = list(session.scalars(select(ProductEmbedding.shoe_id).where(
                ProductEmbedding.model_key == MODEL_KEY, ProductEmbedding.modality == modality,
                ProductEmbedding.shoe_id.in_(ids)).order_by(
                    ProductEmbedding.embedding.cosine_distance(vector), ProductEmbedding.shoe_id).limit(100))) if ids else []
            channels.append((modality, weight, ranked))
        if not any(channel[2] for channel in channels[1:]):
            degraded = "embeddings_unavailable"
    ordered, scores, reasons = fuse(channels)
    selected = ordered[:request.limit]
    summaries = {row["shoe_id"]: row for row in session.scalars(select(Shoe.summary).where(Shoe.id.in_(selected)))}
    return dict(items=[dict(summaries[sid], reference_price=reference_price(summaries[sid]),
                            search_score=scores[sid], search_channels=reasons[sid]) for sid in selected],
                mode="lexical_fallback" if degraded else "hybrid", degraded_reason=degraded,
                translated_query=english if not degraded else None, returned=len(selected),
                candidate_count=len(ordered), model_key=MODEL_KEY, score_kind="weighted_rrf_not_probability")
