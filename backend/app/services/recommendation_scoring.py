"""Versioned engineering heuristics, not fit/comfort probabilities."""
SCORING_VERSION = "rad-recommendations-v2"
CONFIG = {"preference_weight": .8, "semantic_weight": .15, "lexical_weight": .05,
          "no_preferences_semantic_weight": .7, "no_preferences_lexical_weight": .3,
          "image_weight": .2, "text_weight": .8}
LABELS = {"weight": "وزن", "width": "عرض داخلی", "cushion": "سفتی فوم", "surface": "مسیر",
          "usage": "کاربرد", "breathability": "تنفس‌پذیری", "durability": "سایش زیره",
          "flexibility": "انعطاف", "cushioning": "جذب ضربه"}


def clamp(value):
    return max(0., min(1., value))


def criterion(doc, key, desired):
    metrics = doc.facts["measurements"]
    attributes = doc.facts["attributes"]
    field = None
    score = None
    value = None
    unit = None
    if key in {"surface", "usage"}:
        field = "terrain" if key == "surface" else "uses"
        raw = attributes.get(field)
        if raw is not None:
            value = raw
            tokens = str(raw).lower()
            score = float(desired in tokens)
    else:
        fields = {"weight": ("weight_g", "g"), "width": ("interior_forefoot_width_mm", "mm"),
                  "cushion": ("midsole_firmness_asker_c", "Asker C"),
                  "breathability": ("breathability_score_5", "1-5"),
                  "durability": ("outsole_wear_mm", "mm"),
                  "flexibility": ("bending_force_30deg_n", "N"),
                  "cushioning": ("shock_absorption_heel_sa", "SA")}
        field, expected_unit = fields[key]
        metric = metrics.get(field)
        if key == "cushion" and metric is None:
            field, expected_unit = "midsole_softness_shore_a", "Shore A"
            metric = metrics.get(field)
        if metric and metric["unit"] == expected_unit:
            value, unit = metric["value"], metric["unit"]
            if key == "weight":
                score = clamp((350 - value) / 150) if desired == "light" else clamp(1 - max(250 - value, value - 320, 0) / 100)
            elif key == "width":
                score = clamp((value - 94) / 6) if desired == "wide" else clamp(1 - abs(value - 97) / 6)
            elif key == "cushion":
                threshold = 35 if field == "midsole_firmness_asker_c" else 20
                score = clamp(.5 + (threshold - value) / (2 * threshold))
                if desired == "firm":
                    score = 1 - score
            elif key == "breathability":
                score = clamp((value - 1) / 4)
            elif key == "durability":
                score = clamp(1 - value / 2)
            elif key == "flexibility":
                score = clamp(1 - value / 30)
            elif key == "cushioning":
                score = clamp((value - 60) / 100)
    provenance = metrics.get(field, {}).get("provenance") if field else None
    return dict(key=key, desired=desired, score=score, value=value, unit=unit, field=field,
                state="unknown" if score is None else "match" if score >= .6 else "partial" if score >= .3 else "miss",
                provenance=provenance)


def score_product(doc, preferences, semantic, lexical, has_query):
    breakdown = []
    for key, desired in preferences.model_dump(exclude_none=True, exclude={"priorities"}).items():
        row = criterion(doc, key, desired)
        row["weight"] = preferences.priorities.get(key, 1.)
        breakdown.append(row)
    denominator = sum(r["weight"] for r in breakdown)
    covered = sum(r["weight"] for r in breakdown if r["score"] is not None)
    preference = sum((r["score"] or 0) * r["weight"] for r in breakdown) / denominator if denominator else 0.
    # Missing channels contribute zero; their absence never raises evidence coverage.
    sem = sum(semantic.get(k, 0) * CONFIG[k + "_weight"] for k in ("text", "image"))
    if denominator:
        ranking = (CONFIG["preference_weight"] * preference + CONFIG["semantic_weight"] * sem
                   + CONFIG["lexical_weight"] * lexical) if has_query else preference
    else:
        ranking = (CONFIG["no_preferences_semantic_weight"] * sem
                   + CONFIG["no_preferences_lexical_weight"] * lexical) if has_query else 0.
    return dict(match_score=round(preference * 100, 2) if denominator else None,
                data_coverage=round(covered / denominator, 4) if denominator else None,
                ranking_score=round(ranking * 100, 6), criteria=breakdown,
                missing_data=[r["key"] for r in breakdown if r["score"] is None], semantic_scores=semantic)


def explanation(score):
    known = [r for r in score["criteria"] if r["score"] is not None]
    states = {"match": "هم‌راستا با ترجیح", "partial": "تا حدی هم‌راستا", "miss": "کمتر هم‌راستا"}
    parts = [f"{LABELS[r['key']]}: {r['value']} {r['unit'] or ''} ({states[r['state']]})" for r in known[:2]]
    misses = [LABELS[r["key"]] for r in known if r["state"] == "miss"]
    if misses:
        parts.append("ترجیح‌های کمتر منطبق: " + "، ".join(misses))
    if score["missing_data"]:
        parts.append("دادهٔ ناموجود: " + "، ".join(LABELS[k] for k in score["missing_data"]))
    return "؛ ".join(parts) + "." if parts else "این مدل شرط‌های قطعی بررسی‌شده را رعایت می‌کند؛ شباهت معنایی تضمین تناسب نیست."
