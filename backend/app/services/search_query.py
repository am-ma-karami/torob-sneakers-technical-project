"""Merge typed sources without weakening either set of mandatory constraints."""
from pydantic import ValidationError

from app.schemas.search import HardFilters, Preferences


def merge_requirements(manual, inferred, preferences, inferred_preferences):
    values = manual.model_dump()
    conflicts = []
    for key in ("brand", "category"):
        a, b = getattr(manual, key), getattr(inferred, key)
        if a and b and set(a) != set(b):
            conflicts.append(dict(field=key, manual=a, text=b, blocking=True,
                                  reason="Explicit selections and description disagree"))
        if not a:
            values[key] = b
    for prefix in ("weight", "drop"):
        for suffix in ("min", "max"):
            key = prefix + "_" + suffix
            a, b = getattr(manual, key), getattr(inferred, key)
            choose = max if suffix == "min" else min
            value = choose(a, b) if a is not None and b is not None else a if a is not None else b
            values[key] = value
            values[key + "_exclusive"] = any(
                getattr(source, key) == value and getattr(source, key + "_exclusive")
                for source in (manual, inferred) if getattr(source, key) is not None
            )
    try:
        hard = HardFilters.model_validate(values)
    except ValidationError:
        hard = manual
        conflicts.append(dict(field="numeric_range", manual=manual.active(), text=inferred.active(),
                              blocking=True, reason="No product can satisfy both numerical ranges"))
    soft = inferred_preferences.model_dump()
    for key, value in preferences.model_dump(exclude_none=True, exclude={"priorities"}).items():
        if soft.get(key) is not None and soft[key] != value:
            conflicts.append(dict(field=key, manual=value, text=soft[key], blocking=False,
                                  reason="Manual soft preference takes precedence"))
        soft[key] = value
    priorities = {**{k: v for k, v in inferred_preferences.priorities.items()
                     if getattr(inferred_preferences, k) == soft.get(k)}, **preferences.priorities}
    soft["priorities"] = {key: value for key, value in priorities.items() if soft.get(key) is not None}
    return hard, Preferences.model_validate(soft), conflicts
