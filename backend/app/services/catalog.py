from app.core.taxonomy import CATEGORIES
from app.repositories.catalog import CatalogRepository
from app.schemas.catalog import FinderRequest


class NotFound(Exception):
    pass


class CatalogService:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def detail(self, slug: str):
        rows = self.repository.details(slug=slug)
        if not rows:
            raise NotFound("Shoe not found")
        return rows[0]

    def compare(self, ids: list[int]):
        unique = list(dict.fromkeys(ids))
        rows = self.repository.details(identifiers=unique)
        if len(rows) != len(unique):
            raise NotFound("One or more shoes not found")
        return {"items": rows}

    def finder(self, preferences: FinderRequest):
        if preferences.category not in CATEGORIES:
            raise NotFound("Category not found")
        ranked = []
        for summary, detail in self.repository.finder_candidates(preferences.category):
            score, reasons, unknown = rank_shoe(summary, preferences)
            ranked.append({"shoe": summary, "points": score, "reasons": reasons, "unknown": unknown})
        ranked.sort(
            key=lambda x: (-x["points"], -(x["shoe"].get("runrepeat_score") or -1), x["shoe"]["shoe_id"])
        )
        return {
            "items": ranked[:12],
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


def rank_shoe(s: dict, p: FinderRequest):
    score = 40
    reasons = ["کاربری انتخاب‌شده"]
    unknown = []
    if p.width != "any":
        width = s.get("interior_forefoot_width_mm")
        if width is None:
            unknown.append("عرض داخلی")
        elif (p.width == "wide" and width >= 100) or (p.width == "regular" and 94 <= width < 100):
            score += 20
            reasons.append("عرض داخلی متناسب با ترجیح")
    if p.weight != "any":
        weight = s.get("weight_g")
        if weight is None:
            unknown.append("وزن")
        elif (p.weight == "light" and weight <= 250) or (p.weight == "balanced" and 250 <= weight <= 320):
            score += 20
            reasons.append("وزن متناسب با ترجیح")
    if p.cushion != "any":
        firmness = s.get("midsole_firmness_asker_c")
        threshold = 35
        if firmness is None:
            firmness = s.get("midsole_softness_shore_a")
            threshold = 20
        if firmness is None:
            unknown.append("حس فوم")
        elif (p.cushion == "soft" and firmness <= threshold) or (
            p.cushion == "firm" and firmness > threshold
        ):
            score += 20
            reasons.append("سفتی فوم متناسب با ترجیح")
    return score, reasons, unknown
