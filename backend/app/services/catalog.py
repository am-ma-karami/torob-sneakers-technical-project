from typing import Literal, TypedDict

from app.core.taxonomy import CATEGORIES
from app.repositories.catalog import CatalogRepository
from app.schemas.catalog import Card, CatalogQuery, FinderRequest
from app.services.presentation import empirical_distribution, present_detail, reference_price


class NotFound(Exception):
    pass


class CatalogService:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def detail(self, slug: str):
        rows = self.repository.details(slug=slug)
        if not rows:
            raise NotFound("Shoe not found")
        return present_detail(rows[0])

    def compare(self, ids: list[int]):
        unique = list(dict.fromkeys(ids))
        rows = self.repository.details(identifiers=unique, include_offers=False)
        if len(rows) != len(unique):
            raise NotFound("One or more shoes not found")
        return {"items": [present_detail(s) for s in rows]}

    @staticmethod
    def _validate_category(category: str):
        if category not in CATEGORIES:
            raise NotFound("Category not found")

    def finder_brands(self, category: str):
        self._validate_category(category)
        return {"items": self.repository.brand_options(category)}

    def finder(self, preferences: FinderRequest):
        self._validate_category(preferences.category)
        filters = CatalogQuery.model_validate(
            {
                "category": [preferences.category],
                "brand": preferences.brands,
                "weight_max": preferences.weight_max,
                "drop_max": preferences.drop_max,
            }
        )
        ranked = []
        for summary in self.repository.finder_candidates(filters):
            checks = preference_checks(summary, preferences)
            score, reasons, unknown = score_preferences(checks)
            ranked.append(
                {
                    "shoe": dict(summary, reference_price=reference_price(summary)),
                    "points": score,
                    "reasons": reasons,
                    "unknown": unknown,
                    "checks": checks,
                }
            )
        ranked.sort(
            key=lambda x: (-x["points"], -(x["shoe"].get("runrepeat_score") or -1), x["shoe"]["shoe_id"])
        )
        return {
            "items": ranked[:12],
            "total": len(ranked),
            "rules": {
                "activity": 40,
                "width": 20,
                "weight": 20,
                "cushion": 20,
                "width_wide": "current-method internal forefoot width >= 100 mm",
                "width_regular": "current-method internal forefoot width 94–99.9 mm",
                "weight_light": "<= 250 g",
                "weight_balanced": "250–320 g",
                "cushion_soft": "Asker C <= 35, or Shore A <= 20 only if Asker C unavailable",
                "cushion_firm": "Asker C > 35, or Shore A > 20 only if Asker C unavailable",
                "missing": "0 preference points; disclosed as unknown",
                "meaning": "rule points, not a probability or medical advice",
            },
        }


class PreferenceCheck(TypedDict):
    key: Literal["width", "weight", "cushion"]
    value: float | None
    unit: str | None
    state: Literal["unknown", "match", "miss"]


def preference_checks(s: dict, p: FinderRequest):
    checks: list[PreferenceCheck] = []

    def add(key: Literal["width", "weight", "cushion"], value: float | None, unit: str, matches: bool):
        checks.append(
            {
                "key": key,
                "value": value,
                "unit": unit if value is not None else None,
                "state": "unknown" if value is None else "match" if matches else "miss",
            }
        )

    if p.width != "any":
        width = s.get("interior_forefoot_width_mm")
        add(
            "width",
            width,
            "mm",
            width is not None
            and ((p.width == "wide" and width >= 100) or (p.width == "regular" and 94 <= width < 100)),
        )
    if p.weight != "any":
        weight = s.get("weight_g")
        add(
            "weight",
            weight,
            "g",
            weight is not None
            and (
                (p.weight == "light" and weight <= 250) or (p.weight == "balanced" and 250 <= weight <= 320)
            ),
        )
    if p.cushion != "any":
        firmness = s.get("midsole_firmness_asker_c")
        threshold, unit = 35, "Asker C"
        if firmness is None:
            firmness = s.get("midsole_softness_shore_a")
            threshold, unit = 20, "Shore A"
        add(
            "cushion",
            firmness,
            unit,
            firmness is not None
            and (
                (p.cushion == "soft" and firmness <= threshold)
                or (p.cushion == "firm" and firmness > threshold)
            ),
        )
    return checks


def score_preferences(checks: list[PreferenceCheck]):
    labels = {"width": "عرض داخلی", "weight": "وزن", "cushion": "حس فوم"}
    matches = [labels[check["key"]] for check in checks if check["state"] == "match"]
    reasons = ["کاربری انتخاب‌شده", *(f"{name} متناسب با ترجیح" for name in matches)]
    unknown = [labels[check["key"]] for check in checks if check["state"] == "unknown"]
    return 40 + 20 * len(matches), reasons, unknown


def rank_shoe(s: dict, p: FinderRequest):
    return score_preferences(preference_checks(s, p))


FEATURED_IDS = [40586, 40390, 41349, 40830]


def featured_catalog(repository):
    return {
        "items": [
            dict(
                Card.model_validate(s["summary"]).model_dump(),
                foam=s["summary"].get("foam"),
                plate=s["summary"].get("plate"),
                image_url=next(
                    (v["image_url"] for v in s["variants"] if v.get("image_url")),
                    s["summary"].get("image_url"),
                ),
            )
            for s in repository.details(identifiers=FEATURED_IDS, include_offers=False)
        ]
    }


def score_context(repository, slug):
    rows = repository.details(slug=slug, include_offers=False)
    if not rows:
        raise NotFound("Shoe not found")
    shoe = rows[0]
    category = shoe["summary"]["categories"][0]
    usage = shoe.get("scores", {}).get("runrepeat", {}).get("usage", {})
    peers = repository.score_population(category)
    rows = []
    for key, value in usage.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            continue
        distribution = empirical_distribution([p.get(key) for p in peers if isinstance(p, dict)], value)
        rows.append({"key": key, "value": value, "unit": "score_0_100", "distribution": distribution})
    return {
        "category": category,
        "source_key": "runrepeat_usage",
        "rows": rows,
        "population_definition": "مدل‌های هم‌دسته با همین شاخص ارزیابی؛ توزیع محاسبه‌شده در کاتالوگ راد",
    }
