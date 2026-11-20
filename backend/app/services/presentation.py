"""Read-only presentation enrichment. Original records and currencies stay intact."""

import json
import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

CONTENT = Path(__file__).resolve().parents[1] / "content"


@lru_cache(maxsize=2)
def _translations(mtime: float):
    path = CONTENT / "reviews-fa.json"
    return json.loads(path.read_text()) if path.exists() else {}


def review_translation(text):
    path = CONTENT / "reviews-fa.json"
    entries = _translations(path.stat().st_mtime if path.exists() else 0)
    return [entries[part.strip()] for part in (text or "").split(" | ") if part.strip() in entries]


def reference_price(summary, settings=None):
    settings = settings or get_settings()
    amount = summary.get("msrp_usd")
    rate = settings.reference_usd_toman
    stamp = settings.reference_rate_at
    if (
        not isinstance(amount, (int, float))
        or isinstance(amount, bool)
        or not math.isfinite(amount)
        or amount <= 0
        or not rate
        or not stamp
        or stamp.tzinfo is None
        or stamp > datetime.now(timezone.utc)
    ):
        return None
    return {
        "amount_toman": round(float(amount) * rate),
        "kind": "converted_msrp_reference",
        "original_amount": amount,
        "original_currency": "USD",
        "rate_toman_per_usd": rate,
        "rate_at": stamp.isoformat(),
    }


def present_detail(shoe):
    return dict(
        shoe,
        reviews_fa={
            "pros": review_translation(shoe["summary"].get("pros")),
            "cons": review_translation(shoe["summary"].get("cons")),
        },
        reference_price=reference_price(shoe["summary"]),
    )


def empirical_distribution(values, selected, bins=10):
    population = [
        float(v)
        for v in values
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and 0 <= v <= 100
    ]
    if (
        len(population) < 5
        or not isinstance(selected, (int, float))
        or isinstance(selected, bool)
        or not math.isfinite(selected)
        or not 0 <= selected <= 100
    ):
        return None
    counts = [0] * bins
    for v in population:
        counts[min(bins - 1, int(v * bins / 100))] += 1
    below = sum(v < selected for v in population)
    equal = sum(v == selected for v in population)
    return {
        "bins": counts,
        "range": [0, 100],
        "population_size": len(population),
        "selected": selected,
        "percentile": round((below + equal * 0.5) / len(population) * 100, 1),
        "method": "empirical_midrank",
        "definition": "same primary category, same score key, same source; no fitted curve",
    }
