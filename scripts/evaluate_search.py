"""Read-only full-catalog constraint smoke evaluation. --live-ai makes Metis calls.

This is a small engineering evaluation, not a human-labeled relevance benchmark.
The legacy comparison isolates retrieval using the same validated English query.
"""
import argparse
import json
from pathlib import Path
from time import monotonic
from types import SimpleNamespace

from app.db.session import SessionLocal
from app.repositories.recommendations import eligible
from app.repositories.search import retrieve as legacy_retrieve
from app.schemas.catalog import CatalogQuery
from app.schemas.search import SearchRequest
from app.services.search import query_vector, search

CASES = [
    {"name": "manual_adidas_weight", "request": {"hard_filters": {"brand": ["adidas"], "weight_max": 250},
        "preferences": {"weight": "light"}}, "expect": {"status": "ok"}},
    {"name": "manual_no_results", "request": {"hard_filters": {"weight_max": 1}}, "expect": {"status": "no_matches"}},
    {"name": "inclusive_223g_evo", "request": {"hard_filters": {"brand": ["adidas"], "weight_min": 223, "weight_max": 223}},
        "expect": {"status": "ok", "include": 40586}},
    {"name": "exclusive_223g_evo", "request": {"hard_filters": {"brand": ["adidas"], "weight_max": 223, "weight_max_exclusive": True}},
        "expect": {"status": "ok", "exclude": 40586}},
    {"name": "advisor_fa", "request": {"q": "برای دویدن روزانه روی آسفالت کفش سبک و نرم میخوام که فضای جلوی پام زیاد باشه و وزنش بیشتر از ۲۵۰ گرم نباشه"},
        "expect": {"status": "ok", "hard": {"category": ["running-shoes"], "weight_max": 250},
                   "preferences": {"weight": "light", "width": "wide", "cushion": "soft", "surface": "road", "usage": "jogging"}}},
    {"name": "advisor_en", "request": {"q": "I need running shoes for daily road jogging. I prefer lightweight construction, soft foam and a roomy toe box. Weight must be no more than 250 grams."},
        "expect": {"status": "ok", "hard": {"category": ["running-shoes"], "weight_max": 250},
                   "preferences": {"weight": "light", "width": "wide", "cushion": "soft", "surface": "road"}}},
    {"name": "hybrid_road_soft", "request": {"q": "کفش نرم برای دویدن روزانه روی آسفالت", "hard_filters": {"brand": ["adidas"], "weight_max": 250}},
        "expect": {"status": "ok", "hard": {"brand": ["adidas"], "weight_max": 250}}},
    {"name": "brand_conflict", "request": {"q": "Only adidas shoes", "hard_filters": {"brand": ["Nike"]}},
        "expect": {"status": "conflict"}},
]


def evaluate(live_ai=False):
    rows = []
    with SessionLocal() as session:
        for case in CASES:
            if case["request"].get("q") and not live_ai:
                continue
            request = SearchRequest.model_validate(case["request"])
            started = monotonic()
            result = search(session, request)
            elapsed = monotonic() - started
            expected = case["expect"]
            errors = []
            if result["status"] != expected["status"]:
                errors.append("unexpected_status")
            for key, value in expected.get("hard", {}).items():
                if result["applied_hard_filters"].get(key) != value:
                    errors.append("intent_hard_" + key)
            for key, value in expected.get("preferences", {}).items():
                if result["applied_preferences"].get(key) != value:
                    errors.append("intent_preference_" + key)
            ids = [r["product_id"] for r in result["items"]]
            if "include" in expected and expected["include"] not in ids:
                errors.append("missing_expected_product")
            if "exclude" in expected and expected["exclude"] in ids:
                errors.append("exclusive_boundary_violation")
            if len(ids) != len(set(ids)):
                errors.append("duplicate_product")
            from app.schemas.search import HardFilters
            hard = HardFilters.model_validate(result["applied_hard_filters"])
            compliant = {p.id for p in eligible(session, hard, identifiers=ids)}
            violations = len(set(ids) - compliant)
            if violations:
                errors.append("mandatory_constraint_violation")
            baseline_violations = None
            if request.q and result["status"] == "ok" and result.get("translated_query"):
                legacy_filters = request.hard_filters.model_dump(exclude_none=True,
                    exclude={k for k in type(request.hard_filters).model_fields if k.endswith("_exclusive")})
                baseline_request = SimpleNamespace(q=request.q, filters=CatalogQuery.model_validate(legacy_filters), limit=9)
                baseline = legacy_retrieve(session, baseline_request, result["translated_query"], query_vector(result["translated_query"]))
                baseline_violations = sum(r["shoe_id"] not in {p.id for p in eligible(session, hard)} for r in baseline["items"])
            rows.append(dict(case=case["name"], seconds=round(elapsed, 3), status=result["status"],
                interpreted=result["interpreted_requirements"], applied_hard_filters=result["applied_hard_filters"],
                eligible=result["eligible_count"], ids=ids, violations=violations,
                legacy_retrieval_violations=baseline_violations, errors=errors,
                scores=[dict(product_id=r["product_id"], match=r["match_score"], coverage=r["data_coverage"]) for r in result["items"]]))
            print(case["name"], result["status"], "returned", len(ids), "violations", violations, "errors", errors, flush=True)
    return dict(live_ai=live_ai, cases=rows, passed=sum(not r["errors"] for r in rows), total=len(rows),
                claim="Constraint/intent smoke evaluation only; no human relevance or comfort accuracy claim")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live-ai", action="store_true")
    parser.add_argument("--output", type=Path, default=Path(".local/recommendations/evaluation.json"))
    args = parser.parse_args()
    report = evaluate(args.live_ai)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    raise SystemExit(0 if report["passed"] == report["total"] else 1)
