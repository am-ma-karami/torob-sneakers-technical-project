import logging
from time import monotonic

from app.core.taxonomy import normalize
from app.embeddings.spec import MODEL_KEY
from app.repositories import recommendations as repository
from app.schemas.search import HardFilters, Preferences, SearchIntent, canonical_brands
from app.services.presentation import reference_price
from app.services.recommendation_scoring import SCORING_VERSION, explanation, score_product
from app.services.search_intent import IntentUnavailable, extract_intent
from app.services.search_query import merge_requirements

logger = logging.getLogger(__name__)


def search(session, request, vector_encoder):
    started = monotonic()
    known = repository.known_brands(session)
    manual = request.hard_filters
    legacy = request.filters
    if legacy is not None:
        fields = {k: getattr(legacy, k) for k in ("brand", "category", "weight_min", "weight_max", "drop_min", "drop_max")}
        manual, _, legacy_conflicts = merge_requirements(manual, HardFilters.model_validate(fields), Preferences(), Preferences())
    else:
        legacy_conflicts = []
    # All supported legacy fields have been merged above; don't reapply unnormalized
    # aliases or maintain a second, potentially inconsistent condition builder.
    legacy = None
    manual_fields = manual.active()
    manual_preferences = request.preferences.model_dump(exclude_none=True, exclude={"priorities"})
    has_manual = bool(manual_fields or manual_preferences)
    mode = "hybrid" if request.q and has_manual else "advisor" if request.q else "advanced"
    intent = SearchIntent()
    degraded = None
    try:
        manual = canonical_brands(manual, known)
    except ValueError:
        legacy_conflicts.append(dict(field="brand", blocking=True, reason="Unknown manual catalog brand"))
    if request.q:
        try:
            intent = SearchIntent.model_validate(extract_intent(request.q, tuple(known)))
        except IntentUnavailable as error:
            degraded = str(error)
    hard, preferences, conflicts = merge_requirements(manual, intent.hard_filters, request.preferences, intent.preferences)
    conflicts = legacy_conflicts + conflicts
    response = dict(items=[], mode=mode, status="ok", degraded_reason=degraded, conflicts=conflicts,
                    interpreted_requirements=intent.model_dump(), applied_hard_filters=hard.active(),
                    applied_preferences=preferences.model_dump(exclude_none=True), eligible_count=0,
                    returned=0, candidate_count=0, model_key=MODEL_KEY, scoring_version=SCORING_VERSION,
                    score_kind="engineering_match_not_fit_probability", empty_result=None,
                    suggested_adjustments=[], unsupported_requirements=intent.unsupported_requirements)
    logger.info("search intent mode=%s degraded=%s hard_fields=%d soft_fields=%d", mode,
                bool(degraded), len(hard.active()), len(preferences.model_dump(exclude_none=True, exclude={"priorities"})))
    if any(c["blocking"] for c in conflicts):
        response.update(status="conflict", empty_result="Conflicting requirements; no constraints were relaxed")
        return response
    if intent.unsupported_requirements:
        response.update(status="unsupported_requirements", empty_result="Some requirements cannot be verified from this dataset")
        return response
    if degraded and not has_manual:
        response.update(status="intent_unavailable", empty_result="Natural-language requirements could not be interpreted; retry")
        return response
    if degraded:
        response.update(status="manual_filter_only", requires_confirmation=True)
    products = list({p.id: p for p in repository.eligible(session, hard, legacy)}.values())
    response["eligible_count"] = len(products)
    if not products:
        response["status"] = "no_matches"
        response["empty_result"] = "No products have verified data satisfying all hard requirements"
        # Diagnose each restriction without applying the suggested relaxation.
        for key in ("brand", "category", "weight_min", "weight_max", "drop_min", "drop_max"):
            if key not in hard.active():
                continue
            values = hard.model_dump()
            values[key] = [] if key in {"brand", "category"} else None
            if key + "_exclusive" in values:
                values[key + "_exclusive"] = False
            count = len(repository.eligible(session, HardFilters.model_validate(values)))
            if count:
                response["suggested_adjustments"].append(dict(field=key, products_if_removed=count, applied=False))
        return response
    docs = repository.evidence(session, products)
    semantic = {}
    if request.q and not degraded:
        try:
            vector = vector_encoder(intent.semantic_query)
            semantic = repository.semantic_scores(session, docs, vector)
            if not any(semantic.values()):
                response["degraded_reason"] = "no_fresh_semantic_evidence"
        except (ImportError, OSError, RuntimeError, ValueError) as error:
            response["degraded_reason"] = "semantic_encoder_unavailable"
            logger.info("search encoder unavailable type=%s", type(error).__name__)
    query = normalize(intent.semantic_query if not degraded else "")
    ranked = []
    for product in products:
        name = normalize(product.name)
        lexical = 1. if name and name in query else 0.
        scores = score_product(docs[product.id], preferences, semantic.get(product.id, {}), lexical,
                               bool(query))
        ranked.append((product, scores))
    ranked.sort(key=lambda row: (-row[1]["ranking_score"], -(row[1]["data_coverage"] or 0),
                                -(row[0].score or 0), row[0].id))
    # Final SQL revalidation: only real, still-eligible canonical IDs may leave the service.
    final_ids = [p.id for p, _ in ranked[:request.limit]]
    valid = {p.id: p for p in repository.eligible(session, hard, legacy, final_ids)}
    final_docs = repository.evidence(session, list(valid.values()))
    for product, scores in ranked[:request.limit]:
        if product.id not in valid or final_docs[product.id].content_hash != docs[product.id].content_hash:
            continue
        summary = valid[product.id].summary
        response["items"].append(dict(summary, product_id=product.id,
            reference_price=reference_price(summary), **scores, search_score=scores["ranking_score"],
            search_channels={k: v for k, v in scores["semantic_scores"].items()},
            search_explanation=explanation(scores), explanation_source="deterministic_evidence"))
    response.update(returned=len(response["items"]), candidate_count=len(products),
                    translated_query=intent.semantic_query or None)
    if not response["items"]:
        response.update(status="no_matches", empty_result="Results changed before final validation; retry")
    logger.info("search mode=%s eligible=%d returned=%d status=%s elapsed_ms=%d", mode,
                len(products), response["returned"], response["status"], (monotonic() - started) * 1000)
    return response
